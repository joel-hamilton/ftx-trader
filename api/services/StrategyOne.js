require("dotenv").config({ path: "../.env" });
const RT = require('./RebalanceTrader');
const ftx = require("./ftx");
const twilio = require('./twilio');
const stats = require('./stats');
const moment = require('moment');
const utils = require('./utils');
const fs = require("fs");

module.exports = class StrategyOne {
    constructor(reduceTrailAtMoment, closePositionAtMoment, logging = false) {
        this.logging = logging;

        // timing Moments
        this.reduceTrailAtMoment = reduceTrailAtMoment; // when to begin reducing the trailing stop pct
        this.closePositionAtMoment = closePositionAtMoment;

        // while determining market to enter
        this.ignoreMarkets = ['EXCH-PERP'];
        this.limit = 1; // number of trades to make
        this.minRatio = 0.09;
        this.minRebalanceAmt = 500 * 1000;
        this.minVolume24h = 1000 * 1000;
        this.inSignal = ['EMA9', 'EMA20'];
        this.trailPct = 0.0075; // this is reduced as time goes on
        this.initialTrailPct = this.trailPct;
        this.potentialMarkets = [];

        // after initial order placed
        this.market = '';
        this.marketDetails = {};
        this.size = 0;
        this.side = '';
        this.leverage = 10;

        // order tracking
        this.openOrder = null;
        this.trailOrder = null;
        this.closeOrder = null;
    }

    async run() {
        let rt = new RT({ minVolume24h: this.minVolume24h, minRebalanceSizeUsd: this.minRebalanceAmt });
        await rt.init();
        this.potentialMarkets = rt.getAggData().slice(0, 10).reduce((markets, market) => {
            if (!this.ignoreMarkets.includes(market.underlying) && market.rebalanceRatio >= this.minRatio) {
                markets.push({
                    side: market.rebalanceAmountUsd > 0 ? 'buy' : 'sell',
                    prevSignal: null,
                    ...rt.marketStats[market.underlying],
                });
            }
            return markets;
        }, [])


        console.log('potential markets');
        console.log(this.potentialMarkets);
        if(this.logging) twilio.sendSms(['5197772459'], `Running Strategy One: ${this.potentialMarkets.length} potential markets`);
        if (!this.potentialMarkets.length) return;

        // load data for each potential, and run stats on each to look for MA crossover
        loop:
        while (true) {
            for (let market of this.potentialMarkets) {
                let signal = await this.latestMarketSignal(market);
                console.log(`signal ${signal} for ${market.name} (prev ${market.prevSignal})`);
                let newSignal = market.prevSignal !== null && signal !== 0 && signal !== market.prevSignal;
                let correctSide = (market.side === 'buy' && signal === 1) || (market.side === 'sell' && signal === -1);
                if (newSignal && correctSide) {
                    this.market = market.name;
                    this.marketDetails = market;
                    this.side = market.side;
                    this.potentialMarkets = [];
                    this.beginOrdering();
                    break loop;
                }

                market.prevSignal = signal;
            }

            if(this.reduceTrailAtMoment && moment().isAfter(this.reduceTrailAtMoment)) {
                console.log('No trades made');
                break;
            }
        }
    }

    async mock() {
        this.market = 'XLM-PERP';
        this.side = 'buy';
        // this.leverage = 0.1;
        // this.reduceTrailAtMoment = moment("2021-07-27 01:14:00");
        // this.closePositionAtMoment = moment("2021-07-27 01:16:00");
        this.beginOrdering();
    }

    async beginOrdering() {
        await this.placeOpenOrder();
        await this.recurringTasks();
    }

    // depends on this being called at least once/15s
    async latestMarketSignal(market) {
        let timeSeries = await ftx.getData({ market: market.name, start: moment().subtract(10, 'minutes'), end: moment() });
        let maCross = await stats.getMaCross(timeSeries, this.inSignal[0], this.inSignal[1]);
        return maCross[maCross.length - 1].ma_x;
    }

    // TODO make the order move and follow the midprice. Currently very possible that order won't be filled, and nothing will happen
    async placeOpenOrder() {
        let account = await ftx.getAccount();
        let collateral = account.freeCollateral;
        let amountUsd = this.leverage * collateral / this.limit;
        console.log(`amountUsd: ${amountUsd}`);

        let orderbook = await ftx.getOrderBookFixed(this.market);
        let mid = (orderbook.bids[0][0] + orderbook.asks[0][0]) / 2;
        // mid = orderbook.asks[0][0]; // TODO for testing
        let sizeIncrementParts = ('' + this.marketDetails.sizeIncrement).split('.');
        let numDigits = sizeIncrementParts.length > 1 ? sizeIncrementParts[1].length : 0;
        this.size = parseFloat((amountUsd / mid).toFixed(numDigits));
        let orderString = `PLACING ${this.side} ORDER ${this.market} AT MID ($${mid})`;
        console.log(orderString)
        if(this.logging) twilio.sendSms(['5197772459'], orderString);

        let order = {
            market: this.market,
            side: this.side,
            price: mid,
            type: "limit",
            size: this.size,
        };

        let res = await ftx.query({ method: 'POST', path: '/orders', body: order, authRoute: true });
        this.openOrder = res.result;
        console.log(this.openOrder);
    }

    async recurringTasks() {
        // if past specific close time, close everything and tidy up
        if(this.closePositionAtMoment && moment().isAfter(this.closePositionAtMoment)) {
            this.closeAll();
            return;
        }

        // refresh open order to get current filled size
        if (this.openOrder.filledSize !== this.size) {
            this.openOrder = await ftx.getOrder(this.openOrder);
        }

        // if no fill yet, just wait
        if (!this.openOrder.filledSize) {
            console.log('no fill yet')
            return repeat(this);
        }

        // update desired trail percentage based on time
        let initialTrailPct = this.trailPct;
        this.updateTrailPct();
        let newTrailPct = this.trailPct;
        let trailValue = this.trailPct * this.openOrder.price * (this.side === 'buy' ? -1 : 1);

        if (!this.trailOrder) {
            if(this.logging) twilio.sendSms(['5197772459'], `Open order filled (${this.openOrder.filledSize} / ${this.size})`);
            
            // place initial trailing stop order
            let body = {
                market: this.market,
                side: this.side === 'buy' ? 'sell' : 'buy',
                trailValue,
                size: this.openOrder.filledSize,
                type: "trailingStop",
                reduceOnly: true,
            };

            console.log('placing trail')
            console.table(body);
            let res = await ftx.query({ method: 'POST', path: '/conditional_orders', body, authRoute: true });
            this.trailOrder = res.result;
        } else if (initialTrailPct !== newTrailPct || this.openOrder.filledSize !== this.size) {
            // trail pct or filled size changed, update existing trailing stop order
            let body = {
                trailValue,
                size: this.openOrder.filledSize,
            };

            // change in order, send updated order
            console.table({ initialTrailPct, newTrailPct, openOrderFilledSize: this.openOrder.filledSize, size: this.size });
            console.log(`updating trail`);
            console.table(body);
            let res = await ftx.query({ path: `/conditional_orders/${this.trailOrder.id}/modify`, method: 'POST', body, authRoute: true });
            if (res.success) {
                this.trailOrder = res.result;
            } else if (res.error === 'Order already closed' || res.error === 'Order already triggered') {
                console.log(res.error);
                // probably because the trailing stop was hit, but we'll double-check
                let account = await ftx.getAccount();
                let openPositions = account.positions.filter(p => p.openSize);
                if(openPositions.length) {
                    console.log('oops, open positions!');
                    console.log(openPositions);
                    // if open positions, just cancel everything
                    // TODO obviously this neds to be changed if ever trading something in addition to this strategy
                    await this.closeAll();
                }

                return; // all done!
            } else {
                console.log('WHAT HAPPENED?')
                console.log(res);
            }
        }

        return repeat(this);

        async function repeat(self) {
            await utils.wait(100);
            self.recurringTasks();
        }
    }

    async closeAll() {
        console.log('Cancelling orders');
        if(this.logging) twilio.sendSms(['5197772459'], 'Cancelling orders');

        // cancel open
        await ftx.cancelOrder(this.openOrder);

        // market close open positions, if existing
        if(this.openOrder.filledSize) {
            let order = {
                market: this.market,
                side: this.side === 'buy' ? 'sell' : 'buy',
                price: null,
                type: "market",
                size: this.openOrder.filledSize,
                reduceOnly: true,
            };
            
            // TODO make sure this actually cancels!
            this.closeOrder = await ftx.query({ method: 'POST', path: '/orders', body: order, authRoute: true });
        }

        // cancel trail
        if(this.trailOrder) {
            await ftx.cancelOrder(this.trailOrder);
        }
    }

    updateTrailPct() {
        let deltaS = moment().diff(this.reduceTrailAtMoment, 'seconds');
        let reduceMap = {
            120: 2,
            60: 1.5,
            30: 1.25,
            0: 1.125
        };

        let newTrailPct = this.initialTrailPct;
        for (let interval in reduceMap) {
            if (deltaS > interval) {
                newTrailPct /= reduceMap[interval];
            }
        }

        this.trailPct = newTrailPct;
    }
}
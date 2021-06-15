require("dotenv").config({ path: "../.env" });
const ftx = require("./ftx");
const twilio = require('./twilio');
const fs = require("fs");

module.exports = class RebalanceTrader {
    // will fetch all token info if no tokenNames array passed in
    constructor(requestedMarkets = [], minVolume24 = 500 * 1000, minRebalanceSizeUsd = 50 * 1000) {
        this.minVolume24 = minVolume24;
        this.minRebalanceSizeUsd = minRebalanceSizeUsd;
        this.requestedMarkets = requestedMarkets;
        this.rebalanceInfo;
        this.initiated = false;
        this.aggOrderAmounts = {};
        this.tokenData = {};
        this.marketStats = {};
        this.orders = [];
    }

    async init() {
        this.initiated = true;
        await this.loadTokenData();
        await this.loadMarketStats();

        this.addRebalanceCalcsToTokenData();
        this.loadAggOrderAmounts();

        //   await this.loadRebalanceInfo();
    }

    async loadTokenData() {
        let data = await ftx.query({ path: `/lt/tokens` });
        this.tokenData = data.result.reduce((acc, data) => {
            if (
                this.requestedMarkets.length &&
                !this.requestedMarkets.includes(data.underlying)
            )
                return acc;

            acc[data.name] = data;
            return acc;
        }, {});
    }

    async addRebalanceCalcsToTokenData() {
        for (let name in this.tokenData) {
            // modify the object in place
            let data = this.tokenData[name];

            data.desiredPosition =
                (data.leverage * data.totalNav) / data.underlyingMark;
            data.currentPosition =
                data.positionsPerShare[data.underlying] * data.outstanding; // data.pricePerShare; // ie: data.basket.USD + data.positionPerShare * data.underlyingMark;
            data.rebalanceSize =
                (data.desiredPosition - data.currentPosition) * data.underlyingMark;
        }
    }

    async loadMarketStats() {
        let marketsList = await ftx.getMarkets();
        this.marketStats = marketsList.reduce((acc, market) => {
            if (
                Object.values(this.tokenData).findIndex(
                    (td) => td.underlying === market.name
                ) === -1
            )
                return acc;

            acc[market.name] = market;
            return acc;
        }, {});
    }

    async loadRebalanceInfo() {
        let data = await ftx.query({ path: `/lt/rebalance_info` });
        this.rebalanceInfo = data.result;
    }

    async loadAggOrderAmounts() {
        for (let token of Object.values(this.tokenData)) {
            if (!this.aggOrderAmounts[token.underlying])
                this.aggOrderAmounts[token.underlying] = { underlying: token.underlying, rebalanceAmountUsd: 0 };

            this.aggOrderAmounts[token.underlying].rebalanceAmountUsd +=
                token.rebalanceSize || 0;
        }

        for (let underlying in this.aggOrderAmounts) {
            let aggData = this.aggOrderAmounts[underlying];
            if (!this.marketStats[underlying]) {
                // console.log('unable to find ' + underlying);
                continue;
            }

            aggData.rebalanceRatio = Math.abs(aggData.rebalanceAmountUsd / this.marketStats[underlying].volumeUsd24h); // rebalance as a percent of past 24h volume 
        }
    }

    getAggData(sortProp = "rebalanceRatio") {
        let data = Object.values(this.aggOrderAmounts)
            .filter(aggData => {
                return this.marketStats[aggData.underlying] &&
                    this.marketStats[aggData.underlying].volumeUsd24h >= this.minVolume24 &&
                    aggData.rebalanceAmountUsd >= this.minRebalanceSizeUsd
            })
            .sort((a, b) => {
                return a[sortProp] > b[sortProp] ? 1 : -1;
            });

        // console.log(data);
        // fs.writeFileSync('rebalanceAmounts.json', JSON.stringify(data));
        return data.reverse();
    }

    async sendRebalanceInfo(numbers = []) {
        let bestIdeas = this.getAggData()
            .slice(0, 10)
            .map(rebal => {
                console.log(rebal)
                return `${rebal.underlying} - ${rebal.rebalanceAmountUsd > 0 ? 'BUY' : 'SELL'} $${Math.round(rebal.rebalanceAmountUsd)} (${Math.round(rebal.rebalanceRatio * 1000) / 10}%)`
            }).join('\n');

        // twilio.sendSms(numbers, bestIdeas)
        console.log(`Sent\n\n${bestIdeas}`);
    };

    async placeMidOrders({ leverage = 1, positions = 10 }) {
        let account = await ftx.getAccount();
        let collateral = account.result.freeCollateral;
        let orderPromises = this.getAggData()
            .slice(0, positions)
            .map(async data => {
                let orderbook = await ftx.getOrderBook(data.underlying);
                let limit = (orderbook.result.bid + orderbook.result.ask) / 2;
                let amountUsd = leverage * collateral / positions;
                let size = amountUsd / limit;
                let side = data.rebalanceAmountUsd > 0 ? "buy" : "sell";
                let otherSide = side === "buy" ? "sell" : "buy";
                let trailPct = 0.01;

                let order = {
                    "market": data.underlying,
                    "side": side,
                    "price": limit,
                    "type": "limit",
                    "size": size,
                };

                let triggerOrder = {
                    "market": data.underlying,
                    "side": otherSide,
                    "trailValue": side === "buy" ? -1 * limit * trailPct : limit * trailPct,
                    "size": size,
                    "type": "trailingStop",
                    "reduceOnly": true,
                };

                let res = await ftx.query({ method: 'POST', path: '/orders', body: order, authRoute: true });
                let triggerRes = await ftx.query({ method: 'POST', path: '/conditional_orders', body: triggerOrder, authRoute: true });
                console.log(res);
                return res.result;
            });

        this.orders = await Promise.all(orderPromises);
    }
};
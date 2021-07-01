require("dotenv").config({ path: "../.env" });
const ftx = require("./ftx");
const twilio = require('./twilio');
const moment = require('moment');
const utils = require('./utils');
const fs = require("fs");

module.exports = class RebalanceTrader {
    // will fetch all token info if no tokenNames array passed in
    constructor({ requestedMarkets = [], minVolume24 = 1000 * 1000, minRebalanceSizeUsd = 200 * 1000 } = {}) {
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

            data.desiredPosition = (data.leverage * data.totalNav) / data.underlyingMark;
            data.currentPosition = data.positionsPerShare[data.underlying] * data.outstanding;
            data.rebalanceSize = (data.desiredPosition - data.currentPosition) * data.underlyingMark;
        }
    }

    async loadMarketStats() {
        // let data = await ftx.query({ path: `/markets` });
        // console.log(data);
        // let marketsList = data.result;
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
        this.rebalanceInfo = JSON.parse(data.result);
    }

    async loadAggOrderAmounts() {
        this.aggOrderAmounts = {};
        for (let token of Object.values(this.tokenData)) {
            if (!this.aggOrderAmounts[token.underlying]) {
                this.aggOrderAmounts[token.underlying] = {
                    underlying: token.underlying,
                    rebalanceAmountUsd: 0
                };
            }

            this.aggOrderAmounts[token.underlying].rebalanceAmountUsd += token.rebalanceSize || 0;
        }

        for (let underlying in this.aggOrderAmounts) {
            let aggData = this.aggOrderAmounts[underlying];
            if (!this.marketStats[underlying]) {
                // console.log('unable to find ' + underlying);
                continue;
            }

            // rebalance as a percent of past 24h volume 
            aggData.rebalanceRatio = Math.abs(aggData.rebalanceAmountUsd / this.marketStats[underlying].volumeUsd24h);
        }
    }

    getAggData(sortProp = "rebalanceRatio") {
        let data = Object.values(this.aggOrderAmounts)
            .filter(aggData => {
                // remove low volume/rebalance size tokens
                return this.marketStats[aggData.underlying] &&
                    Math.abs(this.marketStats[aggData.underlying].volumeUsd24h) >= this.minVolume24 &&
                    Math.abs(aggData.rebalanceAmountUsd) >= this.minRebalanceSizeUsd
    
            })
            .sort((a, b) => {
                return a[sortProp] > b[sortProp] ? 1 : -1;
            });

        // console.log(data);
        // fs.writeFileSync('rebalanceAmounts.json', JSON.stringify(data)); // DON'T save this anywhere other than /data
        return data.reverse();
    }

    getAggDataByMarket(market) {
        return this.getAggData().find(ad => ad.underlying === market);
    }

    async sendRebalanceInfo(numbers = []) {
        let bestIdeas = this.getAggData()
            .slice(0, 10)
            .map(rebal => {
                return `${rebal.underlying} - ${rebal.rebalanceAmountUsd > 0 ? 'BUY' : 'SELL'} $${Math.round(rebal.rebalanceAmountUsd)} (${Math.round(rebal.rebalanceRatio * 1000) / 10}%)`
            }).join('\n');

        twilio.sendSms(numbers, bestIdeas)
        console.log(`Sent\n\n${bestIdeas}`);
    };

    async placeMidOrders({ leverage = 1, positions = 10, trailPct = 0.01 }) {
        let account = await ftx.getAccount();
        let collateral = account.freeCollateral;

        let rebalanceData = this.getAggData().slice(0, positions);
        for (let data of rebalanceData) {
            let orderbook = await ftx.getOrderBook(data.underlying);
            let limit = (orderbook.result.bid + orderbook.result.ask) / 2;
            let amountUsd = leverage * collateral / positions;
            let size = amountUsd / limit;
            let side = data.rebalanceAmountUsd > 0 ? "buy" : "sell";

            let order = {
                "market": data.underlying,
                "side": side,
                "price": limit,
                "type": "limit",
                "size": size,
            };

            let res = await ftx.query({ method: 'POST', path: '/orders', body: order, authRoute: true });
            console.log(res);
            this.orders.push(res.result);
            await utils.wait(100);
        }
    }

    async test() {
        await this.loadRebalanceInfo();
        this.rebalanceInfo = JSON.parse(this.rebalanceInfo);
        for (let key of Object.keys(this.rebalanceInfo)) {
            let rebalanceInfo = this.rebalanceInfo[key];
            let startTime = moment().hour(20).minute(2).seconds(0).add(4, 'hours');
            if (startTime.format("YYYY-MM-DD HH-mm") !== moment(rebalanceInfo.time).format("YYYY-MM-DD HH-mm")) continue;

            let tokenInfo = this.tokenData[key];
            let marketInfo = this.marketStats[tokenInfo.underlying];
            // console.log(rebalanceInfo);
            // console.log(tokenInfo);
            // console.log(marketInfo);

            if (!marketInfo) continue;

            let orderSize = rebalanceInfo.orderSizeList.reduce((size, sl) => sl + size, 0);
            let rebalanceUsd = orderSize * marketInfo.last;
            if (rebalanceUsd < 100000) continue;

            let usdPerSecond = 4 * 1000 * 1000 / 60;
            let expectedSeconds = rebalanceUsd / usdPerSecond;
            let expectedFinishMoment = moment(startTime).add(expectedSeconds, 'seconds');
            let actualFinishMoment = moment(rebalanceInfo.time);
            let secondsDifference = actualFinishMoment.diff(expectedFinishMoment, 'seconds');
            let data = {
                token: tokenInfo.name,
                market: marketInfo.name,
                side: rebalanceInfo.side,
                rebalanceUsd,
                sellingSpeed: rebalanceUsd / (secondsDifference + expectedSeconds),
                secondsDifference,
                ecpectedFinish: expectedFinishMoment.format('HH:mm:ss'),
                actualFinish: actualFinishMoment.format('HH:mm:ss'),
            };

            // if(data.market === 'ETH-PERP') 
            console.log(data);
        }
    }
};
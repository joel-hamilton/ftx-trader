require("dotenv").config({ path: "../.env" });
const ftx = require("./ftx");
const fs = require("fs");

module.exports = class RebalanceTrader {
  // will fetch all token info if no tokenNames array passed in
  constructor(requestedMarkets = [], minVolume24 = 0) {
    this.minVolume24 = minVolume24;
    this.requestedMarkets = requestedMarkets;
    this.rebalanceInfo;
    this.initiated = false;
    this.aggOrderAmounts = {};
    this.tokenData = {};
    this.marketStats = {};
  }

  async init() {
    this.initiated = true;
    console.log('Fetching token data');
    await this.loadTokenData();
    console.log('Fetching market stats');
    await this.loadMarketStats();

    console.log('Adding rebalance calcs ');
    this.addRebalanceCalcsToTokenData();
    console.log('loading aggregate order amounts');
    this.loadAggOrderAmounts();

    //   await this.loadRebalanceInfo();

    console.log('DONE');
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
        console.log('unable to find ' + underlying);
        continue;
      }

      aggData.rebalanceRatio = Math.abs(aggData.rebalanceAmountUsd / this.marketStats[underlying].volumeUsd24h); // rebalance as a percent of past 24h volume 
    }
  }

  getAggData(sortProp = "rebalanceRatio") {
    let data = Object.values(this.aggOrderAmounts)
      .filter(aggData => {
        // console.log(aggData.underlying)
        // console.log(this.marketStats[aggData.underlying]);
        return this.marketStats[aggData.underlying] &&
        this.marketStats[aggData.underlying].volumeUsd24h >= this.minVolume24
      })
      .sort((a, b) => {
        return a[sortProp] > b[sortProp] ? 1 : -1;
      });

      console.log(data);
      // fs.writeFileSync('rebalanceAmounts.json', JSON.stringify(data));
      return data;
  }
};

/*
THE PLAN
9:50
run:
node
rt = require('./rebalanceTrader');r = new rt('BULL');r.calculateRebalanceAmt();

 */

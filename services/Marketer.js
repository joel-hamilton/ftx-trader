let marketsList = require('../data/marketsList');

module.exports = class Marketer {
    constructor(text) {
        this.text = text.trim().toUpperCase();
        this.mentionedMarkets = this._getMentionedMarkets()
    }

    mentionedMarketsFiltered() {
        return this.mentionedMarkets.filter(mm => {
            // we only match markets if there's a single ticker listed, but these are sometimes used as pairs comparison eg: CRV/BTC 
            return !['BTC', 'ETH'].includes(mm.underlying);
        });
    }

    getMarketInfo() {
        if(this.mentionedMarketsFiltered.length !== 1) return {};

        let market = this.mentionedMarkets[0];
        return {
            market: market.name,
            volumeUsd24h: market.volumeUsd24h,
        }
    }

    _getMentionedMarkets() {
        let mentionedMarkets = [];
        for (let market of marketsList) {
            if (this.text.includes(`$${market.underlying}`)) mentionedMarkets.push(market);
        }

        return mentionedMarkets;
    }
}
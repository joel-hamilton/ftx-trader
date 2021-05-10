let marketsList = require('../data/marketsList');

module.exports = class Marketer {
    constructor(text) {
        this.text = text.trim().toUpperCase();
        this.mentionedMarkets = this._getMentionedMarkets()
    }

    get mentionedMarketsFiltered() {
        return this.mentionedMarkets.filter(mm => {
            // we only match markets if there's a single ticker listed, but these are sometimes used as pairs comparison eg: CRV/BTC 
            if(['BTC', 'ETH'].includes(mm.underlying)) return false;
            
            // only include xxx-PERP markets
            let chunks = mm.name.split('-');
            if(chunks.length !== 2 || chunks[1] !== 'PERP') return false;

            return true
        });
    }

    getMarketInfo() {
        if(this.mentionedMarketsFiltered.length !== 1) return {};

        let market = this.mentionedMarketsFiltered[0];
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
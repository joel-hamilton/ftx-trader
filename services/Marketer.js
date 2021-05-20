let marketsList = require('../data/marketsList');

module.exports = class Marketer {
    constructor(text, username) {
        this.text = text.trim().toUpperCase();
        this.username = username;
        this.mentionedMarkets = this.getMentionedMarkets()
    }

    get mentionedMarketsFiltered() {
        return this.mentionedMarkets.filter(mm => {
            // we only match markets if there's a single ticker listed, but these are sometimes used as pairs comparison eg: CRV/BTC 
            if (['BTC', 'ETH'].includes(mm.underlying)) return false;

            // only include xxx-PERP markets
            let chunks = mm.name.split('-');
            if (chunks.length !== 2 || chunks[1] !== 'PERP') return false;

            return true
        });
    }

    get market() {
        return this.info.market ? this.info.market : '';
    }

    get info() {
        if (this.mentionedMarketsFiltered.length !== 1) return {};

        let market = this.mentionedMarketsFiltered[0];
        return {
            market: market.name,
            underlying: market.underlying,
            volumeUsd24h: market.volumeUsd24h,
        }
    }

    getMentionedMarkets() {
        let mentionedMarkets = [];
        for (let market of marketsList) {
            let match = new RegExp(String.raw`\$${market.underlying}($|\W)`, 'gi');
            if (this.text.toUpperCase().match(match)) {
                let existing = mentionedMarkets.find(mm => mm.name === market.name);
                if (!existing) mentionedMarkets.push(market);
            }
        }

        if (this.username === 'elonmusk' && this.text.split(' ').includes('DOGE')) {
            if (!mentionedMarkets.includes['DOGE-PERP']) {
                // get the DOGE market
                let doge = marketsList.find(m => m.name === 'DOGE-PERP');
                mentionedMarkets.push(doge);
            }
        }

        return mentionedMarkets;
    }
}
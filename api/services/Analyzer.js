const db = require('./db');
const twitter = require('./twitter');
const ftx = require('./ftx');
const marketsList = require('../data/marketsList');
const moment = require('moment');
require('moment-round');

class Analyzer {
    constructor(params) {
        this.params = params;
        this.tweets = [];
    }

    async analyze() {
        let { rows } = await db.pool.query("SELECT * FROM tweets WHERE market IS NOT NULL AND market_history != '[]' ORDER BY date DESC");
        let tweets = [];

        // rows = [rows[0]]

        for (let tweet of rows) {
            // TODO allow passing in arbitrary lengths
            let tweetTime = moment(tweet.date).round(15, 'seconds');
            let mid = tweet.market_history.findIndex(mh => moment(mh.startTime).isSame(tweetTime)); // begin at the 15 second interval before
            tweet.market_history = tweet.market_history.slice(mid - 60, mid + 60)

            let priceVolumeChanges = this.getPriceVolChanges(moment(tweet.date), tweet.market_history);
            // delete tweet.market_history;

            let market = marketsList.find(m => m.name === tweet.market);

            tweet = { ...tweet, diffs: priceVolumeChanges, market }
            tweets.push(tweet);
        }

        if (this.params.sortBy === 'price') {
            tweets.sort((a, b) => parseFloat(a.diffs.price.average) > parseFloat(b.diffs.price.average) ? -1 : 1);
        } else if (this.params.sortBy === 'volume') {
            tweets.sort((a, b) => parseFloat(a.diffs.volume.average) > parseFloat(b.diffs.volume.average) ? -1 : 1);
        }

        this.tweets = tweets.splice(this.params.from, this.params.to - this.params.from);


        return this.tweets;
    }

    async getOrderBooks() {
        let promises = marketsList.filter(mkt => mkt.name.includes("PERP")).map(mkt => ftx.getOrderBook(mkt.name));
        let res = await Promise.all(promises);
        return res;
        // let orderbook = await ftx.getOrderBook('HNT-PERP');
        // return [orderbook];
    }

    getPriceVolChanges(tweetTime, marketHistory) {
        tweetTime = moment(tweetTime).round(15, 'seconds');
        let startIndex = marketHistory.findIndex(mh => moment(mh.startTime).isSame(tweetTime)) - 1; // begin at the 15 second interval before

        let volumePeriods = 20;
        let avgPrevVolume = marketHistory.slice(startIndex - volumePeriods, startIndex).reduce((total, data) => total + data.volume, 0) / volumePeriods;

        let data = {
            price: { // price difference vs 0th min
                "s15    ": diff(marketHistory[startIndex].close, marketHistory[startIndex + 1].close),
                "s30    ": diff(marketHistory[startIndex].close, marketHistory[startIndex + 2].close),
                "s45    ": diff(marketHistory[startIndex].close, marketHistory[startIndex + 3].close),
                "s60    ": diff(marketHistory[startIndex].close, marketHistory[startIndex + 4].close),
                "s75    ": diff(marketHistory[startIndex].close, marketHistory[startIndex + 5].close),
                "s90    ": diff(marketHistory[startIndex].close, marketHistory[startIndex + 6].close),
                "s105   ": diff(marketHistory[startIndex].close, marketHistory[startIndex + 7].close),
                "s120   ": diff(marketHistory[startIndex].close, marketHistory[startIndex + 7].close)
            },
            volume: { // volume difference vs avg of previous 5 mins
                "s15    ": diff(avgPrevVolume, marketHistory[startIndex + 1].volume),
                "s30    ": diff(avgPrevVolume, marketHistory[startIndex + 2].volume),
                "s45    ": diff(avgPrevVolume, marketHistory[startIndex + 3].volume),
                "s60    ": diff(avgPrevVolume, marketHistory[startIndex + 4].volume),
                "s75    ": diff(avgPrevVolume, marketHistory[startIndex + 5].volume),
                "s90    ": diff(avgPrevVolume, marketHistory[startIndex + 6].volume),
                "s105   ": diff(avgPrevVolume, marketHistory[startIndex + 7].volume),
                "s120   ": diff(avgPrevVolume, marketHistory[startIndex + 8].volume),
            }
        }

        data.price.average = Object.keys(data.price).reduce((total, key) => total + data.price[key], 0) / Object.keys(data.price).length;
        data.volume.average = Object.keys(data.volume).reduce((total, key) => total + data.volume[key], 0) / Object.keys(data.volume).length;

        for (let diff in data) {
            for (let s in data[diff]) {
                let pctDiff = ((data[diff][s] * 10000) / 100).toFixed(2) + "%";
                data[diff][s] = pctDiff.padStart(10, ' ');
            }
        }

        return data;

        function diff(start, end) {
            return (end - start) / start;
        }
    }
}

if (require.main === module) { // called from cli
    //    
} else {
    module.exports = { Analyzer }
}

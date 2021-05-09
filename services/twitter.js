require('dotenv').config()
const moment = require('moment');
const fetch = require('node-fetch');
const https = require('https');
const marketsList = require('../data/marketsList');
const sentimentList = require('../data/sentimentList');
const searchParams = require('../data/searchParams');
const ftx = require('./ftx')
const twilio = require('./twilio');
const Sentimental = require('./Sentimental');

async function query({ path, url = 'https://api.twitter.com', method = 'GET', body = null, onChunk = null }) {
    let headers = {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER}`
    };

    let options = {
        method,
        headers,
    };

    if (body) options.body = JSON.stringify(body);

    if (onChunk) {
        options.timeout = 0;
        options.agent = new https.Agent({
            keepAlive: true
        });
    } else {
        headers['Content-Type'] = 'application/json';
    }

    console.log(`${url}${path}`);
    console.log(options);
    let response = await fetch(`${url}${path}`, options);

    if (onChunk) {
        let lastChunk = Date.now();
        let interval = setInterval(() => {
            if (Date.now() - lastChunk > 60000) {
                console.log("NO HEARTBEAT");
                twilio.sendSms('Twitter disconnected');
                clearInterval(interval);
            }
        }, 60000);

        response.body.on('data', (chunk) => {
            lastChunk = Date.now();
            if (!chunk.toString().trim()) {
                // console.log(new Date())
                return; // heartbeat
            }

            let json;
            try {
                json = JSON.parse(chunk.toString());
                onChunk(json)
            } catch (e) {
                console.log(chunk)
                console.log(e);
            }
        });
    } else {
        let json = await response.json();
        if (!json) {
            console.log(response);
            throw new Error('Error in Twitter request');
        }

        return json;
    }
}

async function getTweetSample() {
    let q = searchParams.rules[0].value;
    let tweets = [];
    for (let i = 0; i < 160; i = i + 12) {
        let start = moment().subtract(10, 'seconds').subtract(i + 1, 'hours');
        let end = moment().subtract(10, 'seconds').subtract(i, 'hours');

        let res = await searchTweets({ q, start, end });

        // console.log(res)
        for (let tweet of res.data) {
            let data = processTweet(tweet, res.includes);
            tweets.push(data);
        }
    }

    tweets = tweets.filter(tweet => tweet.market)

    console.log(tweets);
    return tweets;
}

async function backTest() {
    let tweets = await getTweetSample();
    let historicalData = [];

    for (let data of tweets) {

        if (data.market) {
            let now = moment();
            let createdAt = moment(data.created_at);
            let start = moment(createdAt).subtract(1, 'hour');
            let end = moment(createdAt).add(1, 'hour');
            if (end.isAfter(now)) end = now;

            let priceData = await ftx.getData({ market: data.market, resolution: 15, start: start.valueOf(), end: end.valueOf() });
            historicalData.push({
                header: `${tweet.created_at} - ${tweet.username} ${tweet.text}`,
                times: priceData.result.map(r => r.startTime),
                prices: priceData.result.map(r => r.close),
                volume: priceData.result.map(r => r.volume),
            });
        }
    }

    return historicalData;
}

async function beginStream() {
    await updateRules();
    await query({
        path: `/2/tweets/search/stream?${searchParams.queryString}`, onChunk: async (chunk) => {
            if (!chunk.data) {
                console.log("IRREGULAR CHUNK")
                console.log(chunk)
                return;
            }

            let data = processTweet(chunk.data, chunk.includes);
            console.log(data);

            if (data.market && data.sentiment >= 0.1) {
                // let buy = false;
                // if (data.positiveWords.length && data.volumeUsd24h < 250 * 1000 * 1000) buy = true;
                // if (data.positiveWords.length && data.username === 'CryptoKaleo' && data.volumeUsd24h < 350 * 1000 * 1000) buy = true;
                // if (data.username === 'elonmusk' && data.text.includes('doge')) {
                //     data.market = 'DOGE-PERP';
                //     buy = true;
                // }

                // if (buy) {
                    console.log("TRIGGER THE BUY")
                    await ftx.signalOrder({ market: data.market, signalTweet: data });
                }
            // }
        }
    });
}

function processTweet(tweet, includes) {
    let mentionedMarkets = [];
    let positiveWords = [];
    let text = tweet.text.toUpperCase();

    marketsListFiltered = marketsList.filter(m => {
        // we only match markets if there's a single ticker listed, but these are sometimes used as pairs comparison eg: CRV/BTC 
        return !['BTC', 'ETH'].includes(m.underlying);
    });

    for (let market of marketsListFiltered) {
        let marketMatch;

        // match on symbol name
        if (text.includes(`$${market.underlying}`)) marketMatch = market;

        if (marketMatch) {

            mentionedMarkets.push(marketMatch)
        }
    }

    let sentimental = new Sentimental(text, mentionedMarkets.length === 1 ? mentionedMarkets[0] : null);

    return {
        text: tweet.text,
        username: includes.users.find(u => u.id === tweet.author_id).username,
        created_at: moment(tweet.created_at).format('YYYY-MM-DD HH:mm:ss'),
        // ...sentiment.analyze(tweet.text, { extras: sentimentList }),
        market: mentionedMarkets.length === 1 ? mentionedMarkets[0].name : null,
        volumeUsd24h: mentionedMarkets.length === 1 ? mentionedMarkets[0].volumeUsd24h : null,
        positiveWords: sentimental.getPositiveWords(),
        positivePhrases: sentimental.getPositivePhrases(),
        sentiment: sentimental.getScore(),
    }
}

// can search for tweet triggering a spike in vol like this:
async function searchTweets({ q, onlyWithMarkets = false, start, end = moment(start).add(1, 'minute') }) {
    q = encodeURIComponent(q);
    let res = await query({ path: `/2/tweets/search/recent?query=${q}&${searchParams.queryString}&max_results=100&start_time=${moment(start).format()}&end_time=${moment(end).format()}` });
    if (!res.data) return { results: 0 };

    let promises = res.data.map(tweet => processTweet(tweet, res.includes))
    let tweets = await Promise.all(promises);

    if(onlyWithMarkets) tweets = tweets.filter(t => !!t.market);
    return tweets;
}

async function updateRules() {
    // delete all existing rules
    let rules = await query({ path: '/2/tweets/search/stream/rules' });
    if (rules.data) {
        let ids = rules.data.map(r => r.id);
        await query({ method: 'POST', path: '/2/tweets/search/stream/rules', body: { "delete": { ids } } })
    }

    let updatedRules = await query({ method: 'POST', path: '/2/tweets/search/stream/rules', body: { "add": searchParams.rules } });
    return updatedRules;
}

module.exports = {
    backTest,
    beginStream,
    getTweetSample,
    updateRules,
    searchTweets,
}
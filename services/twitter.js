require('dotenv').config()
const csvStringify = require('csv-stringify/lib/sync');
const { parse } = require('json2csv');

const utils = require('./utils')


const moment = require('moment');
const fetch = require('node-fetch');
const https = require('https');
const queryString = require('query-string');
const Sentiment = require('sentiment');
const sentiment = new Sentiment();
const sentimentList = require('./sentimentList');
const marketsList = require('./marketsList');
const searchParams = require('./searchParams');
const ftx = require('./ftx')

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
        response.body.on('data', (chunk) => {
            let json;
            json = JSON.parse(chunk.toString());
            onChunk(json)
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

async function getTweetSample(dataFilter = (data) => data.volumeUsd24h < 500 * 1000 * 1000) {
    let q = encodeURIComponent(searchParams.rules[0].value);
    let res = await query({ path: `/2/tweets/search/recent?query=${q}&${searchParams.queryString}&max_results=100` });
    let tweets = [];
    for (let tweet of res.data) {
        tweet.username = res.includes.users.find(u => u.id === tweet.author_id).username;
        let data = processTweet(tweet);

        if (data.market) {
            let marketData = marketsList.find(m => m.name === data.market);
            tweets.push({
                ...tweet,
                volumeUsd24h: marketData.volumeUsd24h,
                underlying: marketData.underlying,
                market: data.market,
            })

        }
    }
    if (typeof dataFilter === 'function') {
        tweets = tweets.filter(dataFilter)
    }

    return tweets;
}

async function backTest() {
    let tweets = await getTweetSample();
    let historicalData = [];

    for (let tweet of tweets) {
        let data = processTweet(tweet);

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
            })

        }
    }

    return historicalData;
}

async function beginStream() {
    await updateRules();
    await query({
        path: `/2/tweets/search/stream?${searchParams.queryString}`, onChunk: async (chunk) => {
            console.log("CHUNK")
            console.log(chunk)
            let data = processTweet(chunk);
            // if(data.market) {
                console.log("TRIGGER")
                console.log(data);
            // }
            // await ftx.signalOrder({ market: data.market });
        }
    });
}

function processTweet(tweet) {
    let tickers = [];

    for (let market of marketsList) {
        let text = tweet.text.toUpperCase();
        if (text.includes(`$${market.underlying}`)) tickers.push(market.name);
    }

    return {
        text: tweet.text,
        username: tweet.username,
        created_at: tweet.created_at,
        // ...sentiment.analyze(tweet.text, { extras: sentimentList }),
        market: tickers.length === 1 ? tickers[0] : null
    }
}

async function updateRules() {
    // delete all existing rules
    let rules = await query({ path: '/2/tweets/search/stream/rules' });
    if (rules.data) {
        let ids = rules.data.map(r => r.id);
        await query({ method: 'POST', path: '/2/tweets/search/stream/rules', body: { "delete": { ids } } })
    }

    await query({ method: 'POST', path: '/2/tweets/search/stream/rules', body: { "add": searchParams.rules } });
    return await query({ path: '/2/tweets/search/stream/rules' });;
}

module.exports = {
    beginStream,
    getTweetSample,
    backTest,
    updateRules,
}
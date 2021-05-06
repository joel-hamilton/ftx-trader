require('dotenv').config()
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
        if (!json || !json.data) {
            console.log(response);
            throw new Error('Error in Twitter request');
        }

        return json;
    }



}
async function test() {
    let q = encodeURIComponent(searchParams.rules[0].value);
    let res = await query({ path: `/2/tweets/search/recent?query=${q}&${searchParams.queryString}&max_results=100` });
    for (let tweet of res.data) {
        tweet.username = res.includes.users.find(u => u.id === tweet.author_id).username;
        await processTweet(tweet);
    }

    return res;
}

async function beginStream() {
    // await updateRules();
    await query({ path: `/2/tweets/search/stream?${searchParams.queryString}`, onChunk: processTweet });
}

async function processTweet(tweet) {
    let tickers = [];
    for (let market of marketsList) {
        let text = tweet.text.toUpperCase();
        if (text.includes(`$${market.underlying}`) || text.includes(` ${market.underlying} `)) tickers.push(market.underlying);
    }

    if (tickers.length !== 1) return;

    data = {
        text: tweet.text,
        username: tweet.username,
        ...sentiment.analyze(tweet.text, { extras: sentimentList })
    }
    console.log(`MATCH ON ${tickers.join(', ')}`)
    console.log(data)

    let buy = false;
    if (buy) {
        await ftx.signalOrder({market: market.name})
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
    test,
    updateRules,
}
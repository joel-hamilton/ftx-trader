require('dotenv').config()
const fetch = require('node-fetch');
const https = require('https');
const moment = require('moment');

const Marketer = require('./Marketer');
const Sentimental = require('./Sentimental');
const searchParams = require('../data/searchParams');
const ftx = require('./ftx')
const twilio = require('./twilio');
const utils = require('./utils.js');

let reconnectWait = 1000;

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
    // console.log(options);
    let response = await fetch(`${url}${path}`, options);

    if (onChunk) { // streaming connection
        let lastChunk = Date.now();

        // check for heartbeat
        // TODO restart connection if missing
        let interval = setInterval(async () => {
            if (Date.now() - lastChunk > 30000) {
                console.log("NO HEARTBEAT");
                clearInterval(interval);

                reconnectWait *= 2;

                if (reconnectWait > 60 * 1000) {
                    console.log('Connection dropped');
                    twilio.sendSms('Twitter disconnected');
                }

                await utils.wait(reconnectWait);
                console.log('reconnecting...' + reconnectWait + 'ms');
                return query({ path, url, method, body, onChunk });
            }
        }, 30000);

        response.body.on('error', (err) => {
            console.log("ERROR!")
            console.log(err)
            twilio.sendSms(err.message);
        });

        response.body.on('data', (chunk) => {
            lastChunk = Date.now();

            try {
                let json = JSON.parse(chunk.toString());
                if (json.data) {
                    reconnectWait = 1000;
                }

                onChunk(json)
            } catch (e) {
                // heartbeat
            }
        });
    } else { // regular request
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

    // console.log(tweets);
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
    console.log('Beginning Stream')
    await query({
        path: `/2/tweets/search/stream?${searchParams.fieldsQueryString}`, onChunk: async (chunk) => {
            if (!chunk.data) {
                console.log("IRREGULAR CHUNK")
                console.log(chunk)
                return;
            }

            let data = processTweet(chunk.data, chunk.includes);

            if (data.market) console.log(data);

            if (data.buy) {
                console.log("TRIGGER THE BUY")
                await ftx.signalOrder(data);
            }
        }
    });
}

function processTweet(tweet, includes) {
    let tweetData = {
        text: tweet.text.trim().toLowerCase(),
        username: includes.users.find(u => u.id === tweet.author_id).username,
        created_at: moment(tweet.created_at).format('YYYY-MM-DD HH:mm:ss'),
    }

    let marketer = new Marketer(tweetData.text, tweetData.username);
    let sentimental = new Sentimental(tweetData.text, tweetData.username, marketer.info.underlying);

    tweetData = { ...tweetData, ...marketer.info, ...sentimental.info };

    return {
        ...tweetData,
        ...getBuyInfo(tweetData)
    }
}

function getBuyInfo(data) {
    let scale = 0;             // 0-10, with option to increase up to max
    let scaleAdjustments = []; // explain how scale was arrived at

    if (!data.market) return { buy: false, scale, scaleAdjustments };

    // // basic includes if market < $250m volume, or if influential user and <$350 volume
    // if (data.sentiment > 0.5 && data.volumeUsd24h < 250 * 1000 * 1000) {
    //     scale += 1;
    //     scaleAdjustments.push('volume < $250m');
    // }

    // low volume market, potentially larger swings
    if (data.sentiment > 0.2 && data.volumeUsd24h < 150 * 1000 * 1000) {
        scale += 2;
    }

    // exceptionally low volume market, don't require much sentiment
    if (data.sentiment && data.volumeUsd24h < 50 * 1000 * 1000) {
        scale += 2;
        scaleAdjustments.push('volume <20m');
    }

    // // clearly positive message
    // TODO need market size filter on here if re-enabled
    // if (data.sentiment >= 1.5) {
    //     scale += 2;
    //     scaleAdjustments.push('high sentiment')
    // }

    // stupid Elon filter, go big on whatever he mentions
    // doge doesn't need to be a cash tag, Marketer will pick up just the word
    // no need for sentiment
    if (data.username === 'elonmusk') {
        scale = 100;
        scaleAdjustments.push('Elon tweet')
    }

    // TEMP
    if(data.username === 'stoolpresidente') {
        scale = 10;
        scaleAdjustments.push('stoolpresidente tweet')
    }

    return { buy: scale > 0, scale, scaleAdjustments };
}

// can search for tweet triggering a spike in vol like this:
async function searchTweets({ addMarketData = false, q, onlyWithMarkets = false, onlyBuys = false, useRules = false, start, end = moment(start).add(1, 'minute') }) {
    // if(useRules) q += ` ${searchParams.rulesQueryString}`; // works, but makes the query too long, will need to split into several queries, probably not worth the effort
    q = encodeURIComponent(q);
    let res = await query({ path: `/2/tweets/search/recent?query=${q}&${searchParams.fieldsQueryString}&max_results=100&start_time=${moment(start).format()}&end_time=${moment(end).format()}` });
    if (!res.data) {
        console.log(res);
        return [];
    }

    let promises = res.data.map(tweet => processTweet(tweet, res.includes))
    let tweets = await Promise.all(promises);

    if (onlyWithMarkets) tweets = tweets.filter(t => !!t.market);
    if (onlyBuys) tweets = tweets.filter(t => t.buy);

    // add data on subsequent market action
    // tweets = tweets.map(t => {
    // if (t.market) {
    //     t.priceChange = await ftx.getChangesInMarketPrice(t.market, moment(t.created_at).subtract(15, 'seconds'), moment(t.created_at).add(1, 'minute'))
    // }

    //     return t;
    // })

    if (addMarketData) {
        let tweetPromises = tweets.map(async t => {
            if (t.market) {
                t.priceChange = await ftx.getChangesInMarketPrice(t.market, moment(t.created_at).subtract(15, 'seconds'), moment(t.created_at).add(5, 'minute'));
            }

            return t;
        });
        tweets = await Promise.all(tweetPromises);
    }

    return tweets;
}

async function updateRules() {
    console.log('updating')
    // delete all existing rules
    let rules = await query({ path: '/2/tweets/search/stream/rules' });
    if (rules.data) {
        let ids = rules.data.map(r => r.id);
        await query({ method: 'POST', path: '/2/tweets/search/stream/rules', body: { "delete": { ids } } })
    }

    console.log(searchParams.rules);
    let updatedRules = await query({ method: 'POST', path: '/2/tweets/search/stream/rules', body: { "add": searchParams.rules } });
    console.log('Updated rules:');
    console.log(updatedRules);
    return updatedRules;
}

if (require.main === module) { // called from cli
    let args = process.argv.slice(2);
    if (args.includes('update')) {
        (async function() {
            await updateRules();
            console.log('Updated Twitter rules');
        })();
    }
}

module.exports = {
    backTest,
    beginStream,
    getTweetSample,
    updateRules,
    searchTweets,
}
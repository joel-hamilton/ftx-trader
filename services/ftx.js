require('dotenv').config({path: '../.env'})
const fs = require('fs')
const path = require('path');
const moment = require('moment');
const fetch = require('node-fetch');
const constants = require('../data/constants');

const twilio = require('./twilio');

async function query({ path, url = 'https://ftx.com/api', method = 'GET', body = null, authRoute = false }) {
    let ts = Date.now();
    let headers = {
        'content-type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    if (authRoute) {
        let payload = [
            ts,
            method,
            `/api${path}`
        ];

        if (body) payload.push(JSON.stringify(body));

        let signature = require('crypto')
            .createHmac('sha256', process.env.FTX_SECRET)
            .update(payload.join(''))
            .digest('hex');

        headers['FTX-TS'] = ts;
        headers['FTX-KEY'] = process.env.FTX_KEY;
        headers['FTX-SIGN'] = signature;
    }

    let options = {
        method,
        headers
    };

    if (body) options.body = JSON.stringify(body);

    console.log(`${url}${path}`)
    // console.log(options)

    let res = await fetch(`${url}${path}`, options);
    return res.json();
}

async function getAccount() {
    return query({ path: '/account', authRoute: true })
}

async function getMarkets(save = false) {
    let data = await query({ path: `/markets` });
    let markets = data.result.filter(m => {
        let chunks = m.name.split('-');
        return chunks.length > 1 && chunks[1] === 'PERP';
    });

    if (save) {
        fs.writeFileSync(path.resolve(__dirname, '../data/marketsList.js'), `module.exports=${JSON.stringify(markets)}`);
    }

    return markets;
}

async function getData({ market, resolution = 15, start, end }) {
    let data = await query({ path: `/markets/${market}/candles?resolution=${resolution}&start_time=${start / 1000}&end_time=${end / 1000}` })

    // TODO calculate RoC on volume and price, see if market is moving from this tweet

    return data;
}

async function getOrderBook(market) {
    return query({ path: `/markets/${market}` });
}

async function getOrderHistory() {
    return query({ path: '/orders/history', authRoute: true })
}

async function getLastOrderTime() {
    let orders = await getOrderHistory();
    let date = orders.result[0].createdAt;
    return (new Date(date)).getTime();
}

async function getChangesInMarketPrice(market, from, to) {
    let minuteChunks = 4;
    let priceData = await getData({ market, resolution: 60 / minuteChunks, start: from.valueOf(), end: to.valueOf() });
    let changesFromMinZero = [];

    // going up one nimute at a time, get percentage change from 0th min
    let startPrice = priceData.result[0].close;
    // // console.log('start ' + startPrice);
    // for (let i = 0; i < priceData.result.length; i += minuteChunks) {
    //     let iPrice= priceData.result[i].close;
    //     // console.log(`i = ${iPrice}`)
    //     let change = 100 * ((iPrice - startPrice) / startPrice);
    //     changesFromMinZero.push({[moment(priceData.result[i].startTime).format("HH:mm:ss")]: change})
    // }    

    for (let i = 0; i < priceData.result.length; i++) {
        let iPrice = priceData.result[i].close;
        // console.log(`i = ${iPrice}`)
        let change = 100 * ((iPrice - startPrice) / startPrice);
        changesFromMinZero.push(Math.round(change * 100) / 100)
    }

    return changesFromMinZero;
}

async function signalOrder({ market, text, username, scale }) {
    // 5 minute minimum
    // let lastOrderTime = await getLastOrderTime();
    // console.log(`LAST ORDER: ${lastOrderTime}`)
    // if (Date.now() - lastOrderTime < 5 * 60 * 1000) {
    //     console.log('Order < 5 mins ago'); // TODO
    //     return;
    // }

    // check total leverage, make sure this isn't running out of control
    // let account = await getAccount();
    // console.log(account); return;
    // let maxAmount = account.result.freeCollateral * 15;
    // if (account.openMarginFraction > 0.5) { // TODO what does this mean?
    // console.log('Account leverage too high');
    // return;
    // }

    // get orderbook
    let ask;
    let limit;
    let trailPercent;

    if (process.env.NODE_ENV === 'test') {
        limit = constants.TEST_MOCK_LIMIT;
        trailPercent = constants.TEST_TRAIL_PERCENT
    } else {
        console.log(market);
        console.log(scale);    
        let orderBook = await getOrderBook(market);
        ask = orderBook.result.ask;
        let spread = (ask - orderBook.result.bid) / ask;
        if(spread > 0.002) {
            console.log(`No buy: bid/ask too wide`)
            console.log(orderBook.result);
            return;
        }

        limit = ask * 1.001;
        trailPercent = -0.01;
    }

    let trailValue = limit * trailPercent;  // 1% trailing stop
    let actualRisk = Math.min(constants.MAX_RISK_DOLLARS, constants.RISK_UNIT_DOLLARS * scale);
    let size = -1 * Math.round((actualRisk / trailPercent / limit) * 1000) / 1000;

    // enforce max $ position size
    if (size * limit > constants.MAX_DOLLAR_AMOUNT) {
        size = constants.MAX_DOLLAR_AMOUNT / limit;
    }

    // buy it!
    // let maxAmount = 25000;
    // let basicAmount = 10000; // scale 0-10 based on this amount TODO grab on update, save in file
    // let amount = Math.min(maxAmount, basicAmount * (scale / 10));
    // let limit = ask * 1.001;             // bid 0.1% over ask
    // let size = amount / limit;
    // let trailValue = limit * -0.02;  // 2% trailing stop

    let initialOrder = {
        "market": market,
        "side": "buy",
        "price": limit,
        "type": "limit",
        "size": size,
    }

    let triggerOrder = {
        "market": market,
        "side": "sell",
        "trailValue": trailValue,
        "size": size,
        "type": "trailingStop",
        "reduceOnly": true,
    }

    if (process.env.NODE_ENV === 'test') return { initialOrder, triggerOrder }

    console.log('placing orders:');
    console.log(initialOrder);
    console.log(triggerOrder);

    let initialRes = await query({ method: 'POST', path: '/orders', body: initialOrder, authRoute: true });
    if (initialRes && initialRes.success) {
        let triggerRes = await query({ method: 'POST', path: '/conditional_orders', body: triggerOrder, authRoute: true });
        if (triggerRes && triggerRes.success) {
            let initial = initialRes.result;
            let trigger = triggerRes.result;
            let summary = `${initial.market} order, scale (${scale}).\n\nBuy ${initial.size}x${initial.market}@${initial.price} ($${Math.round(initial.size * initial.price)} total).\n\nTrailing stop of ${trigger.trailValue} (-$${-1 * Math.round(trigger.trailValue * trigger.size)}).`

            if (username && text) {
                summary += `\n\n@${username} - ${text}`
            }

            await twilio.sendSms(summary);
        } else {
            console.log(triggerRes);
            await twilio.sendSms('Limit order placed, but there was an error placing trigger order.')
        }
    } else {
        console.log(initialRes);
        await twilio.sendSms('There was an error placing an order');
    }
}

async function test() {
    return query({ path: '/time', url: 'https://otc.ftx.com/api' })
}

if (require.main === module) { // called from cli
    let args = process.argv.slice(2);
    if (args.includes('update')) {
        (async function() {
            await getMarkets(true);
            console.log('Markets updated');
        })()
    }
}

module.exports = {
    getAccount,
    getChangesInMarketPrice,
    getData,
    getMarkets,
    getOrderBook,
    getOrderHistory,
    getLastOrderTime,
    query,
    signalOrder,
    test
}

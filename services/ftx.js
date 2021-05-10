const fs = require('fs')
const path = require('path');
const moment = require('moment');
const fetch = require('node-fetch');

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
    console.log(options)

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

async function getData({ market, resolution = 15, start = moment().subtract(1, 'day').valueOf() }, end = moment().valueOf()) {
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

async function signalOrder({ market, tweetData, scale = 1 }) {
    console.log(market);
    console.log(scale);

    // 5 minute minimum
    let lastOrderTime = await getLastOrderTime();
    console.log(`LAST ORDER: ${lastOrderTime}`)
    if (Date.now() - lastOrderTime < 5 * 60 * 1000) {
        console.log('Order < 5 mins ago'); // TODO
        return;
    }

    // check total leverage, make sure this isn't running out of control
    // let account = await getAccount();
    // if (account.openMarginFraction > 0.5) { // TODO what does this mean?
    // console.log('Account leverage too high');
    // return;
    // }

    // get orderbook
    let orderBook = await getOrderBook(market);
    let ask = orderBook.result.ask;

    // buy it!
    // let amount = account.result.freeCollateral / 10
    let amount = 1000 * scale;
    let limit = ask * 1.005;
    let size = amount / limit;
    let trailValue = -1 * limit * 0.005;

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

    console.log('placing orders:');
    console.log(initialOrder);
    console.log(triggerOrder);

    let initialRes = await query({ method: 'POST', path: '/orders', body: initialOrder, authRoute: true });
    if (initialRes && initialRes.success) {
        let triggerRes = await query({ method: 'POST', path: '/conditional_orders', body: triggerOrder, authRoute: true });
        if (triggerRes && triggerRes.success) {
            let initial = initialRes.result;
            let trigger = triggerRes.result;
            let summary = `Orders Placed.\n\nBuy ${initial.size}x${initial.market}@${initial.price} ($${Math.round(initial.size * initial.price)} total).\n\nTrailing stop of ${trigger.trailValue} (-$${-1 * Math.round(trigger.trailValue * trigger.size)}).`

            if (tweetData) {
                summary += `\n\n@${tweetData.username} - ${tweetData.text}`
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

module.exports = {
    getAccount,
    getData,
    getMarkets,
    getOrderBook,
    getOrderHistory,
    getLastOrderTime,
    query,
    signalOrder,
    test
}

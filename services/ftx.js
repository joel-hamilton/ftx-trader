require('dotenv').config()
const fetch = require('node-fetch');

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

        if (body) payload.push(body);

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

    console.log(options)

    let res = await fetch(`${url}${path}`, options);
    return res.json();
}

async function getAccount() {
    return query({ path: '/account', authRoute: true })
}

async function getData(market) {
    let resolution = 15;
    let data = await query({ path: `/markets/${market}/candles?resolution=${resolution}&limit=35&start_time=${Date.now() / 1000 - (35 * resolution)}&end_time=${Date.now() / 1000}` })

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

async function signalOrder({ market }) {
    // 5 minute minimum
    let lastOrderTime = await getLastOrderTime();
    console.log(`LAST ORDER: ${lastOrderTime}`)
    if (Date.now() - lastOrderTime < 5 * 60 * 1000) {
        console.log('Order < 5 mins ago');
        return;
    }

    // check total leverage, make sure this isn't running out of control
    let account = await getAccount();
    console.log(account);
    if (account.openMarginFraction > 0.5) { // TODO what does this mean?
        console.log('Account leverage too high');
        return;
    }

    let orderBook = await getOrderBook(market);
    console.log(orderBook)
    let ask = orderBook.result.ask;
    console.log(`ASK: ${ask}`)
    // buy it!
    let amount = account.result.freeCollateral / 1000;
    console.log(amount);
    console.log(typeof amount);
    let limit = ask * 1.005;
    limit = limit - 2000; // TODO
    let size = amount / limit;
    let trailValue = -1 * limit / 100;



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
    // 
    let res = await query({ method: 'POST', path: '/orders', body: initialOrder, authRoute: true });
    console.log(res);
    // await query({ method: 'POST', path: '/conditional_orders', body: triggerOrder, authroute: true });

    // notify via SMS
}

async function test() {
    return query({ path: '/time', url: 'https://otc.ftx.com/api' })
}

module.exports = {
    getAccount,
    getData,
    getOrderBook,
    getOrderHistory,
    getLastOrderTime,
    query,
    signalOrder,
    test
}

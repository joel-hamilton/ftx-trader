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

async function getOrderHistory() {
    return query({ path: '/orders/history', authRoute: true })
}

async function getLastOrderTime() {
    let orders = await getOrderHistory();
    let date = orders.result[0].createdAt;
    return (new Date(date)).getTime();
}

async function test() {
    return query({ path: '/time', url: 'https://otc.ftx.com/api' })
}

module.exports = {
    getAccount,
    getData,
    getOrderHistory,
    getLastOrderTime,
    query,
    test
}

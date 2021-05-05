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

        console.log(payload.join(''))
        console.log(process.env.FTX_SECRET)

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

    console.log(options)

    let res = await fetch(`${url}${path}`, options);
    return res.json();
}

async function getAccount(req, res, next) {


    return query({ path: '/account', authRoute: true })
    console.log(acct)
    res.json(acct);

    // let order = {
    //     'market': 'XRP-PERP',
    //     'side': 'sell', //'buy' or 'sell'
    //     'triggerPrice': 0.306525,
    //     'size': 31431.0,
    //     'type': 'stop', //stop	'stop', 'trailingStop', 'takeProfit'; default is stop
    //     'reduceOnly': false, // boolean	false	
    //     'retryUntilFilled': false // Whether or not to keep re-triggering until filled. optional, default true for market orders
    // };

    // FTX-KEY: Your API key
    // FTX-TS: Number of milliseconds since Unix epoch
    // FTX-SIGN: SHA256 HMAC of the following four strings, using your API secret, as a hex string:
    // Request timestamp (e.g. 1528394229375)
    // HTTP method in uppercase (e.g. GET or POST)
    // Request path, including leading slash and any URL parameters but not including the hostname (e.g. /account)
    // (POST only) Request body (JSON-encoded)

}

async function test() {
    return query({ path: '/time', url: 'https://otc.ftx.com/api' })
}

module.exports = {
    getAccount,
    test
}

require('dotenv').config()
const fetch = require('node-fetch');

async function getAccount(req, res, next) {
    let method = 'GET';
    let url = 'https://ftx.com/api';
    let path = '/account';
    let body = false;

    let ts = Date.now();
    let payload = [
        ts,
        method,
        path
    ];

    if (body) payload.push(body);

    let hmac = require("crypto").createHmac("sha256", process.env.FTX_SECRET)
        .update(payload.join(''))
        .digest("hex");


    let options = {
        method,
        headers: {
            "FTX-KEY": process.env.FTX_KEY,
            "FTX-TS": ts,
            "FTX-SIGN": hmac
        }
    };
    console.log(options)

    let acct = await fetch(`${url}${path}`, options);
    console.log(acct)
    res.json(acct);

    // let order = {
    //     "market": "XRP-PERP",
    //     "side": "sell", //"buy" or "sell"
    //     "triggerPrice": 0.306525,
    //     "size": 31431.0,
    //     "type": "stop", //stop	"stop", "trailingStop", "takeProfit"; default is stop
    //     "reduceOnly": false, // boolean	false	
    //     "retryUntilFilled": false // Whether or not to keep re-triggering until filled. optional, default true for market orders
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
    return { hi: 'hi' }
}

module.exports = {
    getAccount,
    test
}

require('dotenv').config()
const fetch = require('node-fetch');

async function query({ path, url = 'https://api.twitter.com', method = 'GET', body = null, authRoute = false }) {
    let headers = {
        // 'content-type': 'application/json',
        'Accept': 'application/json',
        // 'X-Requested-With': 'XMLHttpRequest',
        'Authorization': `Bearer ${process.env.TWITTER_BEARER}`
    };

    let options = {
        method,
        headers
    };

    console.log(options)

    let res = await fetch(`${url}${path}`, options);
    return res.json();
}
async function test() {
    return query({ path: '/2/tweets/search/recent?query=from:BittelJulien&tweet.fields=created_at&expansions=author_id&user.fields=created_at' })
}

module.exports = {
    test
}
require('dotenv').config()
const fetch = require('node-fetch');

async function query({ path, url = 'https://api.twitter.com', method = 'GET', body = null, res }) {
    let headers = {
        // 'content-type': 'application/json',
        // 'Accept': 'application/json',
        // 'X-Requested-With': 'XMLHttpRequest',
        'Authorization': `Bearer ${process.env.TWITTER_BEARER}`
    };

    let options = {
        method,
        headers
    };

    console.log(options)

    let response = await fetch(`${url}${path}`, options);

    if (!res) return response.json();
    response.body.on('data', (chunk) => {
        res.write(chunk);
    });

}
async function test(res) {
    return query({ path: '/2/tweets/sample/stream?tweet.fields=created_at&expansions=author_id&user.fields=created_at', res })
    return query({ path: '/2/tweets/search/recent?query=from:BittelJulien&tweet.fields=created_at&expansions=author_id&user.fields=created_at' })
}

module.exports = {
    test
}
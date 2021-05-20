const db = require('./db');
const twitter = require('./twitter');
const ftx = require('./ftx');
const usersList = require('../data/usersList')
const moment = require('moment')

async function saveTweets(username, start, end) {
    // api limit of 100 results, so query 1 day at a time, should be enough in almost all cases
    while (start.isBefore(end)) {
        let tempEnd = moment(start).add(1, 'day');
        if (tempEnd.isAfter(end)) tempEnd = moment(end);

        console.log(`Searching from ${start} to ${tempEnd}`)
        let res = await twitter.searchTweets({ q: `from:${username}`, start, end: tempEnd });
        for (let tweet of res) {
            await db.pool.query("INSERT INTO tweets (username, date, text, market) VALUES ($1, $2, $3, $4)", [username, tweet.created_at, tweet.text, tweet.market])
        }

        start.add(1, 'day');
    }
}

async function updateTweets() {
    for (let username in usersList) {
        let start = moment().subtract(7, 'days');

        // update from last tweet, if existing
        let { rows } = await db.pool.query("SELECT MAX(date) as date FROM tweets where username = $1", [username]);
        if (rows.length && moment(rows[0].date).isAfter(start)) {
            start = moment(rows[0].date).add(1, 'second')
        }

        await saveTweets(username, start, moment().subtract(30, 'seconds'));
    }
}

async function updateEmptyMarketHistories() {
    let { rows } = await db.pool.query("SELECT * FROM tweets WHERE market IS NOT NULL AND market_history = '[]'");

    for (let row of rows) {
        let data = await ftx.getData({ market: row.market, start: moment(row.date).subtract(1, 'hour'), end: moment(row.date).add(1, 'hour') });
        if (data.result) {
            await db.pool.query('UPDATE tweets SET market_history = $1 WHERE id = $2', [JSON.stringify(data.result), row.id]);
        } else {
            console.log(`Error ${row.market}: ${row.date}. ID: ${row.id}`);
        }
    }
}

if (require.main === module) { // called from cli
    let args = process.argv.slice(2);
    if (args.includes('update')) {
        (async function() {
            await updateTweets();
            await updateEmptyMarketHistories();
        })();
    }
} else {



    module.exports = {
        saveTweets,
    }
}
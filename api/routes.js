const express = require('express');
const router = express.Router();
let ftx = require('./services/ftx');
let twitter = require('./services/twitter')
let twilio = require('./services/twilio');
let { Analyzer } = require('./services/Analyzer');
let stats = require('./services/stats');
let moment = require('moment');
let fs = require('fs');
let db = require('./services/db');

router.post('/rebalanceData', async (req, res, next) => {
    try {
        let date = moment(req.body.date);
        let data = { rebalanceInfo: null };
        // want 500 candles
        // 500 = secondsPerCandle * seconds(end - start)
        // 500 / secondsPerCandle = seconds(end - start)
        // delta = 500 * req.body.period * 2;
        let seconds = 50 * req.body.resolution;
        

        data.timeSeries = await ftx.getData({ market: req.body.market, resolution: req.body.resolution, start: moment(date).subtract(seconds, 'seconds').valueOf(), end: moment(date).add(seconds, 'seconds').valueOf() });

        // add stats from Python
        data.timeSeries = await stats.addStats(data.timeSeries, req.body.indicators, req.body.backtestParams);

        // add rebalance snapshot
        let query = await db.pool.query("SELECT * FROM rebalance_snapshots WHERE market = $1 AND date = $2", [req.body.market, date.format('YYYY-MM-DD')]);
        if (query.rows.length) data.rebalanceInfo = query.rows[0];


        res.json(data);
    } catch (e) {
        next(e);
    }
});

router.get('/search/:query/:onlyWithMarkets/:onlyBuys/:useRules/:start/:end?', async (req, res, next) => {
    try {
        let data = await twitter.searchTweets({
            q: req.params.query,
            onlyWithMarkets: parseInt(req.params.onlyWithMarkets),
            onlyBuys: parseInt(req.params.onlyBuys),
            useRules: parseInt(req.params.useRules),
            start: req.params.start,
            end: req.params.end
        });
        res.json(data);
    } catch (e) {
        next(e);
    }
});

router.get('/twitter/get/:path/:isAuth', async (req, res, next) => {
    try {
        let result = await twitter.query({ path, authRoute: isAuth });
        res.json(result);
    } catch (e) {
        next(e);
    }
})

// eg 'lt/BULL' in frontend
router.get('/ftx/get/:path', async (req, res, next) => {
    try {
        console.log(req.params.path)
        let result = await ftx.query({ path: '/' + req.params.path });
        res.json(result);
    } catch (e) {
        next(e);
    }
});

// eg 'lt/BULL' in frontend
router.get('/ftx/getAuth/:path', async (req, res, next) => {
    try {
        console.log(req.params.path)
        let result = await ftx.query({ path: '/' + req.params.path, authRoute: true });
        res.json(result);
    } catch (e) {
        next(e);
    }
})

router.post('/analyze', async (req, res, next) => {
    try {
        let analyzer = new Analyzer(req.body);
        let results;
        if (req.body.orderBook) {
            results = await analyzer.getOrderBooks();
        } else {
            results = await analyzer.analyze();
        }
        res.json(results);
    } catch (e) {
        next(e);
    }
})

router.get('/updateRules', async (req, res, next) => {
    try {
        let rules = await twitter.updateRules();
        res.json(rules);
    } catch (e) {
        next(e);
    }
});

router.get('/account', async (req, res, next) => {
    try {
        let acct = await ftx.query({ path: '/account', authRoute: true });
        res.json(acct);
    } catch (e) {
        next(e);
    }
});

router.get('/markets', async (req, res, next) => {
    try {
        let data = await ftx.query({ path: '/markets' });
        markets = data.result
            // .filter(m => {
            // let chunks = m.name.split('-');
            // return m.volumeUsd24h < 200 * 1000 * 1000 && chunks.length > 1 && chunks[1] === 'PERP'
            // })
            .map(m => {
                return {
                    name: m.name,
                    underlying: m.underlying,
                    volumeUsd24h: m.volumeUsd24h
                }
            })
            .sort((a, b) => a.volumeUsd24h > b.volumeUsd24h ? -1 : 1);
        res.json(markets);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
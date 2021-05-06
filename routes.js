const express = require('express');
const router = express.Router();
let ftx = require('./services/ftx');
let twitter = require('./services/twitter')

router.get('/', async (req, res, next) => {
    try {
        let test = await ftx.signalOrder({market: 'BTC-PERP'});
        res.json(test);
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
            .filter(m => {
                let chunks = m.name.split('-');
                return m.volumeUsd24h < 200 * 1000 * 1000 && chunks.length > 1 && chunks[1] === 'PERP'
            })
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
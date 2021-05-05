const express = require('express');
const router = express.Router();
let ftx = require('./services/ftx');
let twitter = require('./services/twitter')

router.get('/', async (req, res, next) => {
    try{
        let test = await twitter.setRules(res);
        res.json(test);
    } catch (e) {
        next(e);
    }
});

router.get('/account', async (req, res, next) => {
    try{
        let acct = await ftx.getAccount();
        res.json(acct);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
const express = require('express');
const router = express.Router();
let ftx = require('./services/ftx');

router.get('/', function(res, req, next) {
    // try{
        res.json({'hello': 'hi'})
    //     return;
    //     let test = await ftx.test();
    //     res.json(test);
    // } catch (e) {
    //     next(e);
    // }
});

router.get('/account', async (res, req, next) => {
    try{
        let acct = await ftx.getAccount();
        res.json(acct);
    } catch (e) {
        next(e);
    }
});

module.exports = router;
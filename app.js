require('dotenv').config()
var createError = require('http-errors');
const twitter = require('./services/twitter');
const twilio = require('./services/twilio');
const ftx = require('./services/ftx');
var express = require('express');
var cors = require('cors')
var path = require('path');
var cookieParser = require('cookie-parser');
var morgan = require('morgan');
var cron = require('node-cron');
const moment = require('moment');
const RebalanceTrader = require('./services/RebalanceTrader');
const TimedClose = require('./services/TimedClose');
const fs = require('fs');

var app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


app.get('/favico.ico', (req, res) => {
    res.sendStatus(404);
});

app.use(require('./routes'));

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.json(err)
    console.log(err);
});


let args = process.argv.slice(2);

if (args.includes('update')) {
    (async function() {
        await ftx.getMarkets(true);
        await twitter.updateRules();
    })()
}

if (args.includes('stream')) {
    twitter.beginStream();
}

// CRONS

// message Joel and Christopher a list of high-ratio rebalances
// (async function() { // TESTING
cron.schedule("55 19 * * *", async () => {
    console.log('Send relalance SMS cron running...');
    let rt = new RebalanceTrader();
    await rt.init();
    await rt.sendRebalanceInfo(['15197772459', '12269798530']);
    console.log('Send relalance SMS cron done');
});
// })(); // TESTINg

// TODO today
// (async function() { // TESTING
let accountStart;
cron.schedule("15 00 20 * * *", async () => {
    accountStart = await ftx.getAccount();
    let rt = new RebalanceTrader();
    await rt.init();
    await rt.placeMidOrders({
        leverage: 10,
        // leverage: 0.01, // TESTING
        positions: 2,
        // positions: 1, //TESTING
    });

    let offset = 0;
    for (let order of rt.orders) {
        // let closeTime = moment().add(30, 'seconds'); // TESTING
        let closeTime = moment().hour(20).minute(2).seconds(10 + (offset++));
        console.log(`close time: ${closeTime.format("YYYY-MM-DD HH:mm:ss")}`);
        let tc = new TimedClose({ orderId: order.id, trailPct: 0.01, closeTime });
        await tc.initClose();
    }
});
// })(); // TESTING

// (async function() {
//     let rt = new RebalanceTrader();
//     await rt.init();
//     await rt.placeMidOrders({
//         leverage: 0.03, // TESTING
//         positions: 1, //TESTING
//     });

//     for (let order of rt.orders) {
//         let closeTime = moment().add(30, 'seconds'); // TESTING
//         console.log(`close time: ${closeTime.format("YYYY-MM-DD HH:mm:ss")}`);
//         let tc = new TimedClose({ orderId: order.id, trailPct: 0.01, closeTime });
//         await tc.initClose();
//     }
// }());

// send summary
cron.schedule("03 20 * * *", async () => {
    let accountEnd = await ftx.getAccount();
    let pl = Math.round((accountEnd.totalAccountValue - accountStart.totalAccountValue) * 100) / 100;
    let openPositions = accountEnd.positions.filter(p => !!p.openSize);
    let message = `$${pl} today. ${openPositions.length} open positions`;
    await twilio.sendSms([15197772459], message);
});


// save predicted rebalances
cron.schedule('30 01 20 * * *', async () => {
    let rt = new RebalanceTrader({ minVolume24: 0, minRebalanceSizeUsd: 0 }); // don't interfere with trading stuff!
    await rt.init();
    fs.writeFileSync(`data/${moment().format("YYYY-MM-DD HH:mm:ss")}-prediction.json`, JSON.stringify(rt.getAggData()));
});

// save actual rebalances
cron.schedule('05 20 * * *', async () => {
    let rt = new RebalanceTrader({ minVolume24: 0, minRebalanceSizeUsd: 0 }); // don't interfere with trading stuff!
    await rt.init();
    await rt.loadRebalanceInfo();

    let info = Object.keys(rt.rebalanceInfo).reduce((acc, token) => {
        let i = rt.rebalanceInfo[token];

        // TODO continue if rebalance not at expected time
        // if(!moment(i.time).format('YYYYMMDDHH') !== moment().subtract(1, 'day').hour(20).format('YYYYMMDDHH')) return acc;

        if (!rt.tokenData[token]) return acc; // one weird token
        let underlying = rt.tokenData[token].underlying;

        if (!rt.marketStats[underlying]) return acc;
        let market = rt.marketStats[underlying];
        let orderSize = i.orderSizeList.reduce((total, osl) => total + parseFloat(osl), 0);

        if (acc[underlying] === undefined) acc[underlying] = 0;
        acc[underlying] += orderSize * market.last * (i.side === 'buy' ? 1 : -1);
        return acc;
    }, {});

    fs.writeFileSync(`data/${moment().format("YYYY-MM-DD HH:mm:ss")}-actual.json`, JSON.stringify(info));
});


// (async function() { // TESTING
let sentMessages = {};
cron.schedule("*/15 * * * * *", async () => {
    let rt = new RebalanceTrader();
    await rt.init();
    for (let data of Object.values(rt.tokenData)) {
        if (!data.currentLeverage) continue;

        let pctFromDesiredLeverage = Math.abs(data.currentLeverage / data.leverage) - 1;

        if (pctFromDesiredLeverage > 0.28) {
            // TODO calculate price at which rebalance is forced
            let forcedRebalanceAtLeverage = data.leverage * (4 / 3); // 33% higher than desired leverage forces rebalance
            let forcedRebalanceAtPrice = (forcedRebalanceAtLeverage * data.totalNav) / data.currentPosition;

            let volumeUsd24h = rt.marketStats[data.underlying].volumeUsd24h;
            let rebalanceRatio = Math.abs(data.rebalanceSize / volumeUsd24h);

            let newData = {
                timestamp: new Date().toISOString(),
                token: data.name,
                leverage: data.leverage,
                totalNav: data.totalNav,
                currentLeverage: data.currentLeverage,
                desiredPosition: data.desiredPosition,
                currentPosition: data.currentPosition,
                pctFromDesiredLeverage,
                rebalanceSize: data.rebalanceSize,
                rebalanceRatio,
                forcedRebalanceAtPrice,
            };

            console.log(newData);

            let recent = sentMessages[data.name] === undefined || Date.now() - sentMessages[data.name].time > 10 * 60 * 1000;
            let increasingLeverage = sentMessages[data.name] !== undefined && newData.pctFromDesiredLeverage > sentMessages[data.name].pctFromDesiredLeverage;
            let highLeverage = newData.pctFromDesiredLeverage > 0.31 && newData.rebalanceRatio > 0.1;
            let acceptableSize = newData.rebalanceSize > 100000;

            if (highLeverage && acceptableSize && (recent || increasingLeverage)) {
                await twilio.sendSms(['15197772459'], `${data.name} near rebalance:
                $${data.rebalanceSize}
                Ratio: ${rebalanceRatio}
                Drift: ${pctFromDesiredLeverage}
                Est. Price: ${forcedRebalanceAtPrice}`);
                sentMessages[data.name] = {
                    time: Date.now(),
                    ...newData
                }
            }
        }
    }
});
// })(); // TESTING

module.exports = app;

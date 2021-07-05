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
const storageService = require('./services/storageService');
const rfs = require('rotating-file-stream');
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
var logStream = rfs.createStream('error.log', {
    interval: '1d',
    path: path.join(__dirname, '/data')
});

app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.json(err)
    console.log(err);
    logStream.write(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${err.stack}\n`, next);
});

// CRONS
// message Joel and Christopher a list of high-ratio rebalances
cron.schedule("55 23 * * *", async () => {
    console.log('Send relalance SMS cron running...');
    let rt = new RebalanceTrader();
    await rt.init();
    await rt.sendRebalanceInfo(['15197772459', '12269798530']);
});


// TODO PLACE ORDERS IS DISABLED
let accountStart;
cron.schedule("15 00 00 * * *", async () => {
    accountStart = await ftx.getAccount();
    // return;
    let rt = new RebalanceTrader();
    await rt.init();
    await rt.placeMidOrders({
        leverage: 10,
        positions: 3,
    });

    let offset = 0;
    for (let order of rt.orders) {
        // TODO error-prone, if this cron ever fires before midnight, won't automatically close
        let closeTime = moment().hour(0).minute(2).seconds(10 + (offset++));
        console.log(`close time: ${closeTime.format("YYYY-MM-DD HH:mm:ss")}`);
        let tc = new TimedClose({ orderId: order.id, trailPct: 0.01, closeTime });
        await tc.initClose();
    }
});

// PLACE ORDERS TESTING
// (async function() {
//     let rt = new RebalanceTrader();
//     await rt.init();
//     await rt.placeMidOrders({
//         leverage: 0.03, // TESTING
//         positions: 5, //TESTING
//         // markets: ['BTC-PERP']
//     });

//     for (let order of rt.orders) {
//         let closeTime = moment().add(30, 'seconds'); // TESTING
//         console.log(`close time: ${closeTime.format("YYYY-MM-DD HH:mm:ss")}`);
//         let tc = new TimedClose({ orderId: order.id, trailPct: 0.01, closeTime });
//         await tc.initClose();
//     }
// }());

// send summary
cron.schedule("03 00 * * *", async () => {
    let accountEnd = await ftx.getAccount();
    let pl = Math.round((accountEnd.totalAccountValue - accountStart.totalAccountValue) * 100) / 100;
    let openPositions = accountEnd.positions.filter(p => !!p.openSize);
    let message = `$${pl} today. ${openPositions.length} open positions`;
    await twilio.sendSms([15197772459], message);
});


cron.schedule('30 01 00 * * *', async () => {
    try {
        await storageService.saveRebalanceSnapshot();
    } catch (e) {
        console.log(e);
    }
});

cron.schedule('04 00 * * *', async () => {
    try {
        await storageService.saveActualRebalanceInfo();
    } catch (e) {
        console.log(e);
    }
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

            // console.log(newData);

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

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
app.use(function (req, res, next) {
    next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
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
    (async function () {
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
cron.schedule("58 19 * * *", async () => {
    let rt = new RebalanceTrader();
    await rt.init();
    await rt.placeMidOrders({
        leverage: 20,
        // leverage: 0.02, // TESTING
        positions: 5,
        // positions: 2, //TESTING
    });

    let offset = 0;
    for (let order of rt.orders) {
        console.log(order);

        // let rebalanceAmt = Math.abs(rt.getAggDataByMarket(order.market).rebalanceAmountUsd);
        // let usdPerSecond = (4 * 1000 * 1000 / 60); // 4 million/min FTX-stated max
        // let closeTime = moment().add((rebalanceAmt / usdPerSecond) + 15, 'seconds'); // TESTING
        let closeTime = moment().hour(20).minute(2).seconds(25 + (offset++));//.seconds(0).add(rebalanceAmt / usdPerSecond, 'seconds');
        // console.log({ rebalanceAmt })
        console.log(`close time: ${closeTime.format("YYYY-MM-DD HH:mm:ss")}`)
        let tc = new TimedClose({ orderId: order.id, trailPct: 0.005, closeTime });
        await tc.initClose();
    }
});
// })(); // TESTING


// save predicted rebalances
cron.schedule('30 01 20 * * *', async () => {
    let rt = new RebalanceTrader({ minVolume24: 0, minRebalanceSizeUsd: 0 }); // don't interfere with trading stuff!
    await rt.init();
    fs.writeFileSync(`${moment().format("YYYY-MM-DD HH:mm:ss")}-prediction.json`, JSON.stringify(rt.getAggData()));
});

// save actual rebalances
cron.schedule('05 20 * * *', async () => {
    let rt = new RebalanceTrader({ minVolume24: 0, minRebalanceSizeUsd: 0 }); // don't interfere with trading stuff!
    await rt.init();
    await rt.loadRebalanceInfo();
    fs.writeFileSync(`${moment().format("YYYY-MM-DD HH:mm:ss")}-actual.json`, rt2.rebalanceInfo);
});


// (async function() { // TESTING
let sentMessages = [];
cron.schedule("*/1 * * * *", async () => {
    let rt = new RebalanceTrader();
    await rt.init();
    for (let data of Object.values(rt.tokenData)) {
        if (!data.currentLeverage) continue;

        let pctFromDesiredLeverage = Math.abs(data.currentLeverage / data.leverage) - 1;

        if (pctFromDesiredLeverage > 0.3) {
            let volumeUsd24h = rt.marketStats[data.underlying].volumeUsd24h;
            let rebalanceRatio = Math.abs(data.rebalanceSize / volumeUsd24h);

            console.log({
                timestamp: new Date().toISOString(),
                token: data.name,
                leverage: data.leverage,
                currentLeverage: data.currentLeverage,
                desiredPosition: data.desiredPosition,
                currentPosition: data.currentPosition,
                pctFromDesiredLeverage,
                rebalanceSize: data.rebalanceSize,
                rebalanceRatio,
            });

            if (!sentMessages.includes(data.name) && pctFromDesiredLeverage > 0.3 && rebalanceRatio > 0.02) {
                await twilio.sendSms(['15197772459'], `${data.name} near rebalance:
                $${data.rebalanceSize}
                Ratio: ${rebalanceRatio}
                Drift: ${pctFromDesiredLeverage}`);
                sentMessages.push(data.name);
            }
        }
    }
});
// })(); // TESTING

module.exports = app;

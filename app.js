require('dotenv').config()
var createError = require('http-errors');
const twitter = require('./services/twitter');
const twilio = require('./services/twilio');
const ftx = require('./services/ftx');
var express = require('express');
var cors = require('cors')
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cron = require('node-cron');
const RebalanceTrader = require('./services/rebalanceTrader');

var app = express();

app.use(cors());
app.use(logger('dev'));
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
let rt = new RebalanceTrader();

// message Joel and Christopher a list of high-ratio rebalances
cron.schedule("55 19 * * *", async () => {
    console.log('Send relalance SMS cron running...');
    await rt.init();
    await rt.sendRebalanceInfo(['15197772459', '12269798530']);
    console.log('Send relalance SMS cron done');
});

// TODO today
cron.schedule("58 19 * * *", async () => {
    await rt.init();
    await rt.placeMidOrders({
        leverage: 5,
        positions: 5
    });
});

// (async function() { // TESTING
let sentMessages = [];
cron.schedule("*/59 * * * * *", async () => {
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

// TODO save predicitons at 8:01
// cron.schedule("01 20 * * *", async() => {
//     console.log('Save rebalance predictions cron running...');
//     await rt.init();

//     console.log('cron done');
// });

// TODO save actual rebalance info at 8:10

// TODO save +- 10 mins of 15s data at 8:15

module.exports = app;

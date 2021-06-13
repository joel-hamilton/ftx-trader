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
cron.schedule("55 19 * * *", async() => {
    console.log('cron running...');
    await sendRebalanceInfo(['15197772459', '12269798530']);
    console.log('cron done');
});


async function sendRebalanceInfo(numbers = []) {
    let rt = new RebalanceTrader();
    await rt.init();
    let rebalances = await rt.getAggData();
    let bestIdeas = rebalances
        .reverse()
        .slice(0, 10)
        .map(rebal => {
            return `${rebal.underlying} - ${rebal.rebalanceAmountUsd > 0 ? 'BUY' : 'SELL'} $${Math.round(rebal.rebalanceAmountUsd)} (${Math.round(rebal.rebalanceRatio * 1000) / 10}%)`
        }).join('\n');

    twilio.sendSms(numbers, bestIdeas)
};

module.exports = app;

require('dotenv').config()
var createError = require('http-errors');
const twitter = require('./services/twitter');
const ftx = require('./services/ftx');
var express = require('express');
var cors = require('cors')
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

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

if (process.argv[2] === 'update') {
    (async function() {
        await ftx.getMarkets(true);
        process.exit();
    })()
} else if (process.argv[2] === 'stream') {
    twitter.beginStream();
}

module.exports = app;

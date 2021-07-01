const rfs = require('rotating-file-stream');
const fs = require('fs');
var path = require('path');
const moment = require('moment');

// LOGGING 
var logStream = rfs.createStream('app.log', {
    interval: '1d',
    path: path.join(__dirname, '/../data')
});

module.exports = {
    wait(duration) {
        return new Promise(res => setTimeout(res, duration));
    },
    async log(str, cb) {
        console.log(str);
        logStream.write(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${str}\n`, cb);
    },
    async write(str, cb) {
        logStream.write(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${str}\n`, cb);
    }
}
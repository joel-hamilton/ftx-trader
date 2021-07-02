const fetch = require('node-fetch');
let url = `${process.env.STAT_SERVICE_HOST}:${process.env.STAT_SERVICE_PORT}`;

async function addStats(data, indicators, backtestParams) {
    let res = await fetch(`${url}/getStats`, {
        method: 'post',
        body: JSON.stringify({data, indicators, backtestParams})
    });

    return await res.json();
}

module.exports = {
    addStats
}
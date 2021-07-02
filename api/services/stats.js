const fetch = require('node-fetch');
let url = `${process.env.STAT_SERVICE_HOST}:${process.env.STAT_SERVICE_PORT}`;

async function addStats(data) {
    let res = await fetch(`${url}/getStats`, {
        method: 'post',
        body: JSON.stringify({data})
    });

    return await res.json();
}

module.exports = {
    addStats
}
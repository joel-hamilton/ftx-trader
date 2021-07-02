const db = require('./db');
const twitter = require('./twitter');
const ftx = require('./ftx');
const RT = require('./RebalanceTrader');
const moment = require('moment')

async function saveRebalanceSnapshot() {
    let rt = new RT({ minVolume24: 0, minRebalanceSizeUsd: 0 });
    await rt.init();
    let data = rt.getAggData();
    let marketsData = await ftx.getMarkets();
    for(let item of data) {
        let marketData = marketsData.find(d => d.name === item.underlying) || null;
        await db.pool.query("INSERT INTO rebalance_snapshots (market, amount, ratio, market_data) VALUES ($1, $2, $3, $4)", [item.underlying, item.rebalanceAmountUsd, item.rebalanceRatio, marketData]);
    }
}

async function saveActualRebalanceInfo() {
    let rt = new RT({ minVolume24: 0, minRebalanceSizeUsd: 0 });
    await rt.init();
    await rt.loadRebalanceInfo();
    await db.pool.query("INSERT INTO rebalance_info_requests (data, fetched_at) VALUES ($1, NOW())", [rt.rebalanceInfo]);
}

module.exports = {
    saveRebalanceSnapshot,
    saveActualRebalanceInfo,
}
const db = require('./db');
const ftx = require('./ftx');

const fetch = require('node-fetch');
const moment = require('moment');
let url = `${process.env.STAT_SERVICE_HOST}:${process.env.STAT_SERVICE_PORT}`;

async function addStats(data, indicators, backtestParams) {
    let res = await fetch(`${url}/getStats`, {
        method: 'post',
        body: JSON.stringify({ data, indicators, backtestParams })
    });

    return await res.json();
}

async function backtest({ maCross, startAmt, limit = 3, minRatio = 0.05, minRebalanceAmt = 200000, from = moment('2021-06-21'), to = moment() }) {
    // let rebalanceInfos = await getTopRatios({ limit, minRatio, minRebalanceAmt, from, excludeMarkets: ['EXCH-PERP'] });
    let endAmt = startAmt;
    let allStats = [];
    let dateAmts = [];

    from = moment(from).hour(0).minute(0);
    to = moment(to);
    let rebalanceInfo = [];

    do {
        let dateRebalanceInfo = await getTopRatios({ limit, minRatio, minRebalanceAmt, date: from });
        rebalanceInfo.push({
            date: from.format("YYYY-MM-DD"),
            rows: dateRebalanceInfo
        });
    } while (from.add(1, 'day').isSameOrBefore(to))

    for (let info of rebalanceInfo) {
        let tradeAmt = endAmt / limit; // don't increase per-trade position size, even if less than `limit` trades
        let cashAmt = (limit - info.rows.length) * tradeAmt; // not used (less than `limit` opportunities)
        let dayEndAmt = 0;

        for (let trade of info.rows) {
            let data = await ftx.getData({
                market: trade.market,
                resolution: 15,
                start: moment(trade.date).subtract(1, 'day').hour(23).minute(50).valueOf(),
                end: moment(trade.date).hour(0).minute(30).valueOf(),
            });

            let stats = await addStats(
                data,
                maCross,
                {
                    maCross,
                    side: trade.amount > 0 ? 'buy' : 'sell',
                    startAmt: tradeAmt,
                }
            );

            // if no trades add to cash position, and don't add stats data
            if (!stats.find(s => s.signal !== 0)) {
                cashAmt += tradeAmt;
            } else {
                let lastStat = stats[stats.length - 1];
                dayEndAmt += lastStat.total * 0.999; // ~0.1% in/out combined fees
                allStats.push({ market: trade.market, date: info.date, rebalanceInfo: trade, timeSeries: stats });
            }
        }

        endAmt = cashAmt + dayEndAmt;
        dateAmts.push({ date: info.date, endAmt });
    }

    return {
        allStats,
        dateAmts
    }
}

async function getTopRatios({ limit = 3, minRatio = 0.05, minRebalanceAmt = 200000, excludeMarkets = [], date } = {}) {
    let res = await db.pool.query("SELECT * FROM rebalance_snapshots WHERE ABS(amount) >= $1 AND ratio >= $2 AND date = $3 AND market NOT IN ($4) ORDER BY ratio DESC LIMIT $5", [minRebalanceAmt, minRatio, moment(date).format('YYYY-MM-DD'), excludeMarkets.join(','), limit]);
    return res.rows;
}

module.exports = {
    addStats,
    backtest
}
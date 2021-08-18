const db = require('./db');
const ftx = require('./ftx');

const fetch = require('node-fetch');
const moment = require('moment');
let url = `${process.env.STAT_SERVICE_HOST}:${process.env.STAT_SERVICE_PORT}`;

async function addStats(data, backtestParams) {
    let indicators = backtestParams.inSignal.concat(backtestParams.outSignal || []);
    let res = await fetch(`${url}/getStats`, {
        method: 'post',
        body: JSON.stringify({ data, indicators, backtestParams })
    });

    return await res.json();
}

async function getMaCross(data, ma1, ma2) {
    let res = await fetch(`${url}/getMaCross`, {
        method: 'post',
        body: JSON.stringify({ data, ma1, ma2 })
    });

    return await res.json();
}

// run suite of backtests, save results
async function test() {
    let limits = [1, 2, 3];
    let inSignals = [['EMA9', 'EMA20']];
    let outSignals = [["TRL0.0025"], ["TRL0.005"], ["TRL0.0075"], ["TRL0.1"]];
    let minRatios = [0.05, 0.75, 0.1, 0.15];
    let minRebalanceAmts = [100000, 250000, 500000, 750000, 1000000, 1500000];

    for (let limit of limits) {
        for (let inSignal of inSignals) {
            for (let outSignal of outSignals) {
                for (let minRatio of minRatios) {
                    for (let minRebalanceAmt of minRebalanceAmts) {
                        let args = {
                            limit,
                            inSignal,
                            outSignal,
                            minRatio,
                            minRebalanceAmt,
                            fees: 0.0019,
                            startAmt: 1000,
                            maxAmt: 10000,
                            leverage: 10,
                            from: '2021-06-21',
                            to: moment().format('YYYY-MM-DD')
                        };

                        // console.log(args);
                        let res = await backtest(args);
                        let pl = (res.dateAmts[res.dateAmts.length - 1].endAmt - args.startAmt) / args.startAmt;
                        let trades = res.allStats.length;
                        let wins = res.allStats.reduce((acc, trade) => {
                            let ts = trade.timeSeries;
                            let endAmt = (ts[ts.length - 1].total * (1 - args.fees));
                            let tradePl = endAmt - ts[0].total;
                            if (tradePl > 0) return acc + 1;

                            return acc;
                        }, 0) || 0;

                        await db.pool.query("INSERT INTO backtest_results (args, all_stats, date_amts, profit_pct, num_trades, win_pct) VALUES ($1, $2, $3, $4, $5, $6)", [args, JSON.stringify(res.allStats), JSON.stringify(res.dateAmts), pl, trades, wins / res.allStats.length]);
                    }
                }
            }
        }
    }
}

async function backtest({ fees = 0.0019, startAmt = 1000, maxAmt = 10000, leverage = 10, inSignal, outSignal, limit = 3, minRatio = 0.05, minRebalanceAmt = 200000, from = moment('2021-06-21'), to = moment().add(1, 'day') }) {
    let endAmt = startAmt;
    let allStats = [];
    let dateAmts = [];

    from = moment(from).hour(0).minute(0);
    to = moment(to);
    let rebalanceInfo = [];

    do {
        let dateRebalanceInfo = await getTopRatios({ minRatio, minRebalanceAmt, date: from, excludeMarkets: ['EXCH-PERP'] });
        rebalanceInfo.push({
            date: from.format("YYYY-MM-DD"),
            rows: dateRebalanceInfo
        });
    } while (from.add(1, 'day').isSameOrBefore(to))

    for (let info of rebalanceInfo) {
        let positionAllocation = endAmt / limit; // don't increase per-trade position size, even if less than `limit` trades
        let posAmt = Math.min(positionAllocation, maxAmt / limit) * leverage;
        let dayEndAmt = 0;
        let enteredTrades = 0;

        for (let trade of info.rows) {
            // limit here instead of query, as it's possible to have good rebalance setups that don't trade
            if (enteredTrades >= limit) break;

            let data = await ftx.getData({
                market: trade.market,
                resolution: 15,
                start: moment(trade.date).subtract(1, 'day').hour(23).minute(50).valueOf(),
                end: moment(trade.date).minute(16).valueOf(),
            });

            let stats = await addStats(
                data,
                {
                    inSignal,
                    outSignal,
                    side: trade.amount > 0 ? 'buy' : 'sell',
                    startAmt: posAmt
                }
            );

            // if no trades add to cash position, and don't add stats data
            if (stats.find(s => s.signal !== 0)) {
                let lastStat = stats[stats.length - 1];
                let pl = (lastStat.total * (1 - fees)) - (posAmt);
                dayEndAmt += positionAllocation + pl; // Estimate of 0.1% in/out combined fees, 0.1% for slippage and bugs
                allStats.push({ market: trade.market, date: info.date, rebalanceInfo: trade, timeSeries: stats });
                enteredTrades++;
            }
        }

        let cashAmt = (limit - enteredTrades) * positionAllocation; // not used (less than `limit` opportunities)
        endAmt = cashAmt + dayEndAmt;
        dateAmts.push({ date: info.date, endAmt });
    }

    return {
        allStats,
        dateAmts
    }
}

async function getTopRatios({ minRatio = 0.05, minRebalanceAmt = 200000, excludeMarkets = [], date } = {}) {
    let res = await db.pool.query("SELECT * FROM rebalance_snapshots WHERE ABS(amount) >= $1 AND ratio >= $2 AND date = $3 AND market NOT IN ($4) ORDER BY ratio DESC", [minRebalanceAmt, minRatio, moment(date).format('YYYY-MM-DD'), excludeMarkets.join(',')]);
    return res.rows;
}

module.exports = {
    addStats,
    getMaCross,
    backtest,
    test,
}
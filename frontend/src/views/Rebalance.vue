<template>
    <div>
        <div class="header">
            <div class="inputs">
                <div class="mode">
                    <label>Fetch<input type="radio" v-model="mode" name="mode" value="fetch" checked /></label>
                    <label>Backtest<input type="radio" v-model="mode" name="mode" value="backtest" /></label>
                </div>
                <div v-if="mode === 'fetch'">
                    <label
                        >Market
                        <input
                            v-model="market"
                            class="market"
                            @focus="(e) => e.target.select()"
                            @keypress.enter="doAction"
                        />
                    </label>
                    <label class="date"
                        >Date
                        <div
                            class="move-date"
                            @click="
                                date = moment(date).subtract(1, 'day').format('YYYY-MM-DD');
                                doAction();
                            "
                        >
                            &lt;
                        </div>
                        <input v-model="date" @keypress.enter="fetch" />
                        <div
                            class="move-date"
                            @click="
                                date = moment(date).add(1, 'day').format('YYYY-MM-DD');
                                doAction();
                            "
                        >
                            &gt;
                        </div>
                    </label>
                </div>
                <div class="params" @keypress.enter="doAction">
                    <label
                        >Indicators
                        <input type="text" class="indicators" v-model="indicatorsStr" />
                    </label>
                    <template v-if="mode === 'backtest'">
                        <label>Out Signal (optional) <input v-model="outSignalStr" /></label>
                        <label>Limit<input v-model="backtestOptions.limit" /></label>
                        <label>Min. Ratio (%)<input v-model="backtestOptions.minRatio" /></label>
                        <label>Min. Reblance Amt ($)<input v-model="backtestOptions.minRebalanceAmt" /></label>
                        <label>From <input v-model="backtestOptions.from" /></label>
                        <label>Start Amount ($)<input v-model="backtestOptions.startAmt" /></label>
                        <label>Max Amount ($)<input v-model="backtestOptions.maxAmt" /></label>
                        <label>Leverage (x)<input v-model="backtestOptions.leverage" /></label>
                        <label>Fees (%)<input v-model="backtestOptions.fees" /></label>
                    </template>
                    <label v-if="mode === 'fetch'">
                        Resolution
                        <select v-model="resolution" @change="doAction">
                            <option value="15">15s</option>
                            <option value="60">1m</option>
                            <option value="300">5m</option>
                            <option value="900">15m</option>
                        </select>
                    </label>
                </div>
                <div>
                    <button @click.stop="fetch" v-if="mode === 'fetch'" :class="{ disabled: queryRunning }">
                        Fetch
                    </button>
                    <button @click.stop="backtest" v-if="mode === 'backtest'" :class="{ disabled: queryRunning }">
                        Backtest
                    </button>
                </div>
            </div>
            <template class="backtest-info" v-if="timeSeries && doBacktest">
                <div v-if="mode === 'backtest' && Object.keys(backtestResults).length">
                    <h4>
                        {{ backtestResults.allStats[currentBacktestChartItem].market }}
                        {{ moment(backtestResults.allStats[currentBacktestChartItem].date).format('YYYY-MM-DD') }}
                        Returns
                    </h4>
                    <p v-for="(signal, index) in signals" :key="index">
                        {{ signal }}
                    </p>
                    <p>{{ backtestReturns }}%</p>
                </div>
                <div>
                    <div>
                        <h4>Rebalance Amount</h4>
                        <p>${{ rebalanceAmt }}</p>
                    </div>
                    <div>
                        <h4>Rebalance Ratio</h4>
                        <p>{{ rebalanceRatio }}%</p>
                    </div>
                </div>
            </template>
        </div>
        <div v-if="mode === 'backtest' && Object.keys(backtestResults).length">
            <div class="chart-wrapper" ref="chart-wrapper">
                <highcharts constructorType="stockChart" :options="totalChartOptions" ref="total-chart" />
            </div>

            <div class="backtest-results-nav">
                {{ `${currentBacktestChartItem + 1}/${backtestResults.allStats.length}` }}
                <div
                    class="move-date"
                    :class="{ disabled: currentBacktestChartItem <= 0 }"
                    @click="() => changeBacktestChartItem(-1)"
                >
                    &lt;
                </div>
                <div
                    class="move-date"
                    :class="{ disabled: currentBacktestChartItem + 1 >= backtestResults.allStats.length }"
                    @click="() => changeBacktestChartItem(1)"
                >
                    &gt;
                </div>
            </div>
        </div>

        <div v-if="timeSeries" class="chart-wrapper" ref="chart-wrapper">
            <highcharts constructorType="stockChart" :options="chartOptions" ref="chart" />
        </div>
    </div>
</template>
<script>
    const moment = require('moment');
    const axios = require('axios');
    const tinycolor = require('tinycolor2');

    export default {
        name: 'Rebalance',
        data() {
            return {
                queryRunning: false,
                mode: 'backtest',
                timeSeries: null,
                rebalanceInfo: null,
                market: 'BTC-PERP',
                resolution: 15,
                indicatorsStr: 'EMA9, EMA20',
                outSignalStr: 'TRL0.0075',
                doBacktest: true,
                backtestOptions: {
                    fees: 0.0019, // assumes 0.02% maker in, 0.07% taker out, and 0.01% for bad backtesting stuff
                    limit: 1,
                    minRatio: 0.1,
                    minRebalanceAmt: 200000,
                    from: '2021-07-01',
                    to: moment().format('YYYY-MM-DD'),
                    leverage: 10,
                    startAmt: 1000,
                    maxAmt: 10000,
                },
                date: moment().format('YYYY-MM-DD'),
                wrapperHeight: 0,
                backtestResults: {},
                currentBacktestChartItem: 0,
            };
        },
        computed: {
            backtestParams() {
                return {
                    inSignal: this.indicators,
                    outSignal: this.outSignal,
                    ...this.backtestOptions,
                };
            },
            rebalanceAmt() {
                return this.rebalanceInfo ? numberWithCommas(Math.round(this.rebalanceInfo.amount)) : '';

                function numberWithCommas(x) {
                    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                }
            },
            rebalanceRatio() {
                return this.rebalanceInfo ? Math.round(this.rebalanceInfo.ratio * 10000) / 100 : '';
            },
            indicators() {
                return this.indicatorsStr.split(/\s*,\s*/).map((s) => s.toUpperCase());
            },
            outSignal() {
                return this.outSignalStr.split(/\s*,\s*/).map((s) => s.toUpperCase());
            },
            backtestReturns() {
                let endAmt = this.timeSeries[this.timeSeries.length - 1].total * (1 - this.backtestOptions.fees); // Estimate of 0.1% in/out combined fees, 0.1% for slippage and bugs
                return Math.round(((endAmt - this.timeSeries[0].total) / this.timeSeries[0].total) * 10000) / 100;
            },
            signals() {
                return this.timeSeries.reduce((signals, candle, index, originalArr) => {
                    let size = candle.size || (index > 0 ? originalArr[index - 1].size : 0);

                    if (candle.signal === -1) {
                        signals.push(`Sell ${Math.round(size * 100) / 100} @ $${candle.close}`);
                    }
                    if (candle.signal === 1) {
                        signals.push(`Buy ${Math.round(size * 100) / 100} @ $${candle.close}`);
                    }

                    return signals;
                }, []);
            },
            totalChartOptions() {
                let currentDate = this.backtestResults.allStats[this.currentBacktestChartItem].date;
                return {
                    title: 'Backtest Results',
                    chart: {
                        height: '200px',
                    },
                    navigator: {
                        enabled: false,
                    },
                    rangeSelector: {
                        enabled: false,
                        // selected: 1,
                    },
                    xAxis: {
                        crosshair: true,
                        labels: {
                            format: '{value:%Y-%m-%d}',
                        },
                    },
                    yAxis: [
                        {
                            crosshair: true,
                            title: {
                                text: 'Total',
                            },
                            height: '100%',
                            lineWidth: 2,
                        },
                    ],
                    series: [
                        {
                            type: 'line',
                            name: 'Total',
                            data: this.backtestResults.dateAmts.map((da) => {
                                let date = moment(da.date).valueOf();
                                return [date, da.endAmt];
                            }),
                            // yAxis,
                        },
                        {
                            type: 'scatter',
                            data: [
                                {
                                    x: moment(currentDate).valueOf(),
                                    y: this.backtestResults.dateAmts.find((a) => a.date === currentDate).endAmt * 1.005,
                                    marker: {
                                        enabled: true,
                                        symbol: 'triangle-down',
                                        radius: 10,
                                    },
                                },
                            ],
                        },
                    ],
                };
            },
            chartOptions() {
                let options = {
                    title: {
                        text: this.market,
                    },
                    chart: {
                        height: this.wrapperHeight,
                    },
                    navigator: {
                        enabled: false,
                    },
                    rangeSelector: {
                        enabled: false,
                        // selected: 1,
                    },
                    xAxis: {
                        crosshair: true,
                    },
                    yAxis: [
                        {
                            crosshair: true,
                            title: {
                                text: 'Price',
                            },
                            height: '60%',
                            lineWidth: 2,
                        },
                        {
                            labels: {
                                align: 'right',
                                x: -3,
                            },
                            title: {
                                text: 'Volume',
                            },
                            top: '65%',
                            height: '35%',
                            offset: 0,
                            lineWidth: 2,
                        },
                    ],
                    series: [
                        {
                            type: 'candlestick',
                            name: 'Price',
                            data: this.timeSeries.map((data) => {
                                return [data.time, data.open, data.high, data.low, data.close];
                            }),
                        },
                        {
                            type: 'column',
                            name: 'Volume',
                            color: '#ccc',
                            data: this.timeSeries.map((data) => {
                                return [data.time, data.volume];
                            }),
                            yAxis: 1,
                        },
                    ],
                };

                let color = tinycolor('#26a69a');
                for (let indicator of this.indicators) {
                    let yAxis = 0;

                    if (indicator.substr(0, 3) === 'RSI') {
                        yAxis =
                            options.yAxis.push({
                                labels: {
                                    align: 'left',
                                    x: -3,
                                },
                                title: {
                                    text: 'RSI',
                                },
                                top: '65%',
                                height: '35%',
                                offset: 0,
                                lineWidth: 2,
                            }) - 1;
                    }

                    options.series.push({
                        type: 'line',
                        name: indicator,
                        color: color.spin(30).toString(),
                        data: this.timeSeries.map((data) => {
                            return [data.time, data[indicator]];
                        }),
                        yAxis,
                    });
                }

                if (this.doBacktest) {
                    // let totalYAxis =
                    //     options.yAxis.push({
                    //         opposite: true,
                    //         title: {
                    //             text: 'Total',
                    //         },
                    //         height: '60%',
                    //         lineWidth: 2,
                    //     }) - 1;
                    options.series.push(
                        // {
                        //     type: 'line',
                        //     name: 'Total',
                        //     data: this.timeSeries.map((data) => {
                        //         return {
                        //             x: data.time,
                        //             y: data.total,
                        //         };
                        //     }),
                        //     yAxis: totalYAxis,
                        // },
                        {
                            type: 'scatter',
                            name: 'Positions',
                            data: this.timeSeries
                                .filter((data) => data.signal !== 0)
                                .map((data) => {
                                    return {
                                        x: data.time,
                                        y: data.signal === 1 ? data.close * 0.995 : data.close * 1.005,
                                        marker: {
                                            enabled: true,
                                            symbol: data.signal === 1 ? 'triangle' : 'triangle-down',
                                            fillColor: data.signal === 1 ? '#00c77a' : '#FF3B69',
                                            radius: 10,
                                        },
                                    };
                                }),
                        }
                    );
                }

                return options;
            },
        },
        methods: {
            moment: moment,
            doAction() {
                if (this.mode === 'fetch') this.fetch();
                if (this.mode === 'backtest') this.backtest();
            },
            async fetch() {
                this.market = this.market.toUpperCase();
                if (this.market.substr(-5) !== '-PERP') this.market += '-PERP';

                let body = {
                    market: this.market,
                    date: this.date,
                    resolution: this.resolution,
                    backtestParams: this.backtestParams,
                };

                this.queryRunning = true;
                let data = (await axios.post('http://localhost:3000/rebalanceData', body)).data;
                this.queryRunning = false;
                this.timeSeries = data.timeSeries;
                this.rebalanceInfo = data.rebalanceInfo;
                await this.$nextTick();
                this.$refs.chart.chart.zoomOut();
            },
            async backtest() {
                let body = {
                    backtestParams: this.backtestParams,
                };

                this.queryRunning = true;
                this.backtestResults = (await axios.post('http://localhost:3000/backtest', body)).data;
                this.queryRunning = false;
                this.currentBacktestChartItem = 0;
                this.changeBacktestChartItem();

                await this.$nextTick();
                this.$refs['total-chart'].chart.zoomOut();
            },
            async changeBacktestChartItem(delta = 0) {
                // no delta to reload current
                let index = this.currentBacktestChartItem + delta;
                this.market = this.backtestResults.allStats[index].market;
                this.timeSeries = this.backtestResults.allStats[index].timeSeries;
                this.rebalanceInfo = this.backtestResults.allStats[index].rebalanceInfo;
                await this.$nextTick();
                this.$refs.chart.chart.zoomOut();
                this.currentBacktestChartItem = index;
            },
        },
        async mounted() {
            await this.$nextTick();
            this.wrapperHeight = document.body.offsetHeight - 470 + 'px'; //window.this.$refs['chart-wrapper'].offsetHeight + 'px';
        },
        watch: {
            'backtestOptions.leverage': function(leverage) {
                let fees = 0.0009 + 0.001;
                if (leverage >= 100) {
                    fees += 0.0006;
                } else if (leverage >= 50) {
                    fees += 0.0004;
                }

                this.backtestOptions.fees = fees;
            },
        },
    };
</script>
<style lang='scss' scoped>
    input,
    button,
    .move-date {
        height: 30px;
    }

    .mode,
    .backtest-results-nav {
        display: flex;
        align-items: center;
    }

    label:not(:last-of-type) {
        padding-right: 0.75em;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .inputs {
        display: flex;
        flex-direction: column;

        > div {
            display: flex;
            align-items: center;
            padding: 0.5em 1em;
        }
    }

    .params {
        flex-direction: column;
        align-items: flex-start !important;

        > label {
            margin-top: 5px;
        }

        input {
            margin-left: 10px;
        }
    }

    .market,
    .indicators {
        text-transform: uppercase;
    }

    .date {
        display: inline-flex;
        align-items: center;
    }
    .move-date {
        padding: 0 0.5em;
        margin: 0.5em;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        border: 1px solid #ccc;
        cursor: pointer;

        &:hover {
            background: #ddd;
            border-color: #aaa;
        }

        &.disabled {
            background: #eee;
            pointer-events: none;
        }
    }

    .rabalance-info {
        display: flex;

        > * {
            padding-right: 2em;
        }

        h4 {
            margin-top: 0;
        }
    }

    .chart-wrapper {
        flex-grow: 1;
    }
</style>
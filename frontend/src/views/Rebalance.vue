<template>
    <div>
        <h2>Rebalance Data</h2>
        <div class="header">
            <div class="inputs">
                <div>
                    <label
                        >Market
                        <input
                            v-model="market"
                            class="market"
                            @focus="(e) => e.target.select()"
                            @keypress.enter="fetch"
                        />
                    </label>
                    <label class="date"
                        >Date
                        <div
                            class="move-date"
                            @click="
                                date = moment(date).subtract(1, 'day').format('YYYY-MM-DD');
                                fetch();
                            "
                        >
                            &lt;
                        </div>
                        <input v-model="date" @keypress.enter="fetch" />
                        <div
                            class="move-date"
                            @click="
                                date = moment(date).add(1, 'day').format('YYYY-MM-DD');
                                fetch();
                            "
                        >
                            &gt;
                        </div>
                    </label>
                </div>
                <div>
                    <label
                        >Indicators
                        <input type="text" class="indicators" v-model="indicatorsStr" @keypress.enter="fetch" />
                    </label>
                    <label>
                        Resolution
                        <select v-model="resolution" @change="fetch">
                            <option value="15">15s</option>
                            <option value="60">1m</option>
                            <option value="300">5m</option>
                            <option value="900">15m</option>
                        </select>
                    </label>
                </div>
                <div>
                    <button @click.stop="fetch">Fetch</button>
                </div>
            </div>
            <div class="backtest-info" v-if="timeSeries && doBacktest">
                <div>
                    <h4>Backtest Returns</h4>
                    <p>{{ backtestReturns }}%</p>
                </div>
                <div>
                    <h4>Rebalance Ratio</h4>
                    <p>{{ rebalanceRatio }}%</p>
                </div>
            </div>
            <div class="rabalance-info" v-if="rebalanceInfo">
                <div>
                    <h4>Rebalance Amount</h4>
                    <p>${{ rebalanceAmt }}</p>
                </div>
                <div>
                    <h4>Rebalance Ratio</h4>
                    <p>{{ rebalanceRatio }}%</p>
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
                timeSeries: null,
                rebalanceInfo: null,
                market: 'BTC-PERP',
                resolution: 15,
                indicatorsStr: 'EMA9, EMA20',
                doBacktest: true,
                backtestOptions: {
                    // set these in inputs div
                },
                date: moment().format('YYYY-MM-DD'),
                wrapperHeight: 0,
            };
        },
        computed: {
            backtestParams() {
                return {
                    startAmt: 10000,
                    maCross: ['EMA9', 'EMA20'],
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
            backtestReturns() {
                let endAmt = this.timeSeries[this.timeSeries.length - 1].total;
                return Math.round(((endAmt - this.backtestParams.startAmt) / this.backtestParams.startAmt) * 10000) / 100;
            },
            chartOptions() {
                let options = {
                    title: {
                        text: this.market,
                    },
                    chart: {
                        height: this.wrapperHeight,
                    },
                    rangeSelector: {
                        selected: 1,
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
                                        y: data.close,
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
            async fetch() {
                this.market = this.market.toUpperCase();
                if (this.market.substr(-5) !== '-PERP') this.market += '-PERP';

                let body = {
                    market: this.market,
                    date: this.date,
                    resolution: this.resolution,
                    indicators: this.indicators,
                    backtestParams: this.backtestParams,
                };
                let data = (await axios.post('http://localhost:3000/rebalanceData', body)).data;
                this.timeSeries = data.timeSeries;
                this.rebalanceInfo = data.rebalanceInfo;
                await this.$nextTick();
                this.$refs.chart.chart.zoomOut();
            },
        },
        async mounted() {
            await this.$nextTick();
            this.wrapperHeight = document.body.offsetHeight - 300 + 'px'; //window.this.$refs['chart-wrapper'].offsetHeight + 'px';
        },
    };
</script>
<style lang='scss' scoped>
    input,
    button,
    .move-date {
        height: 30px;
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

    .market,
    .indicators {
        text-transform: uppercase;
    }

    .date {
        display: inline-flex;
        align-items: center;

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
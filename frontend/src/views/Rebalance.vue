<template>
    <div>
        <h2>Rebalance Data</h2>
        <div class="header">
            <div class="inputs">
                <label
                    >Market
                    <input v-model="market" class="market" @focus="e => e.target.select()" @keypress.enter="fetch" />
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
                <button @click.stop="fetch">Fetch</button>
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
            <highcharts constructorType="stockChart" :options="chartOptions" />
        </div>
    </div>
</template>
<script>
    const moment = require('moment');
    const axios = require('axios');

    export default {
        name: 'Rebalance',
        data() {
            return {
                timeSeries: null,
                rebalanceInfo: null,
                market: 'BTC-PERP',
                date: moment().format('YYYY-MM-DD'),
                wrapperHeight: 0,
            };
        },
        computed: {
            rebalanceAmt() {
                return this.rebalanceInfo ? numberWithCommas(Math.round(this.rebalanceInfo.rebalanceAmountUsd)) : '';

                function numberWithCommas(x) {
                    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                }
            },
            rebalanceRatio() {
                return this.rebalanceInfo ? Math.round(this.rebalanceInfo.rebalanceRatio * 10000) / 100 : '';
            },
            chartOptions() {
                return {
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
                            labels: {
                                align: 'right',
                                x: -3,
                            },
                            title: {
                                text: 'Price',
                            },
                            height: '60%',
                            lineWidth: 2,
                            resize: {
                                enabled: true,
                            },
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
                            type: 'line',
                            name: 'EMA9',
                            color: '#26a69a',
                            data: this.timeSeries.map((data) => {
                                return [data.time, data.EMA9];
                            }),
                        },
                        {
                            type: 'line',
                            name: 'EMA20',
                            color: '#2963ff',
                            data: this.timeSeries.map((data) => {
                                return [data.time, data.EMA20];
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
            },
        },
        methods: {
            moment: moment,
            async fetch() {
                this.market = this.market.toUpperCase();
                if (this.market.substr(-5) !== '-PERP') this.market += '-PERP';

                let url = `http://localhost:3000/rebalanceData/${this.market}/${this.date}`;
                let data = (await axios.get(url)).data;
                this.timeSeries = data.timeSeries;
                this.rebalanceInfo = data.rebalanceInfo;
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

    label {
        padding: 0 0.75em;
    }

    .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .inputs {
        display: flex;
        align-items: center;
    }

    .market {
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
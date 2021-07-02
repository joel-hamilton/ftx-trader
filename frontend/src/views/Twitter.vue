<template>
    <div>
        <h2>Twitter</h2>
        <div @keypress.enter="doAnalyze">
            <h3>Analyze</h3>
            <input placeholder="from" v-model="analyze.from" />
            <input placeholder="to" v-model="analyze.to" />
            <label>
                Show Charts
                <input type="checkbox" v-model="analyze.showCharts" />
            </label>
            <select v-model="analyze.sortBy">
                <option value="latest">Latest</option>
                <option value="price">Price</option>
                <option value="volume">Volume</option>
            </select>
            <button @click="doAnalyze">Analyze</button>
        </div>
        <div class="json" v-html="res" v-if="res"></div>
    </div>
</template>


<script src="@assets/highcharts-3d.js"></script>
<script src="@assets/highstock.js"></script>
<script src="@assets/highcharts-more.js"></script>
<script>

    const moment = require('moment');
    const axios = require('axios');
    export default {
        name: 'Twitter',
        data() {
            return {
                analyze: {
                    from: '',
                    to: '',
                    showCharts: true,
                    sortBy: 'latest',
                },
                res: null,
            };
        },
        computed: {},
        methods: {
            async doAnalyze() {
                let url = 'http://localhost:3000/analyze';
                let res = (await axios.post(url, this.analyze)).data;
                this.res = res.map((r) => {
                    r.diffs = this.$store.getters['base/syntaxHighlight'](r.diffs);
                    return r;
                });

                if (!this.analyze.showCharts) return;
                await this.$nextTick();

                // init charts

                let groupingUnits = [
                    [
                        'week', // unit name
                        [1], // allowed multiples
                    ],
                    ['month', [1, 2, 3, 4, 6]],
                ];

                for (let item of this.analyzeRes) {
                    const chart = Highcharts.chart(`chart${item.id}`, {
                        title: {
                            text: `${item.market.name} - ($${Math.round(item.market.volumeUsd24h / 1000 / 1000)}m)`,
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
                        tooltip: {
                            enabled: false,
                        },
                        series: [
                            {
                                // specific options for this series instance
                                type: 'candlestick',
                                name: 'Price',
                                data: item.market_history.map((mh) => {
                                    return [
                                        moment(mh.startTime).diff(item.date, 'minutes', true),
                                        mh.open,
                                        mh.high,
                                        mh.low,
                                        mh.close,
                                    ];
                                }),
                                dataGrouping: {
                                    units: groupingUnits,
                                },
                            },
                            {
                                type: 'column',
                                name: 'Volume',
                                data: item.market_history.map((mh) => {
                                    return [moment(mh.startTime).diff(item.date, 'minutes', true), mh.volume];
                                }),
                                yAxis: 1,
                                dataGrouping: {
                                    units: groupingUnits,
                                },
                            },
                        ],
                    });
                }
            },
        },
    };
</script>

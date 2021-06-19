const ftx = require('./ftx');
const utils = require('./utils');
const moment = require('moment');
const cron = require('node-cron');

// Attempt to close position at a certain time, while providing liquidity
// - places a trailing stop
// - if position still open at specifiec time, attempts to close at above ask snapshot
// - if position is closed successfully, trigger trailing stop order is closed
module.exports = class TimedClose {
    constructor({ orderId, closeTime, trailPct = 0.01 }) {
        this.orderId = orderId;
        this.closeTime = moment(closeTime);
        this.trailPct = trailPct;
        this.order;
        this.trailingStop;
        this.closeOrder;
        this.cron;
    }

    async initClose() {
        this.order = await this.updateOrder(this.orderId);
        await this.setTrailingStop();
        await this.setCronOrder();
    }

    async setTrailingStop() {
        let triggerOrder = {
            market: this.order.market,
            side: this.order.side === 'buy' ? 'sell' : 'buy',
            trailValue: this.order.side === "buy" ? -1 * this.order.price * this.trailPct : this.order.price * this.trailPct,
            size: this.order.size,
            type: "trailingStop",
            reduceOnly: true,
        };

        // console.log(`setting trailing stop`)
        console.log(triggerOrder);
        let res = await ftx.query({ method: 'POST', path: '/conditional_orders', body: triggerOrder, authRoute: true });
        console.log(res);
        this.trailingStop = res.result;
        // console.log(this.trailingStop);
    }

    async setCronOrder() {
        // TODO check original order for fill, too; might not need to do this
        console.log(`Setting cron for ${this.closeTime.format("HH:mm:ss")}`);
        this.cron = cron.schedule(this.closeTime.format("s m H D M *"), async () => {
            console.log(`Cron order for ${this.order.market} firing`);
            console.log(this.closeTime.format("HH:mm:ss"));
            // this.trailingStop = await this.updateOrder(this.trailingStop.id);
            // console.log(this.trailingStop);
            // if (this.trailingStop.status === 'closed') return; // nothing to be done, stopped out

            // let orderbook = await ftx.getOrderBookFixed(this.order.market);
            let order = {
                market: this.order.market,
                side: this.order.side === 'buy' ? 'sell' : 'buy',
                price: null, //orderbook.asks[1], // TODO take second place in orderbook
                type: "market",
                size: this.order.size,
                reduceOnly: true,
            };

            console.log(order);
            let res = await ftx.query({ method: 'POST', path: '/orders', body: order, authRoute: true });
            console.log(res);
            this.closeOrder = res.result;
        });
    }

    async updateOrder(id) {
        let res = await ftx.query({ path: `/orders/${id}`, authRoute: true });
        return res.result;
    }
}
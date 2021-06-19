const ftx = require('./ftx');
const utils = require('./utils');
const moment = require('moment');
const cron = require('node-cron');

// Attempt to close position at a certain time, while providing liquidity
// - places a trailing stop
// - if position still open at specific time, attempts to close at above ask snapshot
// - if position is closed successfully, trigger trailing stop order is closed
module.exports = class TimedClose {
    constructor({ orderId, closeTime, trailPct = 0.01 }) {
        this.closeTime = moment(closeTime);
        this.trailPct = trailPct;
        this.order = { id: orderId };
        this.trailOrder;
        this.closeOrder;
        this.cron;
    }

    async initClose() {
        this.order = await this.updateOrder(this.order);
        await this.setTrailingStop();
        await this.setCronOrder();
        await utils.wait(100);
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

        let res = await ftx.query({ method: 'POST', path: '/conditional_orders', body: triggerOrder, authRoute: true });
        console.log(res);
        this.trailOrder = res.result;
        console.log(this.trailOrder);
    }

    async setCronOrder() {
        // TODO check original order for fill, too; might not need to do this
        console.log(`Setting cron for ${this.closeTime.format("HH:mm:ss")}`);
        this.cron = cron.schedule(this.closeTime.format("s m H D M *"), async () => {
            console.log(`Cron order for ${this.order.market} firing`);
            console.log(this.closeTime.format("HH:mm:ss"));

            await this.cancelUnfilledInitialOrder();

            // this.trailOrder = await this.updateOrder(this.trailOrder);
            // console.log(this.trailOrder);
            // console.log(this.trailOrder);
            // if (this.trailOrder.status === 'closed') return; // nothing to be done, stopped out

            // let orderbook = await ftx.getOrderBookFixed(this.order.market);
            let order = {
                market: this.order.market,
                side: this.order.side === 'buy' ? 'sell' : 'buy',
                price: null, //orderbook.asks[1], // TODO take second place in orderbook
                type: "market",
                size: this.order.size,
                reduceOnly: true,
            };

            let res = await ftx.query({ method: 'POST', path: '/orders', body: order, authRoute: true });
            console.log(res);
            if (res.sucess) { // if initial order not filled at all, this won't succeed
                this.closeOrder = res.result;
            }

            this.safeCancelUnusedOrders();
        });
    }

    async cancelUnfilledInitialOrder() {
        this.order = await this.updateOrder(this.order);
        // cancel original order if not completely filled
        if (parseInt(this.order.remainingSize) !== 0) {
            console.log('Cancelling unfilled initial order');
            let res = await ftx.cancelOrder(this.order);
            console.log(res);
            await utils.wait(100);
        }
    }

    // waits until the initial position is closed, and then cancels the unused timed/trailing order
    async safeCancelUnusedOrders(attempts = 0) {
        if (attempts >= 10) {
            console.log("ERROR: close took over 10 seconds");
            console.log(this.trailOrder);
            console.log(this.order);
            return;
        }

        console.log('cancelling unused orders');

        if (this.closeOrder) {
            this.closeOrder = await this.updateOrder(this.closeOrder);
            console.log(this.closeOrder);

            // cancel trail order if timed close completely filled
            if (parseInt(this.closeOrder.remainingSize) === 0) {
                let res = await ftx.cancelOrder(this.trailOrder);
                console.log(res);
                return;
            }
        }

        // cancel the timed close order if trailing stop completely filled
        this.trailOrder = await this.updateOrder(this.trailOrder);
        console.log(this.trailOrder);
        if (this.trailOrder.status === 'closed') {
            let res = await ftx.cancelOrder(this.closeOrder);
            console.log(res);
            return;
        }

        utils.wait(1000);
        this.safeCancelUnusedOrders(++attempts);
    }

    async updateOrder(order) {
        let updatedOrder;
        if (order.type === 'trailing_stop') {
            let res = await ftx.query({ path: `/conditional_orders?market=${order.market}`, authRoute: true });
            updatedOrder = res.result.find(r => r.id === order.id);
        } else {
            let res = await ftx.query({ path: `/orders/${order.id}`, authRoute: true });
            updatedOrder = res.result;
        }

        return updatedOrder;
    }
}
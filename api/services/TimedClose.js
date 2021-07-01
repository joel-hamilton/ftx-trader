//testing
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
        this.takeProfitOrders = [];
    }

    async initClose() {
        this.order = await this.updateOrder(this.order);
        await this.setTrailingStop();
        await this.setTakeProfits();
        this.setCronOrder();
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
        await utils.wait(100);
        this.trailOrder = res.result;
    }

    async setTakeProfits() {
        let profitPcts = [0.0025, 0.005, 0.0075];
        for (let pct of profitPcts) {
            if (this.order.side === 'sell') pct *= -1;

            let triggerPrice = this.order.price * (1 + pct * 0.5);
            let orderPrice = this.order.price * (1 + pct); // ie: limit, set beyond trigger to try for maker

            let triggerOrder = {
                market: this.order.market,
                side: this.order.side === 'buy' ? 'sell' : 'buy',
                size: this.order.size / profitPcts.length,
                type: "takeProfit",
                triggerPrice,
                orderPrice,
                reduceOnly: true,
            };

            console.log(triggerOrder);
            let res = await ftx.query({ method: 'POST', path: '/conditional_orders', body: triggerOrder, authRoute: true });
            console.log(res);
            this.takeProfitOrders.push(res.result);
            await utils.wait(100);
        }
    }

    setCronOrder() {
        console.log(`Setting cron for ${this.closeTime.format("HH:mm:ss")}`);
        cron.schedule(this.closeTime.format("s m H D M *"), async () => {
            console.log(`Cron order for ${this.order.market} firing`);
            console.log(this.closeTime.format("HH:mm:ss"));

            // TODO wait until order confirmed cancelled
            await this.cancelUnfilledInitialOrder();

            // TODO after cancelled, reload initial order and get filled size so we can cencel correct amount. Will probably fail if only partially filled and we try t ocancel extra size.


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
            console.log(`\ncron close order placed`);
            console.log(res);
            if (res.success) { // if initial order not filled at all, this won't succeed
                // TODO handle casse where initial order is unfilled/partially filled. This currently returns:
                // { success: false, error: 'Invalid reduce-only order' }
                this.closeOrder = res.result;
                console.log('\nCancelling trail order');
                console.log(this.trailOrder);
                let cancelRes = await ftx.cancelOrder(this.trailOrder);
                console.log(cancelRes);
            }

            // this.safeCancelUnusedOrders();
        });
    }

    // cancel original order if not completely filled
    async cancelUnfilledInitialOrder() {
        let res = await ftx.cancelOrder(this.order);
        console.log(res);
        await utils.wait(100);
        return;

        this.order = await this.updateOrder(this.order);
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

        // cancel take profits
        for(let order of this.takeProfitOrders) {
            await ftx.cancelOrder(order);
        }

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
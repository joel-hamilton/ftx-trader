const ftx = require('./ftx');
const utils = require('./utils');

// attempt to close position via trailing stop while providing liquidity, by following the midprice
// if limitPct hit, a market order will be sent
module.exports = class FloatClose {
    constructor({ market, initialOrderId, floatPct, limitPct, frequency = 5000 }) {
        this.frequency = frequency;
        this.market = market;
        this.initialOrderId = initialOrderId;
        this.initialOrder;
        this.closeTriggerPrice; // price at which we begin trying to close
        this.floatPct = floatPct;
        this.limitPct = limitPct;
        this.currentClosePrice; // floating close offer
        this.hardClosePrice; // if this price is hit, market close
    }

    async test() { // TODO
        let order = {
            "market": 'BTC-PERP',
            "side": 'buy',
            "price": 40500,
            "type": "limit",
            "size": 0.001,
        };

        let res = await ftx.query({ method: 'POST', path: '/orders', body: order, authRoute: true });
        this.initialOrderId = res.result.id;
        this.initFloatingClose();
    }

    async update() {
        // re-fetch the initial order
        let res = await ftx.query({ path: `/orders/${this.initialOrderId}`, authRoute: true });
        console.log(res.result);
        this.initialOrder = res.result;


        // update softClose and hardClose based on current price and sizeFilled
        await this.refreshOrderbook();
        let mid = (this.orderbook.ask + this.orderbook.bid) / 2;
        console.log('mid price: ' + mid);

        let closePrice;
        if (this.initialOrder.side === 'buy') {
            closePrice = mid * (1 - this.floatPct);
            if (this.currentClosePrice && this.currentClosePrice < closePrice) return false;
        } else {
            closePrice = mid * (1 + this.floatPct);
            if (this.currentClosePrice && this.currentClosePrice > closePrice) return false;
        }

        console.log('close price ' + closePrice);
        console.log('');

        return closePrice;
    }

    async initFloatingClose() {
        await this.update();

        // wait until order is at least partially filled
        if (!this.initialOrder.filledSize) {
            console.log('not yet filled');
            await this.wait();
            return this.initFloatingClose();
        }

        let closeOrder = {
            market: this.market,
            side: this.initialOrder.side === 'buy' ? 'sell' : 'buy',
            price: await this.getClosePrice(),
            size: this.initialOrder.filledSize,
            type: 'limit',
            reduceOnly: true,
        };

        console.log('SENDING CLOSE ORDER');
        console.log(closeOrder);

        let res = await ftx.query({ method: 'POST', path: '/orders', body: closeOrder, authRoute: true });
        this.triggerOrder = res.result;

        console.log("THIS.TRIGGERORDER")
        console.log(this.triggerOrder);

        await this.wait();
        this.updateFloatingClose();
    }

    // TODO this probably creates a new order id
    async updateFloatingClose() { // TODO allow updating of floatPct
        await this.update();
        let closePrice = await this.getClosePrice();
        if (!closePrice) {
            await this.wait();
            return this.updateFloatingClose();
        }

        let modifyOrder = {
            size: this.initialOrder.filledSize,
            price: closePrice
        };

        let res = await ftx.query({ method: 'POST', path: `/orders/${this.triggerOrder.id}/modify`, body: modifyOrder, authRoute: true });
        this.triggerOrder = res.result;

        console.log("THIS.TRIGGERORDER")
        console.log(this.triggerOrder);

        await this.wait();
        this.updateFloatingClose();
    }

    // returns close value, or false if current close value is sufficient
    async getClosePrice() {
 
    }

    async refreshOrderbook() {
        let res = await ftx.getOrderBook(this.market);
        this.orderbook = res.result;
    }

    async refreshTriggerOrder() {
        let res = await ftx.query({ path: `/orders/${this.triggerOrder.id}`, authRoute: true });
        this.triggerOrder = res.result;
    }

    async wait() {
        await utils.wait(this.frequency);
    }
}
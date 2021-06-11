const ftx = require('../services/ftx');
const constants = require('../data/constants');
const MARKET = 'FAKE-PERP';

test('order placed correctly', async () => {
    let SCALE = 4;
    let res = await ftx.signalOrder({
        market: MARKET,
        text: 'buy this',
        username: 'joel',
        scale: SCALE,
    });

    expect(res.initialOrder).toMatchObject({
        "market": MARKET,
        "side": "buy",
        "price": constants.TEST_MOCK_LIMIT,
        "type": "limit",
        "size": -1 * (constants.RISK_UNIT_DOLLARS * SCALE) / constants.TEST_MOCK_LIMIT / constants.TEST_TRAIL_PERCENT
    });

    expect(res.triggerOrder).toMatchObject({
        "market": MARKET,
        "side": "sell",
        "trailValue": constants.TEST_MOCK_LIMIT * constants.TEST_TRAIL_PERCENT,
        "size": -1 * (constants.RISK_UNIT_DOLLARS * SCALE) / constants.TEST_MOCK_LIMIT / constants.TEST_TRAIL_PERCENT,
        "type": "trailingStop",
        "reduceOnly": true,
    });
});

test('test buy maxes at MAX_DOLLAR_AMOUNT', async () => {
    let res = await ftx.signalOrder({
        "market": MARKET,
        "buy": true,
        "scale": 100000,
    });

    expect(res.initialOrder).toMatchObject({
        "market": MARKET,
        "side": "buy",
        "price": constants.TEST_MOCK_LIMIT,
        "type": "limit",
        "size": constants.MAX_DOLLAR_AMOUNT / constants.TEST_MOCK_LIMIT
    });

    expect(res.triggerOrder).toMatchObject({
        "market": MARKET,
        "side": "sell",
        "trailValue": constants.TEST_MOCK_LIMIT * constants.TEST_TRAIL_PERCENT,
        "size": constants.MAX_DOLLAR_AMOUNT / constants.TEST_MOCK_LIMIT,
        "type": "trailingStop",
        "reduceOnly": true,
    });
});
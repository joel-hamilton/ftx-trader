const ftx = require('../services/ftx');
const constants = require('../data/constants');
const MARKET = 'FAKE-PERP';
const STOP_VALUE = 0.01;

test('order placed correctly', async () => {
    let SCALE = 4;
    let res = await ftx.signalOrder({
        market: MARKET,
        text: 'buy this',
        username: 'joel',
        scale: SCALE,
        test: true
    });

    expect(res.initialOrder).toMatchObject({
        "market": MARKET,
        "side": "buy",
        "price": constants.TEST_MOCK_LIMIT,
        "type": "limit",
        "size": (constants.RISK_UNIT_DOLLARS * SCALE) / constants.TEST_MOCK_LIMIT / constants.TEST_TRAIL_VALUE
    });

    expect(res.triggerOrder).toMatchObject({
        "market": MARKET,
        "side": "sell",
        "trailValue": constants.TEST_TRAIL_VALUE,
        "size": (constants.RISK_UNIT_DOLLARS * SCALE) / constants.TEST_MOCK_LIMIT / constants.TEST_TRAIL_VALUE,
        "type": "trailingStop",
        "reduceOnly": true,
    });
});

test('test buy maxes at MAX_DOLLAR_AMOUNT', async () => {
    let res = await ftx.signalOrder({
        "market": MARKET,
        "buy": true,
        "scale": 100000,
        test: true
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
        "trailValue": constants.TEST_TRAIL_VALUE,
        "size": constants.MAX_DOLLAR_AMOUNT / constants.TEST_MOCK_LIMIT,
        "type": "trailingStop",
        "reduceOnly": true,
    });
});
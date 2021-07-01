const twitter = require('../services/twitter');
const cloneDeep = require('lodash/cloneDeep');

function getRes() {
    return cloneDeep({
        text: 'nothing useful here',
        username: 'MOCK_USER',
        created_at: '2021-05-20 20:16:41',
        positiveWords: [],
        positivePhrases: [],
        powerPhrases: [],
        stopPhrases: [],
        sentiment: 0,
        buy: false,
        // scale: 0,
        // scaleAdjustments: []
    })
};

function getMockChunk() {
    return cloneDeep({
        data: {
            id: '1234',
            created_at: '2021-05-21T00:16:41.000Z',
            text: 'NOTHING useful here',
            author_id: '1358649813290672129'
        },
        includes: {
            users: [{ id: '1358649813290672129', name: 'MOCK_USER', username: 'MOCK_USER' }]
        }
    });
}

test('basic tweet processed correctly', () => {
    let mockChunk = getMockChunk();
    let res = twitter.processTweet(mockChunk.data, mockChunk.includes);
    expect(res).toMatchObject(getRes());
});

test('elon matches on doge', () => {
    let mockChunk = getMockChunk();
    mockChunk.data.text = 'Never selling the doge';
    mockChunk.includes.users[0].username = 'elonmusk';

    let expectedRes = {
        ...getRes(),
        text: 'never selling the doge',
        username: 'elonmusk',
        market: 'DOGE-PERP',
        underlying: "DOGE",
        buy: true
    };

    let res = twitter.processTweet(mockChunk.data, mockChunk.includes);
    expect(res).toMatchObject(expectedRes)
});
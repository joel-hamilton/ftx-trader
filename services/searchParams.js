const marketsList = require('./marketsList');
const queryString = require('query-string');

module.exports = {
    rules: [
        { "value": "from:CryptoKaleo OR from:ShardiB2 OR from:AltcoinPsycho OR from:SmartContracter", "tag": "CryptoTwitter" },
        { "value": "from:elonmusk", "tag": "elon" },
        { "value": marketsList.slice(0, 10).map(m => m.underlying).join(" OR "), "tag": "keywords" },
    ],
    queryString: queryString.stringify({
        'tweet.fields': 'created_at',
        'expansions': 'author_id',
        'user.fields': 'id',
    })
};
const marketsList = require('./marketsList');
const queryString = require('query-string');

let rules = [
    {
        "value": "from:CryptoKaleo OR from:ShardiB2 OR from:AltcoinPsycho OR from:SmartContracter OR from:CryptoCobain OR from:RookieXBT OR from:LomahCrypto OR from:Tradermayne",
        "tag": "CryptoTwitter"
    },
    {
        "value": "from:elonmusk",
        "tag": "elon"
    },
    // { "value": marketsList.slice(0, 10).map(m => m.underlying).join(" OR "), "tag": "keywords" },
];

module.exports = {
    rules,
    fieldsQueryString: queryString.stringify({
        'tweet.fields': 'created_at',
        'expansions': 'author_id',
        'user.fields': 'id',
    }),
    rulesQueryString: encodeURIComponent(rules.map(r => r.value).join(' OR '))
};
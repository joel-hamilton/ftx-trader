const marketsList = require('./marketsList');
const usersList = require('./usersList');
const queryString = require('query-string');

let fromUsersString = Object.keys(usersList).filter(u => usersList[u].enabled).map(u => `from:${u}`).join(' OR ');
console.log(fromUsersString)
let rules = [
    {
        "value": fromUsersString,
        "tag": "CryptoTwitter"
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
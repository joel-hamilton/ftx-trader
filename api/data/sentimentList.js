module.exports = {
    positiveWords: {
        '🔥': 5,
        '📈': 5,
        '🌙': 5,
        '🌋': 5,
        '🐂': 4,
        // 'alright': 2,
        'ath': 5,
        // 'atomic': 5, // catching $atom!
        // 'blowing': 5,
        // 'boom': 3,
        // 'booom': 3,
        // 'boooom': 3,
        // 'booooom': 3,
        // 'boooooom': 3,
        // 'bottom': 2,
        // 'bought': 4,
        // 'bounce': 3,
        'breakout': 5,
        // 'bull': 4,
        // 'buy': 5,
        // 'chad': 3,
        // 'continuation': 1,
        // 'crazy': 3,
        // 'discovery': 3,
        // 'enter': 4,
        // 'explode': 4,
        // 'giga': 5,
        // 'gigasend': 3,
        // 'high': 5,
        // 'inevitable': 2,
        // 'lfg': 3,
        // 'long': 3,
        'massive': 3,
        // 'moon': 5,
        // 'omg': 4,
        // 'prime': 2,
        // 'ramp': 2,
        'ripping': 3,
        // 'send': 4,
        // 'stacking': 3,
        // 'trending': 3,
        // 'up': 2,
        'vertical': 4,
    },

    positivePhrases: [
        /add(ing)?\smore/,
        /(ape|aping)[\w\s]+into/,
        /\$[.\d]+[\w\s]+target/,                          // eg $3.50 target
        /target[\w\s]+\$[.\d]+/,
        /all[\s-]time high[s]?/,
        /break(s|(ing))?\sout/,
        /broke[n]?\sout/,
        /buying[\w\s]+\$[\w\s]+(here|now)/, // buying $eos here...
        /((here)|(away))\s((it\s)|(we\s))?go(es)?/,
        // /going[\w\s]for\sit/,
        /lift\s?off/,
        /on\sfire/,
        /holy\sshit/,
        /price\sdiscovery/,
        /(took|taking)[\w\s]+(shot|off)/, // some crossover here between eg: 'Taking it off the table' and 'Taking off', but stop phrases will always have precedence

        // ready for the next leg higher, eg.
        /ready[\w\s]+(leg|mov)[\w\s]+(high|up)/,

        /(scalp[\w\s]+long)/,

        // try to match 'send it!' as sell as 'send $SOL' cash tag. Could make this more precise in Sentimental and match only the tweet's market
        /(send)[\w\s]+(it|\$[\w]+)/,
    ],

    powerPhrases: [
        /(^|\s)(i\s|i'm\s|im\s|am\s|just\s)[\w\s]*(added|adding|ape|aping|bought|buy|enter|grab|long)/,
    ],

    stopPhrases: [
        /tak(e|ing)[\w\s]+(profit|table)/,
    ]
}
const sentimentList = require('../data/sentimentList')

// TODO bug, `$XRPと$BTCの実需の違い。\n現状ではある意味、王者の貫禄にすら見える『買われることが実需』という＄BTCだけど世界が進むにつれ、いつまでも王の座に居続けられるのかな🤔\n#XRPtheStandard https://t.co/FJBLDO4Smo` generates like 50 positive words

module.exports = class Sentimental {
    constructor(text, marketUnderlying = '') {
        this.text = text.toUpperCase();
        this.marketUnderlying = marketUnderlying;
        this.positiveWords = []; // 1 point each
        this.positivePhrases = []; // 10 points each
        this.score = 0;

        this._calculate();
    }

    getPositivePhrases() {
        return this.positivePhrases;
    }

    getPositiveWords() {
        return this.positiveWords
    }

    getScore() {
        return this.score;
    }

    _calculate() {
        // add positive single words
        this._addSentimentMatches();
        this._addMarketIfExclamation();
        this._addMarketIfShortTweet();

        // add positive phrases
        this._addPhrases();

        // get positivity score
        let words = this.text.split(' ').length;
        this.score = (this.positiveWords.length * 1 + this.positivePhrases.length * 10) / words;
    }

    // $CVX! eg, gets added to positive words
    _addMarketIfExclamation() {
        if (this.marketUnderlying) {
            let exclamation = `${this.marketUnderlying}!`;
            if (this.text.includes(exclamation)) {
                this.positiveWords.push(exclamation);
            }
        }
    }

    _addPhrases() {
        // match on 'I/just...bought/buying/entered/re-entered'
        // TODO this needs work
        let match = this.text.match(/((?:I['\s])|(?:Just))[^\.]+(?:enter|long|buy|bought)/gi);
        if(match) {
            this.positivePhrases.push(match[0]);
        }
    }

    _addSentimentMatches() {
        // add positive word matches
        for (let word in sentimentList) {
            word = word.toUpperCase();
            if (this.text.match(`[\s-]${word}`) || this.text.match(`${word}[\s-]`)) this.positiveWords.push(word);
        }
    }


    // add if very short tweet and market is mentioned
    _addMarketIfShortTweet() {
        if (this.marketUnderlying) {
            if (this.text.split(' ').length <= 3) {
                this.positiveWords.push(this.marketUnderlying);
            }
        }
    }

}
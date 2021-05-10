const sentimentList = require('../data/sentimentList')

module.exports = class Sentimental {
    constructor(text, marketUnderlying = '') {
        this.text = text.trim().toLowerCase();
        this.splitText = this.text.split(/[\s-,]/).filter(chunk => !!chunk.trim()),
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
        this.score = (this.positiveWords.length * 1 + this.positivePhrases.length * 10) / this.splitText.length;
    }

    // $CRV! eg, gets added to positive words
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
        let match = this.text.match(/((?:(?:^|\W)I['\s])|(?:Just))[^\.]+(?:enter|long|buy|bought|add)/gi);
        if (match) {
            this.positivePhrases.push(match[0]);
        }
    }

    _addSentimentMatches() {
        // add positive word matches
        for (let word in sentimentList) {
            word = word.toLowerCase();
            if (this.splitText.includes(word)) this.positiveWords.push(word);
        }
    }


    // add if very short tweet and market is mentioned
    _addMarketIfShortTweet() {
        if (this.marketUnderlying) {
            if (this.splitText.length <= 9) {
                this.positiveWords.push(this.marketUnderlying);
            }
        }
    }

}
const sentimentList = require('../data/sentimentList')

// Load wink-nlp package  & helpers.
const winkNLP = require('wink-nlp');
// Load "its" helper to extract item properties.
const its = require('wink-nlp/src/its.js');
// Load "as" reducer helper to reduce a collection.
const as = require('wink-nlp/src/as.js');
// Load english language model — light version.
const model = require('wink-eng-lite-model');
// Instantiate winkNLP.
const nlp = winkNLP(model);

const stem = require('wink-porter2-stemmer');

module.exports = class Sentimental {
    constructor(text, marketUnderlying = '') {
        this.text = text.trim().toLowerCase();
        this.tokens = this._tokenizeText();
        this.marketUnderlying = marketUnderlying;
        this.positiveWords = []; // 1 point each
        this.positivePhrases = []; // 10 points each

        // add from list of words/phrases
        this._addSentimentWordMatches();
        this._addSentimentPhraseMatches();

        // amplify short, excited tweets
        this._addMarketIfExclamation();
        this._addMarketIfShortTweet();

        // add other positive phrases
        this._addPhrases();

        // get positivity score
        this.score = (this.positiveWords.length * 1 + this.positivePhrases.length * 10) / this.tokens.length;
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

    // add positive word matches from list
    _addSentimentWordMatches() {
        for (let word in sentimentList.words) {
            let stemmedWord = stem(word);
            if (this.tokens.includes(stemmedWord)) this.positiveWords.push(stemmedWord);
        }
    }

    // add poisitive phrase matches from list
    _addSentimentPhraseMatches() {
        for (let phrase of sentimentList.phrases) {
            let regex = new RegExp(phrase, 'g');
            let match = this.text.match(regex);
            if (match) {
                this.positivePhrases.push(match[0])
            };
        }
    }

    // add if very short tweet and market is mentioned
    _addMarketIfShortTweet() {
        if (this.marketUnderlying) {
            if (this.tokens.length <= 6) {
                this.positiveWords.push(this.marketUnderlying);
            }
        }
    }

    _tokenizeText() {
        return nlp.readDoc(this.text)
            .tokens()
            .filter(
                (t) => t.out(its.type) === 'word' || t.out(its.type) === 'emoji'
            )
            .out()
            .map(t => stem(t));
    }
}
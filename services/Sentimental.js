const sentimentList = require('../data/sentimentList')

// Load wink-nlp package  & helpers.
const winkNLP = require('wink-nlp');
// Load "its" helper to extract item properties.
const its = require('wink-nlp/src/its.js');
// Load "as" reducer helper to reduce a collection.
// const as = require('wink-nlp/src/as.js');
// Load english language model — light version.
const model = require('wink-eng-lite-model');
// Instantiate winkNLP.
const nlp = winkNLP(model);

const stem = require('wink-porter2-stemmer');

module.exports = class Sentimental {
    constructor(text, marketUnderlying = '') {
        this.text = text.trim().toLowerCase();
        this.tokens = this.tokenizeText();
        this.marketUnderlying = marketUnderlying;

        this.positiveWords = [];    // 1 point each
        this.positivePhrases = [];  // 10 points each
        this.stopPhrases = [];      // automatically zeroes the score

        // add from list of words/phrases
        this.addPositiveWords();
        this.addPositivePhrases();

        // amplify short, excited tweets
        this.addMarketIfExclamation();
        this.addMarketIfShortTweet();

        // add stop phrases
        this.addStopPhraseMatches();

        // get positivity score
        if (this.stopPhrases.length) {
            this.score = 0;
        } else {
            this.score = (this.positiveWords.length * 1 + this.positivePhrases.length * 10) / this.tokens.length;
        }
    }

    get info() {
        return {
            positivePhrases: this.positivePhrases,
            positiveWords: this.positiveWords,
            stopPhrases: this.stopPhrases,
            sentiment: this.score,
        }
    }

    // $CRV! eg, gets added to positive words
    addMarketIfExclamation() {
        if (this.marketUnderlying) {
            let exclamation = `${this.marketUnderlying}!`;
            if (this.text.includes(exclamation)) {
                this.positiveWords.push(exclamation);
            }
        }
    }

    // add positive word matches from list
    addPositiveWords() {
        for (let word in sentimentList.words) {
            let stemmedWord = stem(word);
            if (this.tokens.includes(stemmedWord)) this.positiveWords.push(stemmedWord);
        }
    }

    // add poisitive phrase matches from list
    addPositivePhrases() {
        for (let phrase of sentimentList.phrases) {
            let regex = new RegExp(phrase, 'g');
            let match = this.text.match(regex);
            if (match) {
                this.positivePhrases.push(match[0])
            };
        }
    }

    // add negative phrase matches from list
    addStopPhraseMatches() {
        for (let phrase of sentimentList.stopPhrases) {
            let regex = new RegExp(phrase, 'g');
            let match = this.text.match(regex);
            if (match) {
                this.stopPhrases.push(match[0])
            };
        }
    }

    // add if very short tweet and market is mentioned
    addMarketIfShortTweet() {
        if (this.marketUnderlying) {
            if (this.tokens.length <= 6) {
                this.positiveWords.push(this.marketUnderlying);
            }
        }
    }

    tokenizeText() {
        return nlp.readDoc(this.text)
            .tokens()
            .filter(
                (t) => t.out(its.type) === 'word' || t.out(its.type) === 'emoji'
            )
            .out()
            .map(t => stem(t));
    }
}
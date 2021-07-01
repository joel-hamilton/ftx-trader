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
    constructor(text, username = '', marketUnderlying = '') {
        this.text = text.trim().toLowerCase();
        this.tokens = this.tokenizeText();
        this.marketUnderlying = marketUnderlying;

        this.positiveWords = [...this.getPositiveWords(), ...this.getMarketIfExclamation()];
        this.positivePhrases = this.getRegexMatches(sentimentList.positivePhrases);
        this.powerPhrases = this.getRegexMatches(sentimentList.powerPhrases);      
        this.stopPhrases = this.getRegexMatches(sentimentList.stopPhrases);

        // get positivity score
        if (this.stopPhrases.length) {
            this.score = 0;
        } else {
            this.score = this.positiveWords.length;
            this.score += this.positivePhrases.length * 5;
            this.score += this.powerPhrases.length * 100;

            // weird hack, bump up RookieXBT mentions, if there's anything at all positive
            if(username === 'RookieXBT' && marketUnderlying) this.score *= 5;

            this.score /= this.tokens.length / 2;

            if (this.isRetweet) this.score /= 2;
        }
    }

    get info() {
        return {
            positiveWords: this.positiveWords,
            positivePhrases: this.positivePhrases,
            powerPhrases: this.powerPhrases,
            stopPhrases: this.stopPhrases,
            sentiment: this.score,
        }
    }

    get isRetweet() {
        return this.text.substr(0, 1) === '@' || this.text.substr(0, 2) === 'rt';
    }

    // $CRV! eg, gets added to positive words
    getMarketIfExclamation() {
        if (this.marketUnderlying) {
            let exclamation = `${this.marketUnderlying}!`;
            if (this.text.includes(exclamation)) return [this.marketUnderlying]
        }

        return [];
    }

    // add positive word matches from list
    getPositiveWords() {
        let words = []
        for (let word in sentimentList.positiveWords) {
            let stemmedWord = stem(word);
            if (this.tokens.includes(stemmedWord)) words.push(stemmedWord);
        }

        return words;
    }

    getRegexMatches(regexes) {
        let matches = [];
        for (let r of regexes) {
            let regex = new RegExp(r, 'g');
            let match = this.text.match(regex);
            if (match) {
                matches.push(match[0])
            };
        }

        return matches;
    }

    // add if very short tweet and market is mentioned
    // addMarketIfShortTweet() {
    //     if (this.marketUnderlying) {
    //         if (this.tokens.length <= 3) {
    //             this.positiveWords.push(this.marketUnderlying);
    //         }
    //     }
    // }

    tokenizeText() {
        return nlp.readDoc(this.text)
            .tokens()
            .filter(
                (t) => t.out(its.type) === 'word' || t.out(its.type) === 'emoji'
            )
            .out()
            .map(t => stem(t))
            .filter((t, i, arr) => arr.indexOf(t) === i); // de-duplicate
    }
}
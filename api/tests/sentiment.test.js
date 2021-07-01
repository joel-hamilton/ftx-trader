const Sentimental = require('../services/Sentimental');
const testPhrases = require('../data/testPhrases');

test.each(testPhrases)('matches %p', (phrase) => {
    let sentimental = new Sentimental(phrase);
    expect(sentimental.info.sentiment).toBeGreaterThan(0);
})
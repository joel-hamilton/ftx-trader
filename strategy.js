/**
STRATEGY

- get order book and figure out how much I can buy without moving market too much. Some of these coins only trade single-digit millions in 24h
    - not a big deal on the buy, as limit means it will get only partially filled, but on the sell it could get ugly
- size position and stop according to 24h volatility
    - probably too slow to calculate this on the fly, would have to have a recurring task, storage solution
- size position according to reliability of signal
    - based on twitter account, market size (need to get more data/a feel for this)

    High conviction bets:
    KALEO + small markets + 'send'

Thought: Even if a tweet doesn't move the market per se, it's likely to be excited about the right things at approximately the right times...

TODO
- when updating tweets, only add tweets older than an hour, so we have complete +-60 min data for it
- make 0th min round up (so after the tweet). Perhaps round up +1 interval if in last 10 seconds of period (so the range of buys would be 10s-25s after)?
- use OHLC to estimate P/L
- on update, save most recent account info, etc to database?
- save marketslist to DB
- make package.json scripts for updating tweet data, etc.
- "if the tik tokers can send literal dog sh*t, we can send $zec" caught the phrase send lit, but not send $zec

STRATEGY INVERSION
start with amt to risk (based on scale)
    - let riskAmt = 100
get ask
    - let bid = ask + 0.0001
calculate recent volatility (eg: last hour, in 1 min intervals)
    - let mean = (float) mean of the 60 intervals
    - let sqDeviations = ([floats]) square(mean - deviation)
    - let variance = (float) sum(sqDeviations) / 60
    - let periodVol = sqrt(variance)  IE: assuming std distribution, 2/3 of returns in 1 period will fall +/- periodVol/2
    - let 5periodVol = sqrt(5) * periodVol
set % trailing stop based on volatility
    - let trlStop = periodVol / 2 (or something like that)
quantity = bid * riskAmt / trlStop

THINGS TO ACTUALLY BUY
$RUNE, $ALPHA - RookieXBT
Other than $RUNE which is by far my biggest holding (I buy more everyday regardless of price) — I’ve been holding onto a sizeable amount of $ALPHA for some time And with that being said, I’ve never felt more comfy than I do now. This summer is gonna be good.

 */

// relVolChange 0-5
// plp P/L Percent, as a decimal

/**
 * TESTING
 * 
 * make MAX_DOLLAR_VALUE, MAX_RISK into constants so I can import them into tests, too
 */
let trades = [
    {
        tweet: "I am pretty irresponsibly long $CRV here, this long term chart.. ooh...",
        market: 'CRV-PERP',
        buy: 3.7291,
        sell: 0,
        plp: 0,
        volChange: 0,
        notes: ``,
    },
    {
        tweet: "@ShardiB2 - RT @trader1sz: $CRV 🤝 https://t.co/YlCyoqFnzd",
        market: 'CRV-PERP',
        buy: 3.6385,
        sell: 0,
        plp: 0,
        volChange: 0,
        notes: ``,
    },
    {
        tweet: "@ShardiB2 - @solstarterorg is coming.....  one of the better projects I invested in.  If you believe in $SOL than you should probably check out the medium piece here... https://t.co/eDbcffOngk",
        market: 'SOL-PERP',
        buy: 43.7661,
        sell: 43.5424,
        plp: -0.005,
        volChange: 0,
        notes: `Obviously a mistake to buy this, need to ignore the nonsense tweets.`,
    },
    {
        tweet: "@ShardiB2 - @Off_Erwan seriously, I am not even sure what you are talking about, I have not sold my core spot position ever, I have like 6 accounts I trade and if I remember correctly, I CRUSHED that $BAND trade.  Honestly, I am like 90 trades past that.",
        market: 'BAND-PERP',
        notes: `Just sold this one right away, should filter stuff like this out as much as possible. No change in vol/px action though.`,
    },
    {
        tweet: "@CryptoKaleo - As expected, $OMG has been absolutely on fire the past couple of days. https://t.co/in8Yxaf4V",
        market: 'OMG-PERP',
        buy: 12.812,
        sell: 12.7535,
        plp: -0.0045,
        volChange: 4,
        notes: `Huge spike, big gap between fills. Caught it in the middle of the candle.`,
    },
    {
        tweet: "@ShardiB2 - $ATOM!! https://t.co/J5oEcR1KrX https://t.co/sYaxIHUtwf",
        market: 'ATOM-PERP',
        buy: 29.7109,
        sell: 30.759,
        plp: 0.0352, // !!!
        volChange: 1,
        notes: `Small spike, probably didn't contribute much, BUT she wasn't wrong. It kept going up nicely.`,
    },
    {
        tweet: "@ShardiB2 - RT @inmortalcrypto: $ATOM above $100 this summer...missing link",
        market: 'ATOM-PERP',
        buy: 28.921,
        sell: 29.4155,
        plp: 0.017,
        volChange: 0,
        notes: `Small spike, probably didn't contribute much, kept going up nicely.`,
    },
    {
        tweet: "@ShardiB2 - $BNT Buy it if it breaks IMO https://t.co/3CO2db5xXd",
        market: 'BNT-PERP',
        buy: 7.7160,
        sell: 7.851,
        plp: 0.0175,
        volChange: 4,
        notes: 'Nice vol spike, spike started at least 30s after tweet. Pump lasted 1 min, then correction, ranging.',
    },
    {
        tweet: "@ShardiB2 - $CRV S/R  Good entry if not in https://t.co/ca6rMwoLFW",
        market: 'CRV-PERP',
        buy: 3.63855,
        sell: 3.68165,
        plp: 0.011,
        volChange: 3,
        notes: 'Nice vol spike, I got in 100% before price spike.',
    },
    {
        tweet: "@ShardiB2 - Hope you got some $CRV",
        market: 'CRV-PERP',
        buy: 3.74,
        sell: 3.717,
        plp: -0.006,
        volChange: 0,
        notes: 'Nothing changed...weird vol spike & selling 1 min before tweet.'
    },
];
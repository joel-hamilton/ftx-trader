let tweets = [
    {
        text: 'RT @CryptoKaleo: $TRX will go to $1.00+ during this bull run.',
        username: 'CryptoKaleo',
        created_at: '2021-05-08T00:05:01.000Z',
        market: 'TRX-PERP',
        volumeUsd24h: 340474791.100375
    },
    {
        text: '$TRX / $BTC\n' +
            '\n' +
            'Rejected at the April high, I’m still betting we see a sharp recovery and a push back to the upper diagonal resistance.\n' +
            '\n' +
            'BTFD. https://t.co/ZKW5euHHvv',
        username: 'CryptoKaleo',
        created_at: '2021-05-08T00:01:43.000Z',
        market: 'TRX-PERP',
        volumeUsd24h: 340474791.100375
    },
    {
        text: '$TRX will go to $1.00+ during this bull run.',
        username: 'CryptoKaleo',
        created_at: '2021-05-07T00:38:06.000Z',
        market: 'TRX-PERP',
        volumeUsd24h: 340474791.100375
    },
    {
        text: '$TRX\n\nSend it straight to a quarter 🤝 https://t.co/cFbLBOGY2H',
        username: 'CryptoKaleo',
        created_at: '2021-05-07T00:35:13.000Z',
        market: 'TRX-PERP',
        volumeUsd24h: 340474791.100375
    },
    {
        text: 'RT @CryptoKaleo: Send $TRX to twenty cents in the next twenty-four hours 🤝',
        username: 'CryptoKaleo',
        created_at: '2021-05-07T00:29:32.000Z',
        market: 'TRX-PERP',
        volumeUsd24h: 340474791.100375
    },
    {
        text: 'RT @CryptoKaleo: $TRX / $BTC\n' +
            '\n' +
            'It’s time to send to 400+ sats. We’ve waited long enough. https://t.co/SKNdj3ioFE',
        username: 'CryptoKaleo',
        created_at: '2021-05-07T00:29:21.000Z',
        market: 'TRX-PERP',
        volumeUsd24h: 340474791.100375
    },
    {
        text: 'RT @CryptoKaleo: I haven’t tweeted about $TRX in weeks. Why? There was no reason to. It wasn’t ready.\n' +
            '\n' +
            'It is now. The last time I initiated…',
        username: 'CryptoKaleo',
        created_at: '2021-05-07T00:29:10.000Z',
        market: 'TRX-PERP',
        volumeUsd24h: 340474791.100375
    },
    {
        text: '$LTC https://t.co/LW6yV6aFJC',
        username: 'ShardiB2',
        created_at: '2021-05-07T00:26:06.000Z',
        market: 'LTC-PERP',
        volumeUsd24h: 496563046.4693
    },
    {
        text: '$TRX is about to f*cking explode',
        username: 'CryptoKaleo',
        created_at: '2021-05-07T00:24:30.000Z',
        market: 'TRX-PERP',
        volumeUsd24h: 340474791.100375
    },
    {
        text: 'I think you literally need to long the shit out of this if you are not already long...\n' +
            '\n' +
            '$XTZ https://t.co/OIYYcqWZfu',
        username: 'ShardiB2',
        created_at: '2021-05-07T00:24:24.000Z',
        market: 'XTZ-PERP',
        volumeUsd24h: 60276232.3730723
    },
    {
        text: 'I bought a little spot $SUSHI at $16.51 https://t.co/uIykshKXo0',
        username: 'ShardiB2',
        created_at: '2021-05-07T00:15:42.000Z',
        market: 'SUSHI-PERP',
        volumeUsd24h: 205054605.9893
    },
    {
        text: '$LTC\n' +
            '\n' +
            'Nice buy this morning, DEAD ON SUPPORT.\n' +
            '\n' +
            "Look at that wick...my lines don't lie 🥰 https://t.co/5uhwk5JRLZ",
        username: 'ShardiB2',
        created_at: '2021-05-06T12:47:31.000Z',
        market: 'LTC-PERP',
        volumeUsd24h: 496563046.4693
    },
    {
        text: '$ZRX\n' +
            '\n' +
            'Literally, everything is up 25% in 24hrs....crazy..\n' +
            '\n' +
            'Love this tho.. https://t.co/k4wFOXPapa https://t.co/XRi9ZXPYEL',
        username: 'ShardiB2',
        created_at: '2021-05-06T12:41:55.000Z',
        market: 'ZRX-PERP',
        volumeUsd24h: 7849478.29875
    },
    {
        text: '$XTZ\n\nWe doing this and I am long https://t.co/IJtN3cbX35',
        username: 'ShardiB2',
        created_at: '2021-05-06T12:40:02.000Z',
        market: 'XTZ-PERP',
        volumeUsd24h: 60276232.3730723
    },
    {
        text: '$ADA\n' +
            '\n' +
            'ANOTHER BOOOOM!\n' +
            '\n' +
            'Also trend JUST flipped green (more to come) https://t.co/XLrOKoSVbu https://t.co/ElCfQ7e1oa',
        username: 'ShardiB2',
        created_at: '2021-05-06T12:37:06.000Z',
        market: 'ADA-PERP',
        volumeUsd24h: 467975313.887755
    },
    {
        text: '$EOS\n\nMASSIVE BOOOM. https://t.co/p3XQXqpEcx https://t.co/NZLjTOMG3W',
        username: 'ShardiB2',
        created_at: '2021-05-06T12:35:33.000Z',
        market: 'EOS-PERP',
        volumeUsd24h: 785372535.136975
    },
    {
        text: "$sushi macro downtrend breaking, we're going to gun for new all time highs from here imo.\n" +
            '\n' +
            '10% off fees 👇\n' +
            '\n' +
            'https://t.co/735xxHRpDX https://t.co/DvfuvuFLgO',
        username: 'SmartContracter',
        created_at: '2021-05-06T12:09:22.000Z',
        market: 'SUSHI-PERP',
        volumeUsd24h: 205054605.9893
    },
    {
        text: '$TRX sending',
        username: 'CryptoKaleo',
        created_at: '2021-05-06T00:14:31.000Z',
        market: 'TRX-PERP',
        volumeUsd24h: 340474791.100375
    },
    {
        text: 'Send $FTM to $1.00 swiftly 🤝',
        username: 'CryptoKaleo',
        created_at: '2021-05-05T12:49:33.000Z',
        market: 'FTM-PERP',
        volumeUsd24h: 31323064.91595
    },
    {
        text: '$DOGE funding is currently negative.',
        username: 'CryptoKaleo',
        created_at: '2021-05-05T12:46:07.000Z',
        market: 'DOGE-PERP',
        volumeUsd24h: 1299824797.3539524
    },
    {
        text: '$FTM continuing to strengthen approaching ATH resistance https://t.co/Y8Y7Yycr1h',
        username: 'CryptoKaleo',
        created_at: '2021-05-05T12:45:15.000Z',
        market: 'FTM-PERP',
        volumeUsd24h: 31323064.91595
    },
    {
        text: "$DOGE could easily dip back down into the mid 50s from here, but could also just start chadding up to a dollar. I'm leaning toward the first being the more likely scenario, which would be a prime dip buying opportunity for anyone looking for an entry. I'm giga-long either way. https://t.co/Rp0M2aCcPG",
        username: 'CryptoKaleo',
        created_at: '2021-05-05T12:41:36.000Z',
        market: 'DOGE-PERP',
        volumeUsd24h: 1299824797.3539524
    },
    {
        text: '$LINK https://t.co/2evdJwDMP2',
        username: 'ShardiB2',
        created_at: '2021-05-05T12:37:07.000Z',
        market: 'LINK-PERP',
        volumeUsd24h: 364188077.75875
    },
    {
        text: '@roxanekru looking that way, old coins getting their turn... $DASH, etc.',
        username: 'ShardiB2',
        created_at: '2021-05-05T12:34:28.000Z',
        market: 'DASH-PERP',
        volumeUsd24h: 30386956.97975
    },
    {
        text: '$BCH\n' +
            '\n' +
            'Was, in fact, very bullish.  Just follow the lines....  buy the retest of the break. https://t.co/XQbkom6eG9 https://t.co/Q03RgZkXGu',
        username: 'ShardiB2',
        created_at: '2021-05-05T12:30:34.000Z',
        market: 'BCH-PERP',
        volumeUsd24h: 692177929.16605
    },
    {
        text: 'RT @22loops: Even as a hater myself. I must respect the $DOGE pump.',
        username: 'CryptoKaleo',
        created_at: '2021-05-05T00:54:44.000Z',
        market: 'DOGE-PERP',
        volumeUsd24h: 1299824797.3539524
    },
    {
        text: '$DOGE to the moon. https://t.co/DDPgMXMB3b',
        username: 'CryptoKaleo',
        created_at: '2021-05-05T00:47:55.000Z',
        market: 'DOGE-PERP',
        volumeUsd24h: 1299824797.3539524
    },
    {
        text: 'FYI, $LTC, LFG!!!! https://t.co/vovJ6zTV8r',
        username: 'ShardiB2',
        created_at: '2021-05-05T00:47:21.000Z',
        market: 'LTC-PERP',
        volumeUsd24h: 496563046.4693
    },
    {
        text: '$LTC looks pretty good still? \n' +
            '\n' +
            "So long as $BTC doesn't giga nuke this trades higher. https://t.co/l2J0Sd2lnu",
        username: 'Tradermayne',
        created_at: '2021-05-05T00:15:25.000Z',
        market: 'LTC-PERP',
        volumeUsd24h: 496563046.4693
    },
    {
        text: '$LTC to $1,000+',
        username: 'CryptoKaleo',
        created_at: '2021-05-04T12:46:35.000Z',
        market: 'LTC-PERP',
        volumeUsd24h: 496563046.4693
    },
    {
        text: 'NEW $DOGE ALL TIME HIGH',
        username: 'CryptoKaleo',
        created_at: '2021-05-04T00:05:39.000Z',
        market: 'DOGE-PERP',
        volumeUsd24h: 1299824797.3539524
    },
    {
        text: '$BNB initial rejection at ATH wasn’t surprising. Looks like it should finally break through for price discovery to $700+ sometime soon. https://t.co/gITWxcZzdg',
        username: 'CryptoKaleo',
        created_at: '2021-05-02T12:02:02.000Z',
        market: 'BNB-PERP',
        volumeUsd24h: 251945402.7375
    }
]
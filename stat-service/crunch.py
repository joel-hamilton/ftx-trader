from os import close, error
import pandas as pd
from datetime import datetime
import numpy as np
import matplotlib.pyplot as plt
import mplfinance as mpf
from pandas_datareader import data as pdr

pd.set_option('display.max_rows', None)
pd.set_option('display.max_columns', None)
pd.set_option('display.width', None)
pd.set_option('display.max_colwidth', -1)

def crunchData(data, indicators, backtestParams):
    df = pd.DataFrame.from_records(data, index="startTime")

    for indicator in indicators:
        df[indicator] = getIndicator(indicator, df)

    addBacktest(backtestParams, df)
    return df.to_json(orient='records')

def getIndicator(indicator, df):
    if indicator[:3] == 'SMA':
        return getSMA(int(indicator[3:]), df)
    if indicator[:3] == 'EMA':
        return getEMA(int(indicator[3:]), df)
    if indicator[:3] == 'RSI':
        return getRSI(int(indicator[3:]), df)

def getSMA(periods, df):
    return df["close"].rolling(window=periods).mean()

def getEMA(periods, df):
    return df['close'].ewm(span=periods, adjust=False).mean()

def getRSI(periods, df):
    delta = df['close'].diff()
    up = delta.clip(lower=0)
    down = -1*delta.clip(upper=0)
    ema_up = up.ewm(com=periods, adjust=False).mean()
    ema_down = down.ewm(com=periods, adjust=False).mean()
    rs = ema_up/ema_down
    return 100 - (100/(1 + rs))


def addBacktest(params, df):
    print(params)
    open_signalled = False
    close_signalled = False
    prev_row = {}

    side = params['side']
    short_param = params["maCross"][0]
    long_param = params["maCross"][1]
    short_window = int(short_param[3:]) # TODO will break if not 'SMA9', etc.

    signals = pd.DataFrame(index=df.index)
    signals['startTime'] = df.index # TODO just get the row label?
    signals['signal'] = 0.0
    signals['position'] = 0.0
    signals['ma_x'] = 0.0

    def addSignals(row):
        nonlocal prev_row
        nonlocal open_signalled
        nonlocal close_signalled

        def finish():
            nonlocal prev_row
            prev_row['startTime'] = row['startTime']
            prev_row['position'] = row['position']
            prev_row['ma_x'] = row['ma_x']
            return row

        index = signals.index.get_loc(row[0])

        row['ma_x'] = 1.0 if df.iloc[index][short_param] > df.iloc[index][long_param] else -1.0

        rowDateTime = datetime.fromisoformat(row['startTime'])
        minDateTime = datetime.fromisoformat(signals.iloc[0]['startTime']).replace(hour=23, minute=55)
        maxDateTime = datetime.fromisoformat(signals.tail(1).iloc[0]['startTime']).replace(hour=00, minute=2)
        if(rowDateTime < minDateTime): # don't do anything before min time
            return finish()
        
        if(row['ma_x'] == 1.0):
            # no change from prev row
            if (index  > 0 and prev_row['ma_x'] == 1.0):
                row['position'] = prev_row['position']
                return finish()

            if(side == 'buy' and not open_signalled and rowDateTime <= maxDateTime):
                row['signal'] = 1.0
                row['position'] = 100.0
                open_signalled = True
            if(side == 'sell' and (open_signalled and not close_signalled)):
                row['signal'] = 1.0
                row['position'] = 0.0
                close_signalled = True

        if(row['ma_x'] == -1.0):
            # no change from prev row
            if (index  > 0 and prev_row['ma_x'] == -1.0):
                row['position'] = prev_row['position']
                return finish()

            if(side == 'sell' and not open_signalled and rowDateTime <= maxDateTime):
                row['signal'] = -1.0
                row['position'] = -100.0
                open_signalled = True
            if(side == 'buy' and (open_signalled and not close_signalled)):
                row['signal'] = -1.0
                row['position'] = 0.0
                close_signalled = True

        return finish()

    signals = signals.apply(addSignals, axis=1)
    signals = signals[['position', 'signal']].shift(1).fillna(0.0) # prevent look-ahead bias

    # print(signals[['signal', 'position', 'ma_x']].head(70))
    # signals['signal'][short_window:] = np.where(signals['signal'][short_window - 1] and signals['short_mavg'][short_window:] > signals['long_mavg'][short_window:], 1.0, -1.0)


    # Generate trading orders from diffs
    # signals['positions'] = signals['signal'].diff().fillna(0.0)

    # generate returns
        # Set the initial capital
    initial_capital= float(params["startAmt"])

    # Create a DataFrame `positions`
    positions = pd.DataFrame(index=signals.index).fillna(0.0)

    # Set position size
    # TODO this is an approximate sizing, should calculate it right at the first buy/sell
    # positions['size'] = (initial_capital / df["close"][0]) * signals['signal']
    positions['size'] = signals['position']
    
    # Initialize the portfolio with value owned   
    portfolio = positions.multiply(df['close'], axis=0)

    # Store the difference in shares owned 
    pos_diff = positions.diff()

    portfolio['holdings'] = (positions.multiply(df['close'], axis=0)).sum(axis=1)
    portfolio['cash'] = initial_capital - (pos_diff.multiply(df['close'], axis=0)).sum(axis=1).cumsum()
    portfolio['total'] = portfolio['cash'] + portfolio['holdings']
    portfolio['returns'] = portfolio['total'].pct_change()
    
    # update original dataframe
    df['signal'] = signals['signal']
    df['total'] = portfolio['total']
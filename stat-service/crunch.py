import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import mplfinance as mpf
from pandas_datareader import data as pdr

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
    short_param = params["maCross"][0]
    long_param = params["maCross"][1]
    short_window = int(short_param[3:]) # TODO will break if not 'SMA9', etc.
    
    # Generate holding/not holding data (1 or 0)
    signals = pd.DataFrame(index=df.index)
    signals['signal'] = 0.0
    signals['short_mavg'] = df[short_param]
    signals['long_mavg'] = df[long_param]
    signals['signal'][short_window:] = np.where(signals['short_mavg'][short_window:] > signals['long_mavg'][short_window:], 1.0, 0.0)


    # Generate trading orders from diffs
    signals['positions'] = signals['signal'].diff().fillna(0.0)
    signals['positions'][short_window] = 0.0 # ignore the first change

    # generate returns
        # Set the initial capital
    initial_capital= float(params["startAmt"])

    # Create a DataFrame `positions`
    positions = pd.DataFrame(index=signals.index).fillna(0.0)

    # Set position size
    # TODO this is an approximate sizing, right at the first buy/sell
    positions['size'] = (initial_capital / df["close"][0]) * signals['signal']
    position_opened = False
    position_closed = False
    prev_size = 0
    prev_position = 0
    
    def getSize(row):
        # skip the first change (it's the short MA kicking in)
        if(row.name == df.index[short_window]):
            return prev_size

        if(row["positions"] != prev_position):
            # TODO

        return 10

    positions['size'] = signals.apply(getSize, axis=1)
    
    # Initialize the portfolio with value owned   
    portfolio = positions.multiply(df['close'], axis=0)

    # Store the difference in shares owned 
    pos_diff = positions.diff()

    # Add `holdings` to portfolio
    portfolio['holdings'] = (positions.multiply(df['close'], axis=0)).sum(axis=1)

    # Add `cash` to portfolio
    portfolio['cash'] = initial_capital - (pos_diff.multiply(df['close'], axis=0)).sum(axis=1).cumsum()   

    # Add `total` to portfolio
    portfolio['total'] = portfolio['cash'] + portfolio['holdings']

    # Add `returns` to portfolio
    portfolio['returns'] = portfolio['total'].pct_change()
    
    # update original dataframe
    df['positions'] = signals['positions']
    df['total'] = portfolio['total']
    
    # annualized Sharpe ratio
    # returns = portfolio['returns']
    # df['sharpe'] = np.sqrt(252) * (returns.mean() / returns.std())
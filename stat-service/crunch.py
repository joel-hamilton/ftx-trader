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

def crunchData(data, indicators, backtest_params):
    df = pd.DataFrame.from_records(data, index="startTime")

    for indicator in indicators:
        df[indicator] = getIndicator(indicator, df)

    addBacktest(backtest_params, df)
    return df.to_json(orient='records')

def getMaCross(data, ma1, ma2):
    df = pd.DataFrame.from_records(data, index="startTime")
    df[ma1] = getIndicator(ma1, df)
    df[ma2] = getIndicator(ma2, df)
    df['ma_x'] = np.where(df[ma1] > df[ma2], 1.0, -1.0)   
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
    open_signalled = False
    close_signalled = False
    prev_row = {}

    start_amt = params['startAmt']
    side = params['side']
    short_param = params["inSignal"][0]
    long_param = params["inSignal"][1]
    out_signal = params["outSignal"][0]
    
    short_window = int(short_param[3:]) # TODO will break if not 'SMA9', etc.
    min_h = 23 # don't open a position prior to this
    min_m = 55
    max_h = 0 # don't open a position after this
    max_m = 2
    close_at_m = 15 # close any open positions at this time

    signals = pd.DataFrame(index=df.index)
    signals['startTime'] = df.index # TODO just get the row label?
    signals['signal'] = 0.0
    signals['position'] = 0.0
    signals['ma_x'] = 0.0
    signals['max_touch'] = None

    def addSignals(row):
        nonlocal prev_row
        nonlocal open_signalled
        nonlocal close_signalled

        def finish():
            nonlocal prev_row
            prev_row['startTime'] = row['startTime']
            prev_row['position'] = row['position']
            prev_row['ma_x'] = row['ma_x']
            prev_row['max_touch'] = row['max_touch']
            return row

        index = signals.index.get_loc(row[0])

        pos_size = start_amt / df.iloc[index]['close']
        row['ma_x'] = 1.0 if df.iloc[index][short_param] > df.iloc[index][long_param] else -1.0

        rowDateTime = datetime.fromisoformat(row['startTime'])
        minDateTime = datetime.fromisoformat(signals.iloc[0]['startTime']).replace(hour=min_h, minute=min_m)
        maxDateTime = datetime.fromisoformat(signals.tail(1).iloc[0]['startTime']).replace(hour=max_h, minute=max_m)
        closeAtDateTime = datetime.fromisoformat(signals.tail(1).iloc[0]['startTime']).replace(hour=0, minute=close_at_m)
        if(rowDateTime < minDateTime): # don't do anything before min time
            return finish()

        # force a close at this time
        if(rowDateTime >= closeAtDateTime):
            if(open_signalled and not close_signalled) :
                if(side == 'buy'):
                    row['signal'] = -1
                    row['position'] = 0.0
                    close_signalled = True
                elif (side == 'sell'):
                    row['signal'] = 1
                    row['position'] = 0.0
                    close_signalled = True

            return finish()

        # if distinct 'out' signal, and position is opened, use that and finish
        if((open_signalled and not close_signalled) and out_signal):
            if(out_signal[:3] == 'TRL'):
                row['position'] = prev_row['position']
                trl_amt = float(out_signal[3:])

                delta_s = (rowDateTime - maxDateTime).total_seconds()
                # by 8:05, stop approx 1/4 of original
                if(delta_s > 120):
                    trl_amt /= 2
                if(delta_s > 60):
                    trl_amt /= 1.5
                if(delta_s > 30):
                    trl_amt /= 1.25
                if(delta_s > 0):
                    trl_amt /= 1.125
                
                
                if(side == 'buy'):
                    row['max_touch'] = df.iloc[index]['high'] if (not prev_row['max_touch']) else max(prev_row['max_touch'], df.iloc[index]['high'])
                    max_touch = row['max_touch'] if (index == 0) else prev_row['max_touch'] # use max touch from prev row, because no guarantee that low came after high
                    delta = (row['max_touch'] - df.iloc[index]['low']) / row['max_touch']

                    if(delta >= trl_amt):
                        row['signal'] = -1
                        row['position'] = 0.0
                        close_signalled = True
                

                elif(side == 'sell'):
                    trl_amt *= -1
                    row['max_touch'] = df.iloc[index]['low'] if (not prev_row['max_touch']) else min(prev_row['max_touch'], df.iloc[index]['low'])
                    max_touch = row['max_touch'] if (index == 0) else prev_row['max_touch'] # use max touch from prev row, because no guarantee that low came after high
                    delta = (row['max_touch'] - df.iloc[index]['high']) / row['max_touch']

                    if(delta <= trl_amt):
                        row['signal'] = 1
                        row['position'] = 0.0
                        close_signalled = True

            return finish()
        
        else:
            # add moving average signals for 'in' (and 'out', if not defined separately)
            if(row['ma_x'] == 1.0):
                # no change from prev row
                if (index  > 0 and prev_row['ma_x'] == 1.0):
                    row['position'] = prev_row['position']
                    return finish()

                if(side == 'buy' and not open_signalled and rowDateTime <= maxDateTime):
                    row['signal'] = 1.0
                    row['position'] = pos_size
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
                    row['position'] = -1 * pos_size
                    open_signalled = True
                if(side == 'buy' and (open_signalled and not close_signalled)):
                    row['signal'] = -1.0
                    row['position'] = 0.0
                    close_signalled = True

        return finish()

    signals = signals.apply(addSignals, axis=1)

    # look-ahead bias...prevent by getting close of current crossover period, rather than shifting?
    # signals = signals[['position', 'signal']].shift(1).fillna(0.0) # prevent look-ahead bias

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
    portfolio['total'] = portfolio['cash'] + (portfolio['holdings'])
    portfolio['returns'] = portfolio['total'].pct_change()
    
    # update original dataframe
    df['size'] = positions['size']
    df['signal'] = signals['signal']
    df['total'] = portfolio['total']
    df['holdings'] = portfolio['holdings']
    df['cash'] = portfolio['cash']
    df['returns'] = portfolio['returns']
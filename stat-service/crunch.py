import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import mplfinance as mpf
from pandas_datareader import data as pdr

def crunchData(data):
    df = pd.DataFrame.from_records(data, index="startTime")
    addMovingAverages(df)
    return df.to_json(orient='records')

def addMovingAverages(df): 
    # df['MA20'] = df["close"].rolling(window=14).mean()
    # df['MA9'] = df["close"].rolling(window=9).mean()
    df['EMA9'] = df['close'].ewm(span=9, adjust=False).mean()
    df['EMA20'] = df['close'].ewm(span=20, adjust=False).mean()
    return df

# def addRsi(df):
#     delta = df['close'].diff()
#     up = delta.clip(lower=0)
#     down = -1*delta.clip(upper=0)
#     ema_up = up.ewm(com=13, adjust=False).mean()
#     ema_down = down.ewm(com=13, adjust=False).mean()
#     rs = ema_up/ema_down
#     df['RSI'] = 100 - (100/(1 + rs))
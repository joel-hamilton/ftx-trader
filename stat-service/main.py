import datetime
import json
import pandas as pd
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
# from .fetchData import fetch
# from .makeCharts import make
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def response():
    return "hi"

@app.get("/data/{ticker}")
async def getData(ticker):
    start = datetime.date.today() - pd.Timedelta(weeks=52 * 100)
    df = fetch([ticker], start, datetime.date.today())
    df.reset_index(inplace=True)
    df.drop('Ticker', axis=1, inplace=True)
    return json.loads(df.to_json())
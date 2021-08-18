from .crunch import crunchData, getMaCross
import datetime
import json
import pandas as pd
from fastapi import FastAPI, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Any, Dict

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

@app.get('/')
def test():
    pass

@app.post("/getStats")
async def get_body(request: Request):
    jsonObj = await request.json()
    crunchedData = crunchData(jsonObj["data"], jsonObj["indicators"], jsonObj["backtestParams"])
    return json.loads(crunchedData)

@app.post("/getMaCross")
async def get_cross(request: Request):
    jsonObj = await request.json()
    crunchedData = getMaCross(jsonObj["data"], jsonObj["ma1"], jsonObj["ma2"])
    return json.loads(crunchedData)

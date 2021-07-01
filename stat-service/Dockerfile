# https://github.com/tiangolo/uvicorn-gunicorn-docker
FROM tiangolo/uvicorn-gunicorn-fastapi:python3.7
EXPOSE 3334
ENV PORT 3334
ENV MODULE_NAME stat-service.main
ENV VARIABLE_NAME app
# ENV PRE_START_PATH /app/api/prestart.sh

RUN /usr/local/bin/python -m pip install --upgrade pip && apt-get update && apt-get install -y python3-dev libpq-dev && pip install pandas-datareader && pip install watermark && pip install yfinance && pip install datetime && pip install mplfinance && pip install psycopg2
COPY . /app/stat-service
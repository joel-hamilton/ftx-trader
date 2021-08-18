# FTX Trader

An app for automated crypto trading. Built with a microservice architecture, it includes a backtesting suite, Twitter integration for automated sentiment-based trading, and scheduled fetching and archival of hard-to-get data.

## Architecture
This runs on my server, using `api/docker-compose.yml` to orchestrate the different microservices:
- API (NodeJS/ExpressJS)
    - Runs automated trading strategies
    - Runs cron tasks to fetch and archive hard-to-get data
    - Fetches on-request time-series data
    - Updates Twitter rules
- Stats Service (Python/FastAPI)
    - Backtests time-series data against arbitrary params
- Storage Service (Postgres)
    - Stores data used in backtesting (a lot of it can't be accessed from any available API)
- Frontend (VueJS)
    - Testing API calls
    - Charting time-series data
    - Running and charting backtests

{{finance|nodejs|express|python|numpy|vuejs|docker|postgresql|twitter}}
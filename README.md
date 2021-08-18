# FTX Trader

An app for automated crypto trading. Built with a microservice architecture, it includes a backtesting suite, Twitter integration for automated sentiment-based trading, and scheduled fetching and archival of hard-to-get data.

## Architecture
This runs on my server, using `api/docker-compose.yml` to orchestrate the different microservices. 

{{finance|nodejs|python|numpy|docker|postgresql}}

## Getting postgres running in Docker
From: https://hackernoon.com/dont-install-postgres-docker-pull-postgres-bee20e200198

on new system - `docker pull postgres` // in package.json point to postgres volume, will need to mkdir
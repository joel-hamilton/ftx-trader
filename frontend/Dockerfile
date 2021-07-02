FROM node:12.18.0-slim AS base
EXPOSE 8080
WORKDIR /app/frontend

ENV NODE_ENV development

COPY package*.json ./
RUN npm install
COPY . .

CMD ["npm", "run", "serve"]
FROM node:12.18.0-slim AS base
EXPOSE 3000
ENV PORT 3000
WORKDIR /app/api
ENV PATH /app/api/node_modules/.bin:$PATH
RUN npm install

CMD ["nodemon", "./bin/www", "--ignore ./data/"]

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

WORKDIR /usr/src/app

RUN apk add --no-cache aria2

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/dist-server ./dist-server

ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist-server/index.js"]

FROM node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34 AS build

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

FROM node:22.22.0-alpine@sha256:e4bf2a82ad0a4037d28035ae71529873c069b13eb0455466ae0bc13363826e34

WORKDIR /usr/src/app

RUN apk add --no-cache aria2

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/dist-server ./dist-server

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "dist-server/server/index.js"]

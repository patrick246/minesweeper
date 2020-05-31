FROM node:10 as builder
WORKDIR /usr/src/app
COPY ./game ./game/
COPY ./server ./server
RUN cd game && npm install && npm run build && cd ..
RUN cd server && npm install && npm run build && cd ..

FROM node:10-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/server/node_modules ./node_modules/
COPY --from=builder /usr/src/app/game/ ./node_modules/game
COPY --from=builder /usr/src/app/server/dist ./dist/

CMD ["node", "dist/index.js"]
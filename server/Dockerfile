FROM node:14 as builder
WORKDIR /usr/src/app
COPY ./communication ./communication/
COPY ./game ./game/
COPY ./server ./server
RUN cd game && npm install && npm run build && cd ..
RUN cd communication && npm install && npm run build && cd ..
RUN cd server && npm install && npm run build && cd ..

FROM node:14-alpine
WORKDIR /usr/src/app
COPY --from=builder /usr/src/app/server/node_modules ./node_modules/
COPY --from=builder /usr/src/app/game/ ./node_modules/game
COPY --from=builder /usr/src/app/communication/ ./node_modules/communication
COPY --from=builder /usr/src/app/server/dist ./dist/

CMD ["node", "dist/index.js"]
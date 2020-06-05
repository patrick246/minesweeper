FROM node:10 AS builder
WORKDIR /usr/src/app
COPY ./client ./client/
COPY ./game ./game/
COPY ./communication ./communication/
RUN ls -lisah ./game
RUN cd game && npm install && npm run build && cd ..
RUN cd communication && npm install && npm run build && cd ..
RUN cd client && npm install && npm run build -- -p

FROM nginx:latest
COPY --from=builder /usr/src/app/client/dist /usr/share/nginx/html/

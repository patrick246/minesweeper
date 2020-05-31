# minesweeper

Parts:
 - Game: The library that defines the game interface, the game logic, and a game client
 - Server: WebSocket server that includes the game library and acts as a RPC over Websocket server
 - Client: A PIXI.JS frontend that renders the minesweeper field in the browser and interacts with the game client
 
## How to run
Build the game library

```
cd game
npm install
npm run build
```

Build the server and run it

```
cd ../server
npm install
npm run build && npm run start
```

Build the client in dev mode

```
cd ../client
npm install
npm run serve
```
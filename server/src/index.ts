import {GameServer} from "./GameServer";
import {CoreGame} from "game";

let gamePort = 3000;
const gamePortStr = process.env.GAME_PORT;
if(gamePortStr) {
    gamePort = parseInt(gamePortStr) || gamePort;
}

const gameServer = new GameServer(new CoreGame(), gamePort);
gameServer.run().catch(err => console.error(err));
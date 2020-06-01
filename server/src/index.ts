import {GameServer} from "./GameServer";
import {CoreGame} from "game";

let gamePort = 3000;
const gamePortStr = process.env.GAME_PORT;
if(gamePortStr) {
    gamePort = parseInt(gamePortStr) || gamePort;
}

let difficulty = parseFloat(process.env.GAME_DIFFICULTY || '0.155') || 0.155;

const gameServer = new GameServer(new CoreGame(difficulty), gamePort);
gameServer.run().catch(err => console.error(err));
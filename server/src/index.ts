import {GameServer} from "./GameServer";
import {CoreGame} from "game";
import {MongoClient} from "mongodb";
import {MongoDbChunkPersistence} from "./persistence/MongoDbChunkPersistence";
import {collectDefaultMetrics, register} from "prom-client";
import * as http from "http";

(async function () {
    collectDefaultMetrics();
    try {
        let gamePort = 3000;
        const gamePortStr = process.env.GAME_PORT;
        if (gamePortStr) {
            gamePort = parseInt(gamePortStr) || gamePort;
        }

        let difficulty = parseFloat(process.env.GAME_DIFFICULTY || '0.155') || 0.155;

        const databaseUri = process.env.GAME_DB_URI || 'mongodb://localhost:27017/minesweeper';

        const mongodbClient = new MongoClient(databaseUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            ignoreUndefined: true
        });
        await mongodbClient.connect();

        const metricsServer = http.createServer((_, res) => {
           res.writeHead(200);
           res.end(register.metrics());
        });
        metricsServer.listen(gamePort + 1);

        const gameServer = new GameServer(new CoreGame(difficulty, new MongoDbChunkPersistence(mongodbClient.db().collection('chunks'))), gamePort);
        await gameServer.run();
    } catch (err) {
        console.error(err);
    }
})();

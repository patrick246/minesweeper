import {GameServer} from "./GameServer";
import {CoreGame} from "game";
import {MongoClient} from "mongodb";
import {MongoDbChunkPersistence} from "./persistence/MongoDbChunkPersistence";
import {collectDefaultMetrics, register} from "prom-client";
import * as http from "http";
import {initTracer, PrometheusMetricsFactory} from 'jaeger-client';
import * as promClient from 'prom-client';

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

        const tracer = initTracer({
            serviceName: 'minesweeper-server',
            reporter: {
                agentHost: 'localhost',
                agentPort: 6832
            },
            sampler: {
                type: 'const',
                param: 1
            }
        }, {
            metrics: new PrometheusMetricsFactory(promClient as any, 'minesweeper_server'),
            logger: {
                info(msg: string) {
                    console.log(msg);
                },
                error(msg: string) {
                    console.error(msg);
                }
            }
        });

        const gameServer = new GameServer(
            new CoreGame(difficulty, new MongoDbChunkPersistence(mongodbClient.db().collection('chunks')), tracer),
            gamePort,
            tracer
        );
        await gameServer.run();
    } catch (err) {
        console.error(err);
    }
})();

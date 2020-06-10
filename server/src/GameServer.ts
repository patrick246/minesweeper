import {
    ChunkSizeResponse,
    ChunkUpdateMessage,
    FlagRequest,
    GetChunkRequest,
    GetChunkResponse,
    Message,
    OpenRequest,
    RegisterChunkListenerRequest,
    RegisterChunkListenerResponse,
    RemoveChunkListenerRequest,
} from "communication";
import {
    ChunkedPosition,
    ChunkUpdate,
    Game,
    Vector2
} from "game";
import WebSocket, {MessageEvent, Server} from 'ws';
import {Counter, exponentialBuckets, Gauge, Histogram} from "prom-client";
import {Context} from "game/dist";
import {Tracer} from "opentracing";
import Span from "opentracing/lib/span";

const websocketMessageProcessingHistogram = new Histogram({
    name: 'ws_request_duration_seconds',
    help: 'Websocket request processing latency in seconds',
    labelNames: ['type'],
    buckets: exponentialBuckets(0.001, 1.5, 20)
});

const chunkUpdateListenerGauge = new Gauge({
    name: 'game_chunk_listener_amount',
    help: 'Number of registered chunk listeners by websocket clients'
});

const chunkUpdateCounter = new Counter({
    name: 'game_chunk_update_count',
    help: 'Number of chunk updates sent out to websocket clients'
});

const websocketOpenConnectionsGauge = new Gauge({
    name: 'ws_connection_amount',
    help: 'Number of open websocket connections'
});

export class GameServer {
    private server: Server | undefined;
    constructor(private game: Game, private port: number, private tracer: Tracer) {
    }

    public async run(): Promise<void> {
        this.server = new Server({
            port: this.port
        });

        this.server.on("connection", (socket: WebSocket) => {
            console.log('[GameServer] Connection', socket);
            websocketOpenConnectionsGauge.inc();
            const listenerSet = new Set<string>();
            socket.onmessage = event => this.handleMessage(event, socket, listenerSet);
            socket.onclose = async () => {
                await Promise.all([...listenerSet].map(async (token) => {
                    await this.game.removeListener(Context.empty(), token);
                }));
                chunkUpdateListenerGauge.dec(listenerSet.size);
                websocketOpenConnectionsGauge.dec();
            }
        });

        console.log('[GameServer] Server started');
    }

    private async handleMessage(message: MessageEvent, socket: WebSocket, listeners: Set<string>): Promise<void> {
        const messageSpan = this.tracer.startSpan('websocket_message', {
            tags: {
                component: 'world_server',
            }
        });
        const requestTimer = websocketMessageProcessingHistogram.startTimer();
        const request = GameServer.readMessage(message);
        console.log(request);
        messageSpan.logEvent('message_decoded', {type: request.type});
        messageSpan.addTags({
            method: request.type
        });

        let response: Message | undefined;

        switch (request.type) {
            case 'get_chunk_request':
                response = await this.handleGetChunkRequest(request);
                break;
            case "open_request":
                await this.handleOpenRequest(request);
                break;
            case "flag_request":
                await this.handleFlagRequest(request, messageSpan);
                break;
            case "register_chunk_listener":
                response = await this.handleRegisterChunkListener(request, socket, listeners);
                break;
            case "remove_chunk_listener":
                await this.handleRemoveChunkListener(request, listeners);
                break;
            case "chunk_size_request":
                response = await this.handleChunkSizeRequest();
                break;
            default:
                console.log('[GameServer] Did not handle message of type', request.type);
        }
        if(response) {
            messageSpan.logEvent('response_sending', {type: response.type});
            socket.send(JSON.stringify(response));
            messageSpan.logEvent('response_sent', {type: response.type});
        }
        requestTimer({type: request.type});
        messageSpan.finish();
    }

    private static readMessage(event: MessageEvent): Message {
        let strContent: string;
        if(event.data instanceof Buffer) {
            strContent = event.data.toString();
        } else if(event.data instanceof ArrayBuffer) {
            strContent =  String.fromCharCode.apply(null, [...new Uint16Array(event.data)]);
        } else {
            strContent = event.data as string;
        }

        const message = JSON.parse(strContent);
        if(!message.type) {
            throw new Error("Could not detect message type");
        }
        return message;
    }

    private async handleGetChunkRequest(message: GetChunkRequest): Promise<GetChunkResponse> {
        if(!message.data) {
            console.log('[GameServer][GetChunkRequest] Received message without data');
            throw new Error("Received message without data");
        }
        const chunkContent = await this.game.getTileContents(Context.empty(), Vector2.copy(message.data));
        return {
            type: "get_chunk_response",
            data: {
                chunk: message.data,
                content: chunkContent.map(elem => {
                    if(elem === 'closed') {
                        return 'c';
                    }
                    if(elem === 'flag') {
                        return 'f';
                    }
                    if(elem === 'mine') {
                        return 'm';
                    }
                    return elem;
                }),
                size: await this.game.getChunkSize(Context.empty())
            }
        };
    }

    private async handleOpenRequest(message: OpenRequest): Promise<void> {
        if(!message.position) {
            console.log('[GameServer][OpenRequest] Received message without position');
            return;
        }
        await this.game.openTile(Context.empty(), ChunkedPosition.copy(message.position));
    }

    private async handleFlagRequest(message: FlagRequest, span: Span): Promise<void> {
        if(!message.position) {
            console.log('[GameServer][FlagRequest] Received message without position');
            return;
        }
        await this.game.flag(Context.empty().withSpan(span), ChunkedPosition.copy(message.position));
    }

    private async handleRegisterChunkListener(message: RegisterChunkListenerRequest, socket: WebSocket, listeners: Set<string>): Promise<RegisterChunkListenerResponse> {
        if(!message.chunkPosition) {
            console.log('[GameServer][RegChunkListener] Received chunk listener request without chunk', message);
            throw new Error("Chunk Listener request without chunk");
        }
        const token = await this.game.on(Context.empty(), 'update', Vector2.copy(message.chunkPosition), (update: ChunkUpdate) => {
            socket.send(JSON.stringify({
                type: 'chunk_update',
                data: {
                    chunk: update.chunk,
                    contents: update.field,
                    size: update.size,
                    token: token
                }
            } as ChunkUpdateMessage));
            chunkUpdateCounter.inc();
        });
        listeners.add(token);
        chunkUpdateListenerGauge.inc();
        return {
            type: "register_chunk_listener_response",
            chunk: message.chunkPosition,
            token,
        };
    }

    private async handleRemoveChunkListener(message: RemoveChunkListenerRequest, listeners: Set<string>): Promise<void> {
        if(!message.token) {
            console.log('[GameServer][RegChunkListener] Received remove chunk listener request without token', message);
            return;
        }
        await this.game.removeListener(Context.empty(), message.token);
        listeners.delete(message.token);
        chunkUpdateListenerGauge.dec();
    }

    private async handleChunkSizeRequest(): Promise<ChunkSizeResponse> {
        return {
            type: "chunk_size_response",
            size: await this.game.getChunkSize(Context.empty())
        };
    }
}
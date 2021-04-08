import {
    ChunkSizeResponse,
    ChunkUpdateMessage,
    ClickListenerRegisterRequest,
    ClickListenerRegisterResponse,
    ClickListenerUnregisterRequest,
    ClickMessage,
    FlagRequest,
    GetChunkRequest,
    GetChunkResponse,
    LoginRequest,
    LoginResponse,
    Message,
    OpenRequest,
    RegisterChunkListenerRequest,
    RegisterChunkListenerResponse,
    RegisterTopListListenerRequest,
    RegisterTopListListenerResponse,
    RemoveChunkListenerRequest,
    TopListMessage,
    UnregisterTopListListenerRequest,
} from "communication";
import {ChunkedPosition, ChunkUpdate, Game, Vector2} from "game";
import WebSocket, {MessageEvent, Server} from 'ws';
import {Counter, exponentialBuckets, Gauge, Histogram} from "prom-client";
import {Context} from "game/dist";
import {Tracer} from "opentracing";
import {PointTracker, track} from "game/dist/user/PointTracker";
import {Connection} from "./Connection";
import {UserService} from "./usermanagement/UserService";

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

const clickListenerGauge = new Gauge({
    name: 'game_click_listener_amount',
    help: 'Number of registered click listeners by websocket clients'
});

const topUpdateListenerGauge = new Gauge({
    name: 'game_top_listener_amount',
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
    constructor(
        private game: Game,
        private port: number,
        private tracer: Tracer,
        private pointTracker: PointTracker,
        private userService: UserService,
    ) {
    }

    public async run(): Promise<void> {
        this.server = new Server({
            port: this.port
        });

        this.server.on("connection", (socket: WebSocket) => {
            console.log('[GameServer] Connection');
            websocketOpenConnectionsGauge.inc();
            const connection = new Connection(socket);
            socket.onmessage = event => this.handleMessage(Context.empty(), event, socket, connection);
            socket.onclose = async () => {
                await Promise.all([...connection.getChunkListener()].map(async (token) => {
                    await this.game.removeListener(Context.empty(), token);
                }));
                chunkUpdateListenerGauge.dec(connection.getChunkListener().size);

                await Promise.all([...connection.getClickListener()].map(token => this.game.removeClickListener(Context.empty(), token)));
                clickListenerGauge.dec(connection.getClickListener().size);

                await Promise.all([...connection.getTopListener()].map(token => this.game.removeTopListener(Context.empty(), token)));
                topUpdateListenerGauge.dec(connection.getTopListener().size);

                websocketOpenConnectionsGauge.dec();
            }
        });

        console.log('[GameServer] Server started');
    }

    private async handleMessage(ctx: Context, message: MessageEvent, socket: WebSocket, connection: Connection): Promise<void> {
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
        messageSpan.setOperationName(request.type);

        let response: Message | undefined;

        let innerCtx = ctx.withSpan(messageSpan);

        if (connection.isAuthenticated()) {
            innerCtx = innerCtx
                .withData('user', connection.getUser())
                .withData('track', track(this.pointTracker, connection.getUser()!.getUsername()));
        }

        if (request.type != 'login_request' && !connection.isAuthenticated()) {
            messageSpan.finish();
            return;
        }

        switch (request.type) {
            case "login_request":
                response = await this.handleLoginRequest(innerCtx, request, connection);
                break;
            case 'get_chunk_request':
                response = await this.handleGetChunkRequest(innerCtx, request);
                break;
            case "open_request":
                await this.handleOpenRequest(innerCtx, request);
                break;
            case "flag_request":
                await this.handleFlagRequest(innerCtx, request);
                break;
            case "register_chunk_listener":
                response = await this.handleRegisterChunkListener(innerCtx, request, connection);
                break;
            case "remove_chunk_listener":
                await this.handleRemoveChunkListener(innerCtx, request, connection);
                break;
            case "chunk_size_request":
                response = await this.handleChunkSizeRequest(innerCtx);
                break;
            case "click_listener_register_request":
                response = await this.handleRegisterClickListener(innerCtx, request, connection);
                break;
            case "click_listener_unregister_request":
                await this.handleUnregisterClickListener(innerCtx, request, connection);
                break;
            case "register_top_list_listener_request":
                response = await this.handleTopListListenerRequest(innerCtx, request, connection);
                break;
            case "unregister_top_list_listener_request":
                await this.handleUnregisterTopListListener(innerCtx, request, connection);
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

    private async handleGetChunkRequest(ctx: Context, message: GetChunkRequest): Promise<GetChunkResponse> {
        if(!message.data) {
            console.log('[GameServer][GetChunkRequest] Received message without data');
            throw new Error("Received message without data");
        }
        const chunkContent = await this.game.getTileContents(ctx, Vector2.copy(message.data));
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

    private async handleOpenRequest(ctx: Context, message: OpenRequest): Promise<void> {
        if(!message.position) {
            console.log('[GameServer][OpenRequest] Received message without position');
            return;
        }
        await this.game.openTile(ctx, ChunkedPosition.copy(message.position));
    }

    private async handleFlagRequest(ctx: Context, message: FlagRequest): Promise<void> {
        if(!message.position) {
            console.log('[GameServer][FlagRequest] Received message without position');
            return;
        }
        await this.game.flag(ctx, ChunkedPosition.copy(message.position));
    }

    private async handleRegisterChunkListener(ctx: Context, message: RegisterChunkListenerRequest, connection: Connection): Promise<RegisterChunkListenerResponse> {
        if(!message.chunkPosition) {
            console.log('[GameServer][RegChunkListener] Received chunk listener request without chunk', message);
            throw new Error("Chunk Listener request without chunk");
        }
        const token = await this.game.on(ctx, 'update', Vector2.copy(message.chunkPosition), (update: ChunkUpdate) => {
            connection.getSocket().send(JSON.stringify({
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
        connection.getChunkListener().add(token);
        chunkUpdateListenerGauge.inc();
        return {
            type: "register_chunk_listener_response",
            chunk: message.chunkPosition,
            token,
        };
    }

    private async handleRemoveChunkListener(ctx: Context, message: RemoveChunkListenerRequest, connection: Connection): Promise<void> {
        if(!message.token) {
            console.log('[GameServer][RegChunkListener] Received remove chunk listener request without token', message);
            return;
        }
        await this.game.removeListener(ctx, message.token);
        if (connection.getChunkListener().delete(message.token)) {
            chunkUpdateListenerGauge.dec();
        }
    }

    private async handleChunkSizeRequest(ctx: Context): Promise<ChunkSizeResponse> {
        return {
            type: "chunk_size_response",
            size: await this.game.getChunkSize(ctx)
        };
    }

    private async handleLoginRequest(_: Context, request: LoginRequest, connection: Connection): Promise<LoginResponse> {
        const user = await this.userService.getUser(request.secret);
        connection.setUser(user);
        return {
            type: "login_response",
            username: user.getUsername(),
            result: "success",
        };
    }

    private async handleRegisterClickListener(ctx: Context, request: ClickListenerRegisterRequest, connection: Connection): Promise<ClickListenerRegisterResponse> {
        const token = await this.game.on(ctx, 'click', Vector2.copy(request.chunk), clickUpdate => {
            connection.getSocket().send(JSON.stringify({
                type: "click_message",
                token: token,
                user: clickUpdate.username,
                size: clickUpdate.position.getChunkSize(),
                position: clickUpdate.position.getPosition(),
                chunk: clickUpdate.position.getChunk(),
            } as ClickMessage));
        });
        clickListenerGauge.inc();
        connection.getClickListener().add(token);
        return {
            type: 'click_listener_register_response',
            token: token,
            chunk: request.chunk,
        };
    }

    private async handleTopListListenerRequest(ctx: Context, _: RegisterTopListListenerRequest, connection: Connection) {
        const token = await this.game.onTopList(ctx, topListUpdate => {
           connection.getSocket().send(JSON.stringify({
               type: "top_message",
               entries: topListUpdate,
           } as TopListMessage));
        });
        topUpdateListenerGauge.inc();
        connection.getTopListener().add(token);
        return {
            type: "register_top_list_listener_response",
            token: token,
        } as RegisterTopListListenerResponse;
    }

    private async handleUnregisterClickListener(ctx: Context, request: ClickListenerUnregisterRequest, connection: Connection) {
        await this.game.removeClickListener(ctx, request.token);
        if (connection.getClickListener().delete(request.token)) {
            clickListenerGauge.dec();
        }
    }

    private async handleUnregisterTopListListener(ctx: Context, request: UnregisterTopListListenerRequest, connection: Connection) {
        await this.game.removeTopListener(ctx, request.token);
        if (connection.getTopListener().delete(request.token)) {
            topUpdateListenerGauge.dec();
        }
    }
}
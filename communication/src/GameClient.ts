import {ChunkedPosition, ChunkListener, ChunkUpdate, Context, Game, TileContent, Vector2} from "game";
import * as WebSocket from "isomorphic-ws";
import {MessageEvent} from "isomorphic-ws";
import {
    ChunkSizeRequest,
    ChunkSizeResponse, ClickListenerRegisterRequest, ClickListenerRegisterResponse, ClickListenerUnregisterRequest,
    FlagRequest,
    GetChunkRequest,
    GetChunkResponse, LoginRequest, LoginResponse,
    Message,
    OpenRequest,
    RegisterChunkListenerRequest,
    RegisterChunkListenerResponse, RegisterTopListListenerRequest, RegisterTopListListenerResponse,
    RemoveChunkListenerRequest, UnregisterTopListListenerRequest
} from ".";
import {EventEmitter} from "events";
import {ClickListener} from "game/dist/core/ClickListenerService";
import {ClickUpdate} from "game/dist/core/ClickUpdate";
import {TopListEntry} from "game/dist/user/PointTracker";
import {TopListenerCallback} from "game/dist/core/TopListenerService";

export class GameClient implements Game {
    private socket: WebSocket;
    private events: EventEmitter = new EventEmitter();
    private chunkUpdateListener: Map<string, ChunkListener> = new Map<string, ChunkListener>();
    private clickListener: Map<string, ClickListener> = new Map<string, ClickListener>();
    private topListener: {[token: string]: TopListenerCallback} = {};
    private chunkSizeCache: Vector2 | undefined;

    public constructor(server: string) {
        this.socket = new WebSocket(server);
        this.socket.onmessage = event => {
            const message = GameClient.readMessage(event);
            //console.log(message);
            if(!message.type) {
                console.log('[GameClient] Received message without type');
                return;
            }
            switch (message.type) {
                case "get_chunk_response":
                    this.events.emit(`chunk_response_${message.data.chunk.x}_${message.data.chunk.y}`, message);
                    break;
                case "register_chunk_listener_response":
                    this.events.emit(`chunk_listener_response_${message.chunk.x}_${message.chunk.y}`, message);
                    break;
                case "chunk_update":
                    const token = message.data.token;
                    const listener = this.chunkUpdateListener.get(token);
                    if(listener) {
                        listener(new ChunkUpdate(Vector2.copy(message.data.chunk), message.data.contents, Vector2.copy(message.data.size)));
                    }
                    break;
                case "chunk_size_response":
                    this.events.emit('chunk_size_response', message);
                    break;
                case "login_response":
                    this.events.emit('login_response', message);
                    break;
                case "click_listener_register_response":
                    this.events.emit(`click_listener_register_response_${message.chunk.x}_${message.chunk.y}`, message);
                    break;
                case "click_message":
                    const clickToken = message.token;
                    const clickListener = this.clickListener.get(clickToken);
                    if (clickListener) {
                        clickListener(
                            new ClickUpdate(
                                new ChunkedPosition(
                                    Vector2.copy(message.chunk),
                                    Vector2.copy(message.position),
                                    Vector2.copy(message.size)
                                ), message.user
                            )
                        );
                    }
                    break;
                case "register_top_list_listener_response":
                    this.events.emit('register_top_list_listener_response', message);
                    break;
                case "top_message":
                    Object.values(this.topListener).forEach(cb => cb(message.entries));
                    break;
                default:
                    console.log('[GameClient] Received unknown message', message);
            }
        }

    }

    public waitForConnection(): Promise<void> {
        return new Promise(resolve => {
            this.socket.onopen = () => resolve();
        });
    }

    public isClosed(): boolean {
        return this.socket.readyState === WebSocket.CLOSED;
    }

    public async logIn(secret: string): Promise<LoginResponse> {
        const loginRequest: LoginRequest = {
            type: "login_request",
            secret: secret,
        };
        this.socket.send(JSON.stringify(loginRequest));
        return await this.waitForEvent<LoginResponse>('login_response');
    }

    public async flag(_: Context, position: ChunkedPosition): Promise<void> {
        const flagRequest: FlagRequest = {
            type: "flag_request",
            position
        };
        this.socket.send(JSON.stringify(flagRequest));
    }

    public async getChunkSize(): Promise<Vector2> {
        if(this.chunkSizeCache) {
             return this.chunkSizeCache;
        }
        const chunkSizeRequest: ChunkSizeRequest = {
            type: "chunk_size_request"
        };
        this.socket.send(JSON.stringify(chunkSizeRequest));
        const response = await this.waitForEvent<ChunkSizeResponse>('chunk_size_response');
        this.chunkSizeCache = Vector2.copy(response.size);
        return this.chunkSizeCache;
    }

    public async getTileContents(_: Context, chunk: Vector2): Promise<TileContent[]> {
        const tileContentMessage: GetChunkRequest = {
            type: "get_chunk_request",
            data: chunk
        };
        this.socket.send(JSON.stringify(tileContentMessage));
        const response = await this.waitForEvent<GetChunkResponse>(`chunk_response_${chunk.x}_${chunk.y}`);
        return response.data.content.map(elem => {
            if(elem === 'c') {
                return 'closed';
            }
            if(elem === 'f') {
                return 'flag';
            }
            if(elem === 'm') {
                return 'mine';
            }
            return elem;
        });
    }

    public async on(ctx: Context, type: "update" | "click", chunk: Vector2, callback: ((update: ChunkUpdate) => void) | ((click: ClickUpdate) => void)): Promise<string> {
        switch (type) {
            case "update":
                return await this.onUpdate(ctx, chunk, callback as (update: ChunkUpdate) => void);
            case "click":
                return await this.onClick(ctx, chunk, callback as (update: ClickUpdate) => void);
        }
    }

    private async onUpdate(_: Context, chunk: Vector2, callback: (update: ChunkUpdate) => void): Promise<string> {
        const listenerRequest: RegisterChunkListenerRequest = {
            type: "register_chunk_listener",
            chunkPosition: chunk
        };
        this.socket.send(JSON.stringify(listenerRequest));
        const response = await this.waitForEvent<RegisterChunkListenerResponse>(`chunk_listener_response_${chunk.x}_${chunk.y}`);
        this.chunkUpdateListener.set(response.token, callback);
        return response.token;
    }

    private async onClick(_: Context, chunk: Vector2, callback: (update: ClickUpdate) => void): Promise<string> {
        const listenerRequest: ClickListenerRegisterRequest = {
            type: 'click_listener_register_request',
            chunk: chunk,
        };
        this.socket.send(JSON.stringify(listenerRequest));
        const response = await this.waitForEvent<ClickListenerRegisterResponse>(`click_listener_register_response_${chunk.x}_${chunk.y}`);
        this.clickListener.set(response.token, callback);
        return response.token;
    }

    public async onTopList(_: Context, callback: (top: TopListEntry[]) => void): Promise<string> {
        this.socket.send(JSON.stringify({
            type: 'register_top_list_listener_request',
        } as RegisterTopListListenerRequest));
        const response = await this.waitForEvent<RegisterTopListListenerResponse>('register_top_list_listener_response');
        this.topListener[response.token] = callback;
        return response.token;
    }

    public async removeTopListener(_: Context, token: string): Promise<void> {
        this.socket.send(JSON.stringify({
            type: 'unregister_top_list_listener_request',
            token: token,
        } as UnregisterTopListListenerRequest));
        delete this.topListener[token];
    }

    public async openTile(_: Context, position: ChunkedPosition): Promise<void> {
        const openRequest: OpenRequest = {
            type: "open_request",
            position
        };
        console.log('[GameClient] sending', openRequest);
        this.socket.send(JSON.stringify(openRequest));
    }

    public async removeListener(_: Context, token: string): Promise<void> {
        const removeListenerRequest: RemoveChunkListenerRequest = {
            type: "remove_chunk_listener",
            token
        };
        this.socket.send(JSON.stringify(removeListenerRequest));
    }

    public async removeClickListener(_: Context, token: string): Promise<void> {
        const removeListenerRequest: ClickListenerUnregisterRequest = {
            type: 'click_listener_unregister_request',
            token: token,
        };
        this.socket.send(JSON.stringify(removeListenerRequest));
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

    private waitForEvent<T>(event: string): Promise<T> {
        return new Promise(resolve => {
           this.events.once(event, (arg: T) => {
               resolve(arg);
           });
        });
    }
}
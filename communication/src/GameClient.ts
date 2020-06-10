import {ChunkedPosition, ChunkListener, ChunkUpdate, Context, Game, TileContent, Vector2} from "game";
import * as WebSocket from "isomorphic-ws";
import {MessageEvent} from "isomorphic-ws";
import {
    ChunkSizeRequest,
    ChunkSizeResponse,
    FlagRequest,
    GetChunkRequest,
    GetChunkResponse,
    Message,
    OpenRequest,
    RegisterChunkListenerRequest,
    RegisterChunkListenerResponse,
    RemoveChunkListenerRequest
} from ".";
import {EventEmitter} from "events";

export class GameClient implements Game {
    private socket: WebSocket;
    private events: EventEmitter = new EventEmitter();
    private chunkUpdateListener: Map<string, ChunkListener> = new Map<string, ChunkListener>();
    private chunkSizeCache: Vector2 | undefined;

    public constructor(server: string) {
        this.socket = new WebSocket(server);
        this.socket.onmessage = event => {
            const message = GameClient.readMessage(event);
            console.log(message);
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

    public async on(__: Context, _: "update", chunk: Vector2, callback: (update: ChunkUpdate) => void): Promise<string> {
        const listenerRequest: RegisterChunkListenerRequest = {
            type: "register_chunk_listener",
            chunkPosition: chunk
        };
        this.socket.send(JSON.stringify(listenerRequest));
        const response = await this.waitForEvent<RegisterChunkListenerResponse>(`chunk_listener_response_${chunk.x}_${chunk.y}`);
        this.chunkUpdateListener.set(response.token, callback);
        return response.token;
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
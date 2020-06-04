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

export class GameServer {
    private server: Server | undefined;
    constructor(private game: Game, private port: number) {
        void(game);
    }

    public async run(): Promise<void> {
        this.server = new Server({
            port: this.port
        });

        this.server.on("connection", (socket: WebSocket) => {
            console.log('[GameServer] Connection', socket);
            const listenerSet = new Set<string>();
            socket.onmessage = event => this.handleMessage(event, socket, listenerSet);
            socket.onclose = async () => {
                await Promise.all([...listenerSet].map(async (token) => {
                    await this.game.removeListener(token);
                }));
            }
        });
        console.log('[GameServer] Server started');
    }

    private async handleMessage(message: MessageEvent, socket: WebSocket, listeners: Set<string>): Promise<void> {
        const request = GameServer.readMessage(message);
        console.log(request);

        let response: Message | undefined;

        switch (request.type) {
            case 'get_chunk_request':
                response = await this.handleGetChunkRequest(request);
                break;
            case "open_request":
                await this.handleOpenRequest(request);
                break;
            case "flag_request":
                await this.handleFlagRequest(request);
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
            socket.send(JSON.stringify(response));
        }
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
        const chunkContent = await this.game.getTileContents(Vector2.copy(message.data));
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
                size: await this.game.getChunkSize()
            }
        };
    }

    private async handleOpenRequest(message: OpenRequest): Promise<void> {
        if(!message.position) {
            console.log('[GameServer][OpenRequest] Received message without position');
            return;
        }
        await this.game.openTile(ChunkedPosition.copy(message.position));
    }

    private async handleFlagRequest(message: FlagRequest): Promise<void> {
        if(!message.position) {
            console.log('[GameServer][FlagRequest] Received message without position');
            return;
        }
        await this.game.flag(ChunkedPosition.copy(message.position));
    }

    private async handleRegisterChunkListener(message: RegisterChunkListenerRequest, socket: WebSocket, listeners: Set<string>): Promise<RegisterChunkListenerResponse> {
        if(!message.chunkPosition) {
            console.log('[GameServer][RegChunkListener] Received chunk listener request without chunk', message);
            throw new Error("Chunk Listener request without chunk");
        }
        const token = await this.game.on('update', Vector2.copy(message.chunkPosition), (update: ChunkUpdate) => {
            socket.send(JSON.stringify({
                type: 'chunk_update',
                data: {
                    chunk: update.chunk,
                    contents: update.field,
                    size: update.size,
                    token: token
                }
            } as ChunkUpdateMessage));
        });
        listeners.add(token);
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
        await this.game.removeListener(message.token);
        listeners.delete(message.token);
    }

    private async handleChunkSizeRequest(): Promise<ChunkSizeResponse> {
        return {
            type: "chunk_size_response",
            size: await this.game.getChunkSize()
        };
    }
}
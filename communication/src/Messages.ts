import {Vector2} from "game";
import {ChunkedPosition, TileContent} from "game";

export type Message =
    GetChunkRequest |
    GetChunkResponse |
    RegisterChunkListenerRequest |
    RegisterChunkListenerResponse |
    RemoveChunkListenerRequest |
    ChunkUpdateMessage |
    OpenRequest |
    FlagRequest |
    ChunkSizeRequest |
    ChunkSizeResponse;

export type TileContentTransport = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'c' | 'm' | 'f';

export interface GetChunkRequest {
    type: 'get_chunk_request',
    data?: Vector2
}

export interface GetChunkResponse {
    type: 'get_chunk_response',
    data: {
        chunk: Vector2,
        content: TileContentTransport[],
        size: Vector2
    }
}

export interface RegisterChunkListenerRequest {
    type: 'register_chunk_listener',
    chunkPosition?: Vector2
}

export interface RegisterChunkListenerResponse {
    type: 'register_chunk_listener_response',
    chunk: Vector2,
    token: string
}

export interface RemoveChunkListenerRequest {
    type: 'remove_chunk_listener',
    token: string
}

export interface ChunkUpdateMessage {
    type: 'chunk_update',
    data: {
        chunk: Vector2,
        contents: TileContent[],
        size: Vector2,
        token: string
    }
}

export interface OpenRequest {
    type: 'open_request',
    position: ChunkedPosition
}

export interface FlagRequest {
    type: 'flag_request',
    position: ChunkedPosition
}

export interface ChunkSizeRequest {
    type: 'chunk_size_request'
}

export interface ChunkSizeResponse {
    type: 'chunk_size_response',
    size: Vector2
}

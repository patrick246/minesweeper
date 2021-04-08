import {Vector2} from "game";
import {ChunkedPosition, TileContent} from "game";
import {TopListEntry} from "game/dist/user/PointTracker";

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
    ChunkSizeResponse |
    LoginRequest |
    LoginResponse |
    ClickMessage |
    ClickListenerRegisterRequest |
    ClickListenerRegisterResponse |
    ClickListenerUnregisterRequest |
    TopListMessage |
    RegisterTopListListenerRequest |
    RegisterTopListListenerResponse |
    UnregisterTopListListenerRequest;

export type TileContentTransport = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'c' | 'm' | 'f';

/**
 * Requests chunk contents, data contains a Vector2 with the chunk position
 */
export interface GetChunkRequest {
    type: 'get_chunk_request',
    data?: Vector2
}

/**
 * Response to GetChunkRequest
 * chunk is the position of the chunk as Vector2
 * content is an array of numbers 0-8 for number tiles or the chars c for closed, m for mine and f for flag
 * size is the chunk size as Vector2
 */
export interface GetChunkResponse {
    type: 'get_chunk_response',
    data: {
        chunk: Vector2,
        content: TileContentTransport[],
        size: Vector2
    }
}

/**
 * Registers the client to receive chunk updates for a certain chunk position
 */
export interface RegisterChunkListenerRequest {
    type: 'register_chunk_listener',
    chunkPosition?: Vector2
}

/**
 * Response to RegisterChunkListenerRequest
 * token is a opaque id which identifies this listener and is necessary for unregistering
 * chunk is the chunk position for which this token is valid
 */
export interface RegisterChunkListenerResponse {
    type: 'register_chunk_listener_response',
    chunk: Vector2,
    token: string
}

/**
 * Removes a previously registered chunk listener
 * token is the id from the register chunk listener
 * Clients are supposed to remove unneeded chunk listeners regularly.
 * In the future, servers may limit the number of chunk listeners
 */
export interface RemoveChunkListenerRequest {
    type: 'remove_chunk_listener',
    token: string
}

/**
 * Update message for chunks that are updated
 * chunk is the chunk position as Vector2
 * contents are the contents as numbers or strings
 * size is the chunk size as Vector2
 * token is the id of the registered chunk listener for which this update was generated
 */
export interface ChunkUpdateMessage {
    type: 'chunk_update',
    data: {
        chunk: Vector2,
        contents: TileContent[],
        size: Vector2,
        token: string
    }
}

/**
 * Request to open a tile. This is equivalent to a primary mouse button click in minesweeper.
 * This request has no response, the client is notified by chunk updates if the world changes.
 * position is the position of the tile split into chunk and offset position inside the chunk.
 *
 * Behavior requirements:
 * If the tile was not previously opened, it should be opened after this request. If the tile is a zero tile, all
 * neighboring tiles should be opened too. If these tiles are in turn a zero tile, the neighbors of this tile should
 * also be opened, and so on.
 * If the tile was previously opened, check if the flag count in the neighborhood is equal to the current tile value and
 * open every neighborhood tiles that are not flagged. The behavior for zero tiles also applies here.
 */
export interface OpenRequest {
    type: 'open_request',
    position: ChunkedPosition
}

/**
 * Request to flag a tile. This is equivalent to the secondary mouse button click in minesweeper.
 * This request has no response, the client is notified by chunk updates if the world changes in response.
 * position is the chunked position of the to be flagged tile.
 *
 * Behavior requirementS:
 * If the tile is closed: Place a flag on the tile if there is a mine under the tile, open the tile if not.
 * The server should reward the player with points for correct flags and detract points for incorrect flags.
 *
 * If the tile is opened: Check if the number of unopened tiles is equal or less than the current tile value, if yes,
 * place flags on all unopened neighborhood tiles.
 */
export interface FlagRequest {
    type: 'flag_request',
    position: ChunkedPosition
}

/**
 * Requests the chunk size used by the server. This value cannot change per server and can therefore be cached
 * by the client.
 */
export interface ChunkSizeRequest {
    type: 'chunk_size_request'
}

/**
 * Response to a ChunkSizeRequest
 * size is the chunk size in a Vector2. Chunks do not need to be square, but can be optimized to usual display ratios.
 */
export interface ChunkSizeResponse {
    type: 'chunk_size_response',
    size: Vector2
}

/*
 * Logs back in to an existing account, or registers a new one with the given secret.
 */
export interface LoginRequest {
    type: 'login_request',
    secret: string,
}

/*
 * Result of a log-in, returns the autogenerated username
 */
export interface LoginResponse {
    type: 'login_response',
    result: 'success' | 'failure',
    username: string
}

export interface ClickListenerRegisterRequest {
    type: 'click_listener_register_request',
    chunk: Vector2,
}

export interface ClickListenerRegisterResponse {
    type: 'click_listener_register_response',
    token: string,
    chunk: Vector2,
}

export interface ClickListenerUnregisterRequest {
    type: 'click_listener_unregister_request',
    token: string,
}

export interface ClickMessage {
    type: 'click_message',
    token: string,
    chunk: Vector2,
    position: Vector2,
    size: Vector2,
    user: string,
}

/*
 * Periodic messages that contain the top 5 players in the last 5 minutes
 */
export interface TopListMessage {
    type: 'top_message',
    entries: TopListEntry[],
}

/*
 *
 */
export interface RegisterTopListListenerRequest {
    type: 'register_top_list_listener_request'
}

export interface RegisterTopListListenerResponse {
    type: 'register_top_list_listener_response',
    token: string,
}

export interface UnregisterTopListListenerRequest {
    type: 'unregister_top_list_listener_request',
    token: string,
}
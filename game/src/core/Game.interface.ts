import {ChunkUpdate} from "./ChunkUpdate";
import {Vector2} from "../support";
import {TileContent} from "./Tile";
import {ChunkedPosition} from "./ChunkedPosition";

export interface Game {
    on(_: 'update', chunk: Vector2, callback: (update: ChunkUpdate) => void): Promise<string>;
    removeListener(token: string): Promise<void>;
    getTileContents(chunk: Vector2): Promise<TileContent[]>;
    getChunkSize(): Promise<Vector2>;
    openTile(position: ChunkedPosition): Promise<void>;
    flag(position: ChunkedPosition): Promise<void>;
}
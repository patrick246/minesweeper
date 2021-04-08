import {ChunkUpdate} from "./ChunkUpdate";
import {Context, Vector2} from "../support";
import {TileContent} from "./Tile";
import {ChunkedPosition} from "./ChunkedPosition";
import {ClickUpdate} from "./ClickUpdate";
import {TopListEntry} from "../user/PointTracker";

export interface Game {
    on(context: Context, _: 'update', chunk: Vector2, callback: (update: ChunkUpdate) => void): Promise<string>;
    on(context: Context, _: 'click', chunk: Vector2, callback: (click: ClickUpdate) => void): Promise<string>;
    onTopList(context: Context, callback: (top: TopListEntry[]) => void): Promise<string>;
    removeListener(context: Context, token: string): Promise<void>;
    removeClickListener(context: Context, token: string): Promise<void>;
    removeTopListener(context: Context, token: string): Promise<void>;
    getTileContents(context: Context, chunk: Vector2): Promise<TileContent[]>;
    getChunkSize(context: Context): Promise<Vector2>;
    openTile(context: Context, position: ChunkedPosition): Promise<void>;
    flag(context: Context, position: ChunkedPosition): Promise<void>;
}
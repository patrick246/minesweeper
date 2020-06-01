import {Vector2} from "../support";
import {TileContent} from "./Tile";
import {ChunkUpdate} from "./ChunkUpdate";
import {Game} from "./Game.interface";
import {ChunkedPosition} from "./ChunkedPosition";
import {World} from "./World";
import {ChunkListener, ChunkListenerService} from "./ChunkListenerService";

export class CoreGame implements Game {
    private readonly world: World;
    private readonly chunkListenerService: ChunkListenerService = new ChunkListenerService();
    private readonly updateListeners: Map<Symbol, ChunkListener[]> = new Map<Symbol, ChunkListener[]>();
    private readonly chunkSize: Vector2 = new Vector2(64, 32);

    constructor(difficulty: number) {
        this.world = new World(this.chunkSize, (update) => this.onChunkUpdate(update), difficulty);
    }

    public async on(_: 'update', chunk: Vector2, callback: (update: ChunkUpdate) => void): Promise<string> {
        return await this.chunkListenerService.registerListener(chunk, callback);
    }

    public async removeListener(token: string): Promise<void> {
        this.chunkListenerService.unregisterListener(token);
    }

    public async getTileContents(chunk: Vector2): Promise<TileContent[]> {
        return this.world.getChunkTiles(chunk);
    }

    public async getChunkSize(): Promise<Vector2> {
        return this.chunkSize;
    }

    public async openTile(position: ChunkedPosition): Promise<void> {
        console.log('opening tile', position);
        this.world.openTile(position);
    }

    public async flag(position: ChunkedPosition): Promise<void> {
        this.world.flag(position);
    }

    private onChunkUpdate(update: ChunkUpdate) {
        this.chunkListenerService.onChunkUpdate(update);
        const listeners = this.updateListeners.get(update.chunk.asMapKey());
        if(listeners !== undefined) {
            listeners.forEach(cb => cb(update));
        }
    }
}
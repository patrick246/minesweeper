import {Context, Vector2, Vector2Key} from "../support";
import {TileContent} from "./Tile";
import {ChunkUpdate} from "./ChunkUpdate";
import {Game} from "./Game.interface";
import {ChunkedPosition} from "./ChunkedPosition";
import {World} from "./World";
import {ChunkListener, ChunkListenerService} from "./ChunkListenerService";
import {ChunkPersistence} from "../persistence";
import {Tracer} from "opentracing";
import {traced} from "../support/tracingHelper";

export class CoreGame implements Game {
    private readonly world: World;
    private readonly chunkListenerService: ChunkListenerService = new ChunkListenerService();
    private readonly updateListeners: Map<Vector2Key, ChunkListener[]> = new Map<Vector2Key, ChunkListener[]>();
    private readonly chunkSize: Vector2 = new Vector2(64, 32);

    constructor(difficulty: number, chunkPersistence: ChunkPersistence, private tracer: Tracer) {
        this.world = new World(
            this.chunkSize,
            (update) => this.onChunkUpdate(update),
            difficulty,
            chunkPersistence,
            tracer
        );
    }

    @traced()
    public async on(__: Context, _: 'update', chunk: Vector2, callback: (update: ChunkUpdate) => void): Promise<string> {
        return await this.chunkListenerService.registerListener(chunk, callback);
    }

    @traced()
    public async removeListener(__: Context, token: string): Promise<void> {
        this.chunkListenerService.unregisterListener(token);
    }

    @traced()
    public async getTileContents(context: Context, chunk: Vector2): Promise<TileContent[]> {
        return await this.world.getChunkTiles(context, chunk);
    }

    @traced()
    public async getChunkSize(__: Context): Promise<Vector2> {
        return this.chunkSize;
    }

    @traced()
    public async openTile(context: Context, position: ChunkedPosition): Promise<void> {
        console.log('opening tile', position);
        await this.world.openTile(context, position);
    }

    @traced()
    public async flag(context: Context, position: ChunkedPosition): Promise<void> {
        await this.world.flag(context, position);
    }

    private onChunkUpdate(update: ChunkUpdate) {
        this.chunkListenerService.onChunkUpdate(update);
        const listeners = this.updateListeners.get(update.chunk.asMapKey());
        if(listeners !== undefined) {
            listeners.forEach(cb => cb(update));
        }
    }

    public getTracer(): Tracer {
        return this.tracer;
    }
}
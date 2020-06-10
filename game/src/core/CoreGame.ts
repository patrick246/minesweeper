import {Context, Vector2, Vector2Key} from "../support";
import {TileContent} from "./Tile";
import {ChunkUpdate} from "./ChunkUpdate";
import {Game} from "./Game.interface";
import {ChunkedPosition} from "./ChunkedPosition";
import {World} from "./World";
import {ChunkListener, ChunkListenerService} from "./ChunkListenerService";
import {ChunkPersistence} from "../persistence";
import {Tracer} from "opentracing";

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

    public async on(__: Context, _: 'update', chunk: Vector2, callback: (update: ChunkUpdate) => void): Promise<string> {
        return await this.chunkListenerService.registerListener(chunk, callback);
    }

    public async removeListener(__: Context, token: string): Promise<void> {
        this.chunkListenerService.unregisterListener(token);
    }

    public async getTileContents(context: Context, chunk: Vector2): Promise<TileContent[]> {
        return await this.world.getChunkTiles(context, chunk);
    }

    public async getChunkSize(__: Context): Promise<Vector2> {
        return this.chunkSize;
    }

    public async openTile(__: Context, position: ChunkedPosition): Promise<void> {
        console.log('opening tile', position);
        await this.world.openTile(position);
    }

    public async flag(context: Context, position: ChunkedPosition): Promise<void> {
        const span = this.tracer.startSpan('CoreGame::flag', {childOf: context.getSpan()})
        await this.world.flag(context.withSpan(span), position);
        span.finish();
    }

    private onChunkUpdate(update: ChunkUpdate) {
        this.chunkListenerService.onChunkUpdate(update);
        const listeners = this.updateListeners.get(update.chunk.asMapKey());
        if(listeners !== undefined) {
            listeners.forEach(cb => cb(update));
        }
    }
}
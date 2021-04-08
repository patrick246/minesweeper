import {ChunkUpdate, Context, Game, TileContent, Vector2, Vector2Key} from "game/dist";
import {LocalChunk} from "./LocalChunk";
import {VisibleChunkCalculator} from "./VisibleChunkCalculator";

export class ChunkLoader {
    private chunks: Map<Vector2Key, LocalChunk> = new Map<Vector2Key, LocalChunk>();
    private chunkTokens: Map<Vector2Key, string> = new Map<Vector2Key, string>();
    private chunkSize?: Vector2;
    private inflightRequests: Map<Vector2Key, Promise<TileContent[]>> = new Map<Vector2Key, Promise<TileContent[]>>();
    private visibleChunkCalculator: VisibleChunkCalculator = new VisibleChunkCalculator();

    constructor(private game: Game, private tileSize: number) {
    }

    public async getChunksInViewport(position: Vector2, viewport: Vector2): Promise<LocalChunk[]> {
        const chunkSize = await this.getChunkSize();
        const visibleChunkPositions = this.visibleChunkCalculator.getVisibleChunks(position, viewport, chunkSize, this.tileSize);

        const visibleChunks: LocalChunk[] = await Promise.all(visibleChunkPositions.map(chunk => this.getChunk(chunk)));

        if (this.chunks.size > 8) {
            const visibleChunkKeys = visibleChunkPositions.map(pos => pos.asMapKey());
            for (let [key] of this.chunks.entries()) {
                if (!visibleChunkKeys.includes(key)) {
                    console.log('unloading chunk', key);
                    await this.unloadChunk(key);
                }
            }
        }

        return visibleChunks;
    }

    private async getChunk(chunkPos: Vector2): Promise<LocalChunk> {
        if (this.chunks.has(chunkPos.asMapKey())) {
            return this.chunks.get(chunkPos.asMapKey())!;
        }

        let chunkContentPromise: Promise<TileContent[]>;
        let shouldRegisterListener = false;
        if(this.inflightRequests.has(chunkPos.asMapKey())) {
            chunkContentPromise = this.inflightRequests.get(chunkPos.asMapKey())!;
        } else {
            chunkContentPromise = this.game.getTileContents(Context.empty(), chunkPos);
            this.inflightRequests.set(chunkPos.asMapKey(), chunkContentPromise);
            shouldRegisterListener = true;
        }

        let chunkContents: TileContent[];
        if(shouldRegisterListener) {
            const tokenPromise = this.game.on(Context.empty(), 'update', chunkPos, update => this.chunkUpdateListener(update));

            const [token, tempContent] = await Promise.all([tokenPromise, chunkContentPromise]);
            chunkContents = tempContent;
            this.chunkTokens.set(chunkPos.asMapKey(), token);
        } else {
            chunkContents = await chunkContentPromise;
        }

        const localChunk = new LocalChunk(chunkPos, await this.getChunkSize(), chunkContents);
        this.chunks.set(chunkPos.asMapKey(), localChunk);
        return localChunk;
    }

    private async unloadChunk(chunkKey: Vector2Key): Promise<void> {
        if (this.chunks.has(chunkKey)) {
            this.chunks.delete(chunkKey);
        }

        if (this.chunkTokens.has(chunkKey)) {
            const token = this.chunkTokens.get(chunkKey)!;
            await this.game.removeListener(Context.empty(), token);
            this.chunkTokens.delete(chunkKey);
        }
    }

    private async getChunkSize(): Promise<Vector2> {
        if (this.chunkSize) {
            return this.chunkSize;
        }
        this.chunkSize = await this.game.getChunkSize(Context.empty());
        return this.chunkSize;
    }

    private async chunkUpdateListener(chunkUpdate: ChunkUpdate): Promise<void> {
        const key = chunkUpdate.chunk.asMapKey();
        if (this.chunks.has(key)) {
            const localChunk = this.chunks.get(key)!;
            localChunk.updateContents(chunkUpdate.field);
        }
    }
}

import {ChunkUpdate, Game, TileContent, Vector2} from "game/dist";
import {LocalChunk} from "./LocalChunk";

export class ChunkLoader {
    private chunks: Map<Symbol, LocalChunk> = new Map<Symbol, LocalChunk>();
    private chunkTokens: Map<Symbol, string> = new Map<Symbol, string>();
    private chunkSize?: Vector2;
    private tileSize: number = 32;
    private inflightRequests: Map<Symbol, Promise<TileContent[]>> = new Map<Symbol, Promise<TileContent[]>>();

    constructor(private game: Game) {
    }

    public async getChunksInViewport(position: Vector2, viewport: Vector2): Promise<LocalChunk[]> {
        const chunkSize = await this.getChunkSize();
        console.log('calculating based on position', position);

        const visibleChunkCount = viewport.elementDivide(chunkSize.scalarMultiplicate(this.tileSize)).floor().add(new Vector2(3, 3));

        const startingChunk = position.elementDivide(chunkSize.scalarMultiplicate(this.tileSize)).floor().subtract(new Vector2(1, 1));
        const visibleChunkPositions: Vector2[] = [];

        visibleChunkCount.iterate2d((_, __, vec) => {
            visibleChunkPositions.push(startingChunk.add(vec));
        });

        const visibleChunks: LocalChunk[] = await Promise.all(visibleChunkPositions.map(chunk => this.getChunk(chunk)));
        console.log('currently visible chunks', visibleChunks);

        console.log('listener stats', this.chunkTokens.size);

        if (this.chunks.size > 24) {
            const visibleChunkKeys = visibleChunkPositions.map(pos => pos.asMapKey());
            for (let [key] of this.chunks.entries()) {
                if (!visibleChunkKeys.includes(key)) {
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
            chunkContentPromise = this.game.getTileContents(chunkPos);
            this.inflightRequests.set(chunkPos.asMapKey(), chunkContentPromise);
            shouldRegisterListener = true;
        }

        let chunkContents: TileContent[];
        if(shouldRegisterListener) {
            const tokenPromise = this.game.on('update', chunkPos, update => this.chunkUpdateListener(update));

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

    private async unloadChunk(chunkKey: Symbol): Promise<void> {
        if (this.chunks.has(chunkKey)) {
            this.chunks.delete(chunkKey);
        }

        if (this.chunkTokens.has(chunkKey)) {
            const token = this.chunkTokens.get(chunkKey)!;
            await this.game.removeListener(token);
            this.chunkTokens.delete(chunkKey);
        }
    }

    private async getChunkSize(): Promise<Vector2> {
        if (this.chunkSize) {
            return this.chunkSize;
        }
        this.chunkSize = await this.game.getChunkSize();
        return this.chunkSize;
    }

    private async chunkUpdateListener(chunkUpdate: ChunkUpdate): Promise<void> {
        console.log('Chunk update', chunkUpdate);
        const key = chunkUpdate.chunk.asMapKey();
        if (this.chunks.has(key)) {
            const localChunk = this.chunks.get(key)!;
            localChunk.updateContents(chunkUpdate.field);
        }
    }
}

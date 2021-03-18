import {Context, indexToPos, neighborPositionsChunked, Vector2, Vector2Key} from "../support";
import {Chunk} from "./Chunk";
import {Tile, TileContent} from "./Tile";
import {ChunkedPosition} from "./ChunkedPosition";
import {ChunkUpdate} from "./ChunkUpdate";
import {ChunkListener} from "./ChunkListenerService";
import {filterAsync} from "../support/arrayAsyncHelper";
import {ChunkPersistence, PersistedChunk} from "../persistence";
import {Tracer} from "opentracing";
import {traced} from "../support/tracingHelper";


export class World {
    private loadedChunks: Map<Vector2Key, Chunk> = new Map<Vector2Key, Chunk>();
    private inflightChunkRequests: Map<Vector2Key, Promise<PersistedChunk | null>> = new Map<Vector2Key, Promise<PersistedChunk | null>>();
    private dirtyChunks: Map<Vector2Key, Vector2> = new Map<Vector2Key, Vector2>();

    constructor(
        private chunkSize: Vector2,
        private updateListener: ChunkListener,
        private difficulty: number,
        private chunkPersistence: ChunkPersistence,
        private tracer: Tracer
    ) {
        setInterval(() => this.saveWorldJob(), 5000);
    }

    @traced()
    public async getChunkTiles(context: Context, chunkPos: Vector2): Promise<TileContent[]> {
        const span = context.getSpan();
        const chunkOrNull = await this.getChunkOrNull(context, chunkPos);
        span && span.logEvent('chunk-fetched', {chunk: chunkPos.asMapKey()});
        if(chunkOrNull === null) {
            const content: TileContent[] = new Array<TileContent>(this.chunkSize.area())
            return content.fill('closed');
        }
        const tiles = chunkOrNull.getActualTiles();
        span && span.logEvent('chunk-tiles', {});

        return await Promise.all(tiles.map((tile, index) => {
            const chunkedPosition = new ChunkedPosition(chunkPos, indexToPos(index, this.chunkSize), this.chunkSize)
            return this.getSingleTileContent(context, tile, chunkedPosition);
        }));
    }

    @traced()
    public async openTile(context: Context, chunkedPosition: ChunkedPosition): Promise<TileContent> {
        void(context);
        const tile = await this.getSingleChunkTile(context, chunkedPosition);
        if (tile.isOpen()) {
            await this.tryAutoOpenNeighbor(context, chunkedPosition);
        } else {
            tile.open();
        }
        const content = await this.getSingleTileContent(context, tile, chunkedPosition);
        if (content === 0) {
            await this.autoOpenZero(context, chunkedPosition);
        }
        await this.markDirty(context, chunkedPosition.getChunk());
        return content;
    }

    @traced()
    public async flag(context: Context, chunkedPosition: ChunkedPosition): Promise<boolean> {
        const tile = await this.getSingleChunkTile(context, chunkedPosition);
        if (tile.isOpen()) {
            await this.tryAutoFlagNeighbor(context, chunkedPosition);
            return tile.isFlagged();
        } else if (tile.isMine()) {
            tile.flag();
        } else {
            tile.open();
            const content = await this.getSingleTileContent(context, tile, chunkedPosition);
            if(content === 0) {
                await this.autoOpenZero(context, chunkedPosition);
            }
        }
        await this.markDirty(context, chunkedPosition.getChunk());
        return tile.isFlagged();
    }

    @traced()
    private async autoOpenZero(context: Context, chunkedPosition: ChunkedPosition): Promise<void> {
        const span = context.getSpan();
        const positions = [
            ...neighborPositionsChunked(chunkedPosition)
                .filter(async (pos) => !(await this.getSingleChunkTile(context, pos)).isOpen())
        ];
        const plannedChunkUpdates: Map<Vector2Key, Vector2> = new Map<Vector2Key, Vector2>();
        while (positions.length !== 0) {
            const position = positions.pop();
            if (position === undefined) {
                continue;
            }
            const tile = await this.getSingleChunkTile(context, position);
            tile.open()
            const result = await this.getSingleTileContent(context, tile, position);
            if (result === 0) {
                positions.push(
                    ...await filterAsync(neighborPositionsChunked(position), async (pos) => !(await this.getSingleChunkTile(context, pos)).isOpen())
                );
            }
            plannedChunkUpdates.set(position.getChunk().asMapKey(), position.getChunk());
            span && span.logEvent('opened-tile', {
                chunk: position.getChunk().asMapKey(),
                position: position.getPosition().asMapKey()
            });
        }
        for (let [_, chunk] of plannedChunkUpdates.entries()) {
            await this.markDirty(context, chunk);
        }
    }

    @traced()
    private async tryAutoOpenNeighbor(context: Context, position: ChunkedPosition): Promise<void> {
        const span = context.getSpan();
        const tile = await this.getSingleChunkTile(context, position);
        const content = await this.getSingleTileContent(context, tile, position);
        const neighborPositions = neighborPositionsChunked(position);
        const flagCount = (await Promise.all(neighborPositions
            .map(pos => this.getSingleChunkTile(context, pos))))
            .reduce((count, t) => count + (t.isFlagged() || (t.isOpen() && t.isMine()) ? 1 : 0), 0);

        if (content === flagCount) {
            span && span.logEvent('open-neighbors', {});
            const affectedChunks: Map<Vector2Key, Vector2> = new Map<Vector2Key, Vector2>();
            for (let pos of neighborPositions) {
                const neighborTile = await this.getSingleChunkTile(context, pos);
                if (neighborTile.isOpen() || neighborTile.isFlagged()) {
                    continue;
                }
                neighborTile.open();
                const neighborContent = await this.getSingleTileContent(context, neighborTile, pos);
                if (neighborContent === 0) {
                    span && span.logEvent('open-zero-neighbor', {});
                    await this.autoOpenZero(context, pos);
                }
                affectedChunks.set(pos.getChunk().asMapKey(), pos.getChunk());
            }
            for (let [_, chunk] of affectedChunks.entries()) {
                await this.markDirty(context, chunk);
            }
        }
    }

    @traced()
    private async tryAutoFlagNeighbor(context: Context, position: ChunkedPosition): Promise<void> {
        const span = context.getSpan();
        const tile = await this.getSingleChunkTile(context, position);
        const content = await this.getSingleTileContent(context, tile, position);
        const neighborPositions = neighborPositionsChunked(position);
        const neighborTiles = await Promise.all(neighborPositions
            .map(pos => this.getSingleChunkTile(context, pos)));
        span && span.logEvent('neighborhood-tiles', {
            positions: neighborPositions.map(pos => ({
                chunk: pos.getChunk().asMapKey(),
                position: pos.getPosition().asMapKey()
            }))
        });
        const unopenedOrMineOrFlaggedCount = neighborTiles
            .reduce((count, t) => count + ((!t.isOpen() || t.isMine() || t.isFlagged()) ? 1 : 0), 0);

        if (content === unopenedOrMineOrFlaggedCount) {
            const affectedChunks: Map<Vector2Key, Vector2> = new Map<Vector2Key, Vector2>();
            for (let i = 0; i < neighborPositions.length; i++) {
                const neighborTile = neighborTiles[i];
                if (neighborTile.isOpen() || neighborTile.isFlagged()) {
                    continue;
                }

                neighborTile.flag();
                const chunk = neighborPositions[i].getChunk()
                affectedChunks.set(chunk.asMapKey(), chunk);
            }
            span && span.logEvent('affected-chunk-count', affectedChunks.size);
            for (let [_, chunk] of affectedChunks.entries()) {
                span && span.logEvent('chunk-mark-dirty', {chunk: chunk.asMapKey()});
                await this.markDirty(context, chunk);
            }
        }
    }

    private generateChunk(chunkPos: Vector2): Chunk {
        console.log('[World] Generating chunk', chunkPos);
        if (this.loadedChunks.has(chunkPos.asMapKey())) {
            throw new Error("Tried to generate chunk that already exists");
        }
        const chunk = Chunk.generate(chunkPos, this.chunkSize, this.difficulty);
        this.loadedChunks.set(chunkPos.asMapKey(), chunk);
        return chunk;
    }

    private async getChunk(context: Context, chunkPos: Vector2): Promise<Chunk> {
        return (await this.getChunkOrNull(context, chunkPos, true))!;
    }

    private async getChunkOrNull(_: Context, chunkPos: Vector2, shouldGenerate: boolean = false): Promise<Chunk | null> {
        const chunkKey = chunkPos.asMapKey();
        if (this.loadedChunks.has(chunkPos.asMapKey())) {
            return this.loadedChunks.get(chunkPos.asMapKey()) as Chunk;
        }

        let persistedChunkPromise: Promise<PersistedChunk | null>;
        if (this.inflightChunkRequests.has(chunkKey)) {
            console.log('getting chunk that has an inflight request');
            persistedChunkPromise = this.inflightChunkRequests.get(chunkKey)!;
        } else {
            persistedChunkPromise = this.chunkPersistence.loadChunk(chunkPos);
            this.inflightChunkRequests.set(chunkKey, persistedChunkPromise);
        }

        const persistedChunk = await persistedChunkPromise;

        this.inflightChunkRequests.delete(chunkKey);
        if (this.loadedChunks.has(chunkKey)) {
            return this.loadedChunks.get(chunkKey)!;
        }

        if (persistedChunk === null) {
            if(shouldGenerate) {
                const generated = this.generateChunk(chunkPos);
                this.loadedChunks.set(chunkKey, generated);
                return generated;
            }
            return null;
        }
        const chunk = Chunk.load(chunkPos, this.chunkSize, persistedChunk);
        this.loadedChunks.set(chunkKey, chunk);

        return chunk;
    }

    private async getNeighbors(context: Context, chunkedPosition: ChunkedPosition): Promise<Tile[]> {
        const neighborPositions = neighborPositionsChunked(chunkedPosition);
        return await Promise.all(neighborPositions
            .map(pos => this.getSingleChunkTile(context, pos)));
    }

    private async getSingleChunkTile(context: Context, pos: ChunkedPosition) {
        return (await this.getChunk(context, pos.getChunk())).getTile(pos.getPosition());
    }

    private async getSingleTileContent(context: Context, tile: Tile, chunkedPosition: ChunkedPosition): Promise<TileContent> {
        if(tile.hasCachedContent() !== undefined) {
            return tile.hasCachedContent()!;
        }

        if (tile.isFlagged()) {
            return 'flag';
        }

        if (!tile.isOpen()) {
            return 'closed';
        }

        if (tile.isMine()) {
            return 'mine';
        }
        return tile.calculateNumber(await this.getNeighbors(context, chunkedPosition));
    }

    @traced()
    private async markDirty(context: Context, chunkPos: Vector2): Promise<void> {
        this.dirtyChunks.set(chunkPos.asMapKey(), chunkPos);
        this.updateListener(new ChunkUpdate(chunkPos, await this.getChunkTiles(context, chunkPos), this.chunkSize));
    }

    private async saveWorldJob(): Promise<void> {
        if(this.dirtyChunks.size === 0) {
            return;
        }
        console.log('[World] Saving world');
        await Promise.all([...this.dirtyChunks.values()]
            .filter(pos => this.loadedChunks.has(pos.asMapKey()))
            .map(pos => this.loadedChunks.get(pos.asMapKey())!)
            .map(chunk => this.chunkPersistence.persistChunk(chunk.toPersistent())));

        console.log('[World] World save successful, saved ', this.dirtyChunks.size, 'dirty chunks');
        this.dirtyChunks.clear();
    }

    public getTracer(): Tracer {
        return this.tracer;
    }
}
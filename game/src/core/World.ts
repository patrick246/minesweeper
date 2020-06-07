import {indexToPos, neighborPositionsChunked, Vector2, Vector2Key} from "../support";
import {Chunk} from "./Chunk";
import {Tile, TileContent} from "./Tile";
import {ChunkedPosition} from "./ChunkedPosition";
import {ChunkUpdate} from "./ChunkUpdate";
import {ChunkListener} from "./ChunkListenerService";
import {filterAsync} from "../support/arrayAsyncHelper";
import {ChunkPersistence, PersistedChunk} from "../persistence";


export class World {
    private loadedChunks: Map<Vector2Key, Chunk> = new Map<Vector2Key, Chunk>();
    private inflightChunkRequests: Map<Vector2Key, Promise<PersistedChunk | null>> = new Map<Vector2Key, Promise<PersistedChunk | null>>();
    private dirtyChunks: Map<Vector2Key, Vector2> = new Map<Vector2Key, Vector2>();

    constructor(
        private chunkSize: Vector2,
        private updateListener: ChunkListener,
        private difficulty: number,
        private chunkPersistence: ChunkPersistence
    ) {
        setInterval(() => this.saveWorldJob(), 5000);
    }

    public async getChunkTiles(chunkPos: Vector2): Promise<TileContent[]> {
        const chunkOrNull = await this.getChunkOrNull(chunkPos);
        if(chunkOrNull === null) {
            const content: TileContent[] = new Array<TileContent>(this.chunkSize.area())
            return content.fill('closed');
        }
        const tiles = chunkOrNull.getActualTiles();

        return Promise.all(tiles.map((tile, index) => {
            const chunkedPosition = new ChunkedPosition(chunkPos, indexToPos(index, this.chunkSize), this.chunkSize)
            return this.getSingleTileContent(tile, chunkedPosition);
        }));
    }

    public async openTile(chunkedPosition: ChunkedPosition): Promise<TileContent> {
        const tile = await this.getSingleChunkTile(chunkedPosition);
        if (tile.isOpen()) {
            await this.tryAutoOpenNeighbor(chunkedPosition);
        } else {
            tile.open();
        }
        const content = await this.getSingleTileContent(tile, chunkedPosition);
        if (content === 0) {
            await this.autoOpenZero(chunkedPosition);
        }
        await this.markDirty(chunkedPosition.getChunk());
        return content;
    }

    public async flag(chunkedPosition: ChunkedPosition): Promise<boolean> {
        const tile = await this.getSingleChunkTile(chunkedPosition);
        if (tile.isOpen()) {
            await this.tryAutoFlagNeighbor(chunkedPosition);
            return tile.isFlagged();
        } else if (tile.isMine()) {
            tile.flag();
        } else {
            tile.open();
        }
        await this.markDirty(chunkedPosition.getChunk());
        return tile.isFlagged();
    }

    private async autoOpenZero(chunkedPosition: ChunkedPosition): Promise<void> {
        const positions = [
            ...neighborPositionsChunked(chunkedPosition)
                .filter(async (pos) => !(await this.getSingleChunkTile(pos)).isOpen())
        ];
        const plannedChunkUpdates: Map<Vector2Key, Vector2> = new Map<Vector2Key, Vector2>();
        while (positions.length !== 0) {
            const position = positions.pop();
            if (position === undefined) {
                continue;
            }
            const tile = await this.getSingleChunkTile(position);
            tile.open()
            const result = await this.getSingleTileContent(tile, position);
            if (result === 0) {
                positions.push(
                    ...await filterAsync(neighborPositionsChunked(position), async (pos) => !(await this.getSingleChunkTile(pos)).isOpen())
                );
            }
            plannedChunkUpdates.set(position.getChunk().asMapKey(), position.getChunk());
        }
        for (let [_, chunk] of plannedChunkUpdates.entries()) {
            await this.markDirty(chunk);
        }
    }

    private async tryAutoOpenNeighbor(position: ChunkedPosition): Promise<void> {
        const tile = await this.getSingleChunkTile(position);
        const content = await this.getSingleTileContent(tile, position);
        const neighborPositions = neighborPositionsChunked(position);
        const flagCount = (await Promise.all(neighborPositions
            .map(pos => this.getSingleChunkTile(pos))))
            .reduce((count, t) => count + (t.isFlagged() || (t.isOpen() && t.isMine()) ? 1 : 0), 0);

        if (content === flagCount) {
            const affectedChunks: Map<Vector2Key, Vector2> = new Map<Vector2Key, Vector2>();
            for (let pos of neighborPositions) {
                const neighborTile = await this.getSingleChunkTile(pos);
                if (neighborTile.isOpen() || neighborTile.isFlagged()) {
                    continue;
                }
                neighborTile.open();
                const neighborContent = await this.getSingleTileContent(tile, pos);
                if (neighborContent === 0) {
                    await this.autoOpenZero(pos);
                }
                affectedChunks.set(pos.getChunk().asMapKey(), pos.getChunk());
            }
            for (let [_, chunk] of affectedChunks.entries()) {
                await this.markDirty(chunk);
            }
        }
    }

    private async tryAutoFlagNeighbor(position: ChunkedPosition): Promise<void> {
        const tile = await this.getSingleChunkTile(position);
        const content = await this.getSingleTileContent(tile, position);
        const neighborPositions = neighborPositionsChunked(position);
        const neighborTiles = await Promise.all(neighborPositions
            .map(pos => this.getSingleChunkTile(pos)));
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
            for (let [_, chunk] of affectedChunks.entries()) {
                await this.markDirty(chunk);
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

    private async getChunk(chunkPos: Vector2): Promise<Chunk> {
        const chunkOrNull = await this.getChunkOrNull(chunkPos);
        if(chunkOrNull === null) {
            return this.generateChunk(chunkPos);
        }
        return chunkOrNull;
    }

    private async getChunkOrNull(chunkPos: Vector2): Promise<Chunk | null> {
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
            return null;
        }
        const chunk = Chunk.load(chunkPos, this.chunkSize, persistedChunk);
        this.loadedChunks.set(chunkKey, chunk);
        return chunk;
    }

    private async getNeighbors(chunkedPosition: ChunkedPosition): Promise<Tile[]> {
        const neighborPositions = neighborPositionsChunked(chunkedPosition);
        return await Promise.all(neighborPositions
            .map(pos => this.getSingleChunkTile(pos)));
    }

    private async getSingleChunkTile(pos: ChunkedPosition) {
        return (await this.getChunk(pos.getChunk())).getTile(pos.getPosition());
    }

    private async getSingleTileContent(tile: Tile, chunkedPosition: ChunkedPosition): Promise<TileContent> {
        if (tile.isFlagged()) {
            return 'flag';
        }

        if (!tile.isOpen()) {
            return 'closed';
        }

        if (tile.isMine()) {
            return 'mine';
        }

        const num = (await this.getNeighbors(chunkedPosition))
            .reduce((count, t) => count + (t.isMine() ? 1 : 0), 0);
        return num as TileContent;
    }

    private async markDirty(chunkPos: Vector2): Promise<void> {
        this.dirtyChunks.set(chunkPos.asMapKey(), chunkPos);
        this.updateListener(new ChunkUpdate(chunkPos, await this.getChunkTiles(chunkPos), this.chunkSize));
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
}
import {Vector2} from "../support";
import {Chunk} from "./Chunk";
import {Tile, TileContent} from "./Tile";
import {ChunkedPosition} from "./ChunkedPosition";
import {indexToPos, neighborPositionsChunked} from "../support";
import {ChunkUpdate} from "./ChunkUpdate";
import {ChunkListener} from "./ChunkListenerService";


export class World {
    private loadedChunks: Map<Symbol, Chunk> = new Map<Symbol, Chunk>();
    private readonly updateListener: (chunkUpdate: ChunkUpdate) => void;

    constructor(private chunkSize: Vector2, listener: ChunkListener) {
        this.updateListener = listener;
        if(this.loadedChunks.size === 0) {
            this.generateChunk(new Vector2(0, 0));
        }
    }

    public getChunkTiles(chunkPos: Vector2): TileContent[] {
        if(!this.loadedChunks.has(chunkPos.asMapKey())) {
            const content: TileContent[] = new Array<TileContent>(this.chunkSize.area())
            return content.fill('closed');
        }

        const chunk = this.loadedChunks.get(chunkPos.asMapKey());
        if(chunk === undefined) {
            throw new Error("Chunk is undefined, but present in map: " + chunkPos);
        }

        const tiles = chunk.getActualTiles();

        return tiles.map((tile, index) => {
            const chunkedPosition = new ChunkedPosition(chunkPos, indexToPos(index, this.chunkSize), this.chunkSize)
            return this.getSingleTileContent(tile, chunkedPosition);
        });
    }

    public openTile(chunkedPosition: ChunkedPosition): TileContent {
        const tile = this.getChunk(chunkedPosition.getChunk()).getTile(chunkedPosition.getPosition());
        if(tile.isOpen()) {
            this.tryAutoOpenNeighbor(chunkedPosition);
        } else {
            tile.open();
            this.updateListener(new ChunkUpdate(chunkedPosition.getChunk(), this.getChunkTiles(chunkedPosition.getChunk()), this.chunkSize));
        }
        const content = this.getSingleTileContent(tile, chunkedPosition);
        if(content === 0) {
            this.autoOpenZero(chunkedPosition);
        }
        return content;
    }

    public flag(chunkedPosition: ChunkedPosition): boolean {
        const tile = this.getChunk(chunkedPosition.getChunk()).getTile(chunkedPosition.getPosition());
        if(tile.isOpen()) {
            this.tryAutoFlagNeighbor(chunkedPosition);
            return tile.isFlagged();
        } else if(tile.isMine()) {
            tile.flag();
        } else {
            tile.open();
        }
        this.updateListener(new ChunkUpdate(chunkedPosition.getChunk(), this.getChunkTiles(chunkedPosition.getChunk()), this.chunkSize));
        return tile.isFlagged();
    }

    private autoOpenZero(chunkedPosition: ChunkedPosition) {
        const positions = [
            ...neighborPositionsChunked(chunkedPosition)
                .filter(pos => !this.getChunk(pos.getChunk()).getTile(pos.getPosition()).isOpen())
        ];
        const plannedChunkUpdates: Map<Symbol, Vector2> = new Map<Symbol, Vector2>();
        while (positions.length !== 0) {
            const position = positions.pop();
            if (position === undefined) {
                continue;
            }
            const tile = this.getChunk(position.getChunk()).getTile(position.getPosition());
            tile.open()
            const result = this.getSingleTileContent(tile, position);
            if (result === 0) {
                positions.push(
                    ...neighborPositionsChunked(position)
                        .filter(pos => !this.getChunk(pos.getChunk()).getTile(pos.getPosition()).isOpen())
                );
            }
            plannedChunkUpdates.set(position.getChunk().asMapKey(), position.getChunk());
        }
        for(let [_, chunk] of plannedChunkUpdates.entries()) {
            this.updateListener(new ChunkUpdate(chunk, this.getChunkTiles(chunk), this.chunkSize));
        }
    }

    private tryAutoOpenNeighbor(position: ChunkedPosition) {
        const tile = this.getChunk(position.getChunk()).getTile(position.getPosition());
        const content = this.getSingleTileContent(tile, position);
        const neighborPositions = neighborPositionsChunked(position);
        const flagCount = neighborPositions
            .map(pos => this.getChunk(pos.getChunk()).getTile(pos.getPosition()))
            .reduce((count, t) => count + (t.isFlagged() || (t.isOpen() && t.isMine()) ? 1 : 0), 0);

        if(content === flagCount) {
            const affectedChunks: Map<Symbol, Vector2> = new Map<Symbol, Vector2>();
            for(let pos of neighborPositions) {
                const neighborTile = this.getChunk(pos.getChunk()).getTile(pos.getPosition());
                if(neighborTile.isOpen()) {
                    continue;
                }
                neighborTile.open();
                const neighborContent = this.getSingleTileContent(tile, pos);
                if(neighborContent === 0) {
                    this.autoOpenZero(pos);
                }
                affectedChunks.set(pos.getChunk().asMapKey(), pos.getChunk());
            }
            for(let [_, chunk] of affectedChunks.entries()) {
                this.updateListener(new ChunkUpdate(chunk, this.getChunkTiles(chunk), this.chunkSize));
            }
        }
    }

    private tryAutoFlagNeighbor(position: ChunkedPosition): void {
        const tile = this.getChunk(position.getChunk()).getTile(position.getPosition());
        const content = this.getSingleTileContent(tile, position);
        const neighborPositions = neighborPositionsChunked(position);
        const neighborTiles = neighborPositions
            .map(pos => this.getChunk(pos.getChunk()).getTile(pos.getPosition()));
        const unopenedOrMineOrFlaggedCount = neighborTiles
            .reduce((count, t) => count + ((!t.isOpen() || t.isMine() || t.isFlagged()) ? 1 : 0), 0);

        if(content === unopenedOrMineOrFlaggedCount) {
            const affectedChunks: Map<Symbol, Vector2> = new Map<Symbol, Vector2>();
            for(let i = 0; i < neighborPositions.length; i++) {
                const neighborTile = neighborTiles[i];
                if(neighborTile.isOpen() || neighborTile.isFlagged()) {
                   continue;
                }
                neighborTile.flag();
                const chunk = neighborPositions[i].getChunk()
                affectedChunks.set(chunk.asMapKey(), chunk);
            }
            for(let [_, chunk] of affectedChunks.entries()) {
                this.updateListener(new ChunkUpdate(chunk, this.getChunkTiles(chunk), this.chunkSize));
            }
        }
    }

    private generateChunk(chunkPos: Vector2): Chunk {
        console.log('[World] Generating chunk', chunkPos);
        if(this.loadedChunks.has(chunkPos.asMapKey())) {
            throw new Error("Tried to generate chunk that already exists");
        }
        const chunk = Chunk.generate(this.chunkSize, 0.12);
        this.loadedChunks.set(chunkPos.asMapKey(), chunk);
        return chunk;
    }

    private getChunk(chunkPos: Vector2): Chunk {
        if(this.loadedChunks.has(chunkPos.asMapKey())) {
            return this.loadedChunks.get(chunkPos.asMapKey()) as Chunk;
        }

        // ToDo: Implement chunk loading here, if chunk exists but isn't loaded

        return this.generateChunk(chunkPos);
    }

    private getNeighbors(chunkedPosition: ChunkedPosition): Tile[] {
        const neighborPositions = neighborPositionsChunked(chunkedPosition);
        const n = neighborPositions
            .map(pos => this.getChunk(pos.getChunk()).getTile(pos.getPosition()));
        return n;
    }

    private getSingleTileContent(tile: Tile, chunkedPosition: ChunkedPosition): TileContent {
        if (tile.isFlagged()) {
            return 'flag';
        }

        if (!tile.isOpen()) {
            return 'closed';
        }

        if (tile.isMine()) {
            return 'mine';
        }

        const num = this.getNeighbors(chunkedPosition)
            .reduce((count, t) => count + (t.isMine() ? 1 : 0), 0);
        return num as TileContent;
    }
}
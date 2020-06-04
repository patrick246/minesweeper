import {indexToPos, neighbors, posToIndex, Vector2} from "../support";
import {Tile, TileContent} from "./Tile";
import {PersistedChunk, PersistedTile} from "../persistence";

export class Chunk {
    constructor(private size: Vector2, private contents: Tile[], private position: Vector2) {
    }

    static generate(position: Vector2, size: Vector2, probability: number): Chunk {
        let contents: Tile[] = [];

        size.iterate1d(((i) => {
            contents[i] = new Tile(indexToPos(i, size), Math.random() < probability, false);
        }))

        return new Chunk(size, contents, position);
    }

    static load(position: Vector2, size: Vector2, persistedChunk: PersistedChunk): Chunk {
        const contents: Tile[] = [];

        size.iterate2d((_, __, pos) => {
           const i = posToIndex(pos, size);
           const persistedTile = persistedChunk.tiles[i];
           contents[i] = new Tile(pos, persistedTile.mine, persistedTile.opened, persistedTile.flaggedBy !== undefined);
        });

        return new Chunk(size, contents, position);
    }

    public getSize(): Vector2 {
        return this.size;
    }

    public getPosition(): Vector2 {
        return this.position;
    }

    public getTiles(): TileContent[] {
        return this.contents.map(
            (tile, index) => tile.calculateNumber(
                neighbors(this.contents, indexToPos(index, this.size), this.size)
            )
        );
    }

    public getActualTiles(): Tile[] {
        return this.contents;
    }

    public getTile(position: Vector2): Tile {
        return this.contents[posToIndex(position, this.size)];
    }

    public open(position: Vector2): TileContent {
        const tile = this.contents[posToIndex(position, this.size)];
        tile.open();
        const neighborTiles = neighbors(this.contents, position, this.size);
        return tile.calculateNumber(neighborTiles);
    }

    public isOpen(position: Vector2): boolean {
        return this.contents[posToIndex(position, this.size)].isOpen();
    }

    public flag(position: Vector2): void {
        this.contents[posToIndex(position, this.size)].flag();
    }

    public toPersistent(): PersistedChunk {
        return new PersistedChunk(this.position, this.contents.map(tile => {
            if(tile.isFlagged()) {
                return PersistedTile.flagged('anonymous', 'default');
            }
            if(tile.isOpen()) {
                return PersistedTile.opened(tile.isMine());
            }
            return PersistedTile.closed(tile.isMine());
        }))
    }
}
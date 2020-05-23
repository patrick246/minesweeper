import {Vector2} from "../support/Vector2";
import {Tile, TileContent} from "./Tile";
import {indexToPos, neighbors, posToIndex} from "../support/2dFieldOperations";

export class Chunk {
    constructor(private size: Vector2, private contents: Tile[]) {
    }

    static generate(size: Vector2, probability: number): Chunk {
        let contents: Tile[] = [];

        size.iterate1d(((i) => {
            contents[i] = new Tile(indexToPos(i, size), Math.random() < probability, false);
        }))

        return new Chunk(size, contents);
    }

    public getSize(): Vector2 {
        return this.size;
    }

    public getTiles(): TileContent[] {
        return this.contents.map(
            (tile, index) => tile.calculateNumber(
                neighbors(this.contents, indexToPos(index, this.size), this.size)
            )
        );
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
}
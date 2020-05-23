import {Chunk} from "./Chunk";
import {Vector2} from "../support/Vector2";
import {TileContent} from "./Tile";
import {neighborPositions} from "../support/2dFieldOperations";
import {ChunkUpdate} from "./ChunkUpdate";

export class Game {
    private readonly chunk: Chunk;
    private readonly updateListeners: ((update: ChunkUpdate) => void)[] = [];

    constructor() {
        this.chunk = Chunk.generate(new Vector2(10, 10), 0.1);
    }

    public on(_: 'update', callback: (update: ChunkUpdate) => void): void {
        this.updateListeners.push(callback);
    }


    public getField(): Chunk {
        return this.chunk;
    }

    public getTileContents(): TileContent[] {
        return this.chunk.getTiles();
    }

    public getSize(): Vector2 {
        return this.chunk.getSize();
    }

    public isGameOver(): boolean {
        return false;
    }

    public openTile(position: Vector2): TileContent {
        const content = this.chunk.open(position);
        if(content === 0) {
            this.autoOpenZero(position);
        }
        this.updateListeners.forEach(cb => {
            cb(new ChunkUpdate(this.chunk.getTiles(), this.chunk.getSize()));
        });
        return content;
    }

    public flag(position: Vector2): void {
        this.chunk.flag(position);
        this.updateListeners.forEach(cb => {
            cb(new ChunkUpdate(this.chunk.getTiles(), this.chunk.getSize()));
        })
    }

    private autoOpenZero(initialPos: Vector2) {
        const positions = [
            ...neighborPositions(initialPos, this.chunk.getSize())
            .filter(pos => !this.chunk.isOpen(pos))
        ];
        while(positions.length !== 0) {
            const position = positions.pop();
            if(position === undefined) {
                continue;
            }
            const result = this.chunk.open(position);
            if(result === 0) {
                positions.push(
                    ...neighborPositions(position, this.chunk.getSize())
                    .filter(pos => !this.chunk.isOpen(pos))
                );
            }
        }
    }
}
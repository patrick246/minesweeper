import {Vector2} from "../support";

export type TileContent = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'closed' | 'mine' | 'flag';

export class Tile {
    private contentCache?: number;
    constructor(
        private readonly position: Vector2,
        private readonly mine: boolean,
        private opened: boolean,
        private flagged: boolean = false
    ) {
    }

    public isMine(): boolean {
        return this.mine;
    }

    public isOpen(): boolean {
        return this.opened;
    }

    public isFlagged(): boolean {
        return this.flagged;
    }

    public calculateNumber(neighbors: Tile[]): TileContent {
        if(this.contentCache) {
            return this.contentCache as TileContent;
        }

        if(this.flagged) {
            return 'flag';
        }

        if(!this.isOpen()) {
            return 'closed';
        }

        if(this.isMine()) {
            return 'mine';
        }
        const num = neighbors.reduce((acc, cur) => acc + (cur.isMine() ? 1 : 0), 0);
        if(num < 0 || num > 8) {
            throw new TypeError("A tile can't have more than eight neighbors");
        }
        this.contentCache = num;
        return num as TileContent;
    }

    public open(): void {
        if(this.flagged) {
            return;
        }
        this.opened = true;
    }

    public flag(): void {
        if(this.opened) {
            return;
        }
        this.flagged = true;
    }

    public getPosition(): Vector2 {
        return this.position;
    }

    public hasCachedContent(): 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | undefined {
        return this.contentCache as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | undefined;
    }
}
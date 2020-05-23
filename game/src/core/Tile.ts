import {Vector2} from "../support/Vector2";

export type TileContent = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'closed' | 'mine' | 'flag';

export class Tile {
    private flagged: boolean = false;

    constructor(
        private readonly position: Vector2,
        private readonly mine: boolean,
        private opened: boolean
    ) {
    }

    public isMine(): boolean {
        return this.mine;
    }

    public isOpen(): boolean {
        return this.opened;
    }

    public calculateNumber(neighbors: Tile[]): TileContent {
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
        return num as TileContent;
    }

    public open() {
        this.opened = true;
    }

    public flag() {
        this.flagged = true;
    }

    public getPosition(): Vector2 {
        return this.position;
    }
}
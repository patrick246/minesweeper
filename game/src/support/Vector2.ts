export class Vector2 {
    public readonly x: number;
    public readonly y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    static copy(vec2: Vector2): Vector2 {
        return new Vector2(vec2.x, vec2.y);
    }

    static fromArray(numbers: [number, number]) {
        if(numbers.length !== 2) {
            throw new Error("")
        }
        return new Vector2(numbers[0], numbers[1]);
    }

    public iterate2d(callback: (x: number, y: number, vec: Vector2) => void) {
        for(let yi = 0; yi < this.y; yi++) {
            for(let xi = 0; xi < this.x; xi++) {
                callback(xi, yi, new Vector2(xi, yi));
            }
        }
    }

    public iterate1d(callback: (i: number) => void) {
        for(let yi = 0; yi < this.y; yi++) {
            for(let xi = 0; xi < this.x; xi++) {
                callback(yi * this.x + xi);
            }
        }
    }

    public add(vec2: Vector2) {
        return new Vector2(this.x + vec2.x, this.y + vec2.y);
    }
}
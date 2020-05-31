import {Vector2} from "../support/";

export class ChunkedPosition {
    public constructor(
        private readonly chunk: Vector2,
        private readonly position: Vector2,
        private readonly chunkSize: Vector2
    ) {
    }

    public static copy(pos: ChunkedPosition): ChunkedPosition {
        return new ChunkedPosition(Vector2.copy(pos.chunk), Vector2.copy(pos.position), Vector2.copy(pos.chunkSize));
    }

    public getChunk(): Vector2 {
        return this.chunk;
    }

    public getPosition(): Vector2 {
        return this.position;
    }

    public add(vec: Vector2): ChunkedPosition {
        const resultPos = this.position.add(vec);
        let resultPosX = resultPos.x;
        let resultPosY = resultPos.y;

        let resultChunkX = this.chunk.x;
        let resultChunkY = this.chunk.y;

        if (resultPosX < 0 || resultPosX >= this.chunkSize.x) {
            resultChunkX += Math.floor(resultPosX / this.chunkSize.x);
            resultPosX = this.realMod(resultPosX, this.chunkSize.x);
        }

        if (resultPosY < 0 || resultPosY >= this.chunkSize.y) {
            resultChunkY += Math.floor(resultPosY / this.chunkSize.y);
            resultPosY = this.realMod(resultPosY, this.chunkSize.y);
        }

        return new ChunkedPosition(new Vector2(resultChunkX, resultChunkY), new Vector2(resultPosX, resultPosY), this.chunkSize);
    }

    private realMod(n: number, m: number): number {
        return ((n % m) + m) % m;
    }
}
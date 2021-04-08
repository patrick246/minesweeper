import {Vector2} from "game";

export class VisibleChunkCalculator {
    public getVisibleChunks(position: Vector2, viewport: Vector2, chunkSize: Vector2, tileSize: number): Vector2[] {
        const startingChunk = position.elementDivide(chunkSize.scalarMultiplicate(tileSize)).floor();
        const endChunk = position.add(viewport).elementDivide(chunkSize.scalarMultiplicate(tileSize)).floor();

        const visibleChunkPositions: Vector2[] = [];

        for (let x = startingChunk.x; x <= endChunk.x; x++) {
            for (let y = startingChunk.y; y <= endChunk.y; y++) {
                visibleChunkPositions.push(new Vector2(x, y));
            }
        }
        return visibleChunkPositions;
    }
}
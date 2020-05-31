import {Vector2} from "./Vector2";
import {ChunkedPosition} from "../core";

export function neighbors<T>(array: T[], position: Vector2, size: Vector2): T[] {
    return neighborIndices(position, size)
        .map(index => array[index]);
}

export function neighborIndices(position: Vector2, size: Vector2): number[] {
    return neighborPositions(position, size)
        .map(entry => posToIndex(entry, size));
}

export function neighborPositions(position: Vector2, size: Vector2): Vector2[] {
    return [
        new Vector2(-1, -1),    new Vector2(0, -1),     new Vector2(1, -1),
        new Vector2(-1, 0),                                   new Vector2(1, 0),
        new Vector2(-1, 1),     new Vector2(0, 1),      new Vector2(1, 1)
    ]
        .map(relative => position.add(relative))
        .filter(entry => onlyInBounds(entry, size));
}

export function neighborPositionsChunked(chunkedPosition: ChunkedPosition): ChunkedPosition[] {
    return [
        new Vector2(-1, -1),    new Vector2(0, -1),     new Vector2(1, -1),
        new Vector2(-1, 0),                                   new Vector2(1, 0),
        new Vector2(-1, 1),     new Vector2(0, 1),      new Vector2(1, 1)
    ]
        .map(relative => chunkedPosition.add(relative));
}

export function posToIndex(position: Vector2, size: Vector2): number {
    return position.x + position.y * size.x;
}

export function indexToPos(index: number, size: Vector2): Vector2 {
    return new Vector2(index % size.x, Math.floor(index / size.x));
}

function onlyInBounds(vector2: Vector2, size: Vector2): boolean {
    return vector2.x >= 0 && vector2.y >= 0 &&
            vector2.x < size.x && vector2.y < size.y;
}

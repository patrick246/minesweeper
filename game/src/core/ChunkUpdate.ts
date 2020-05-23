import {TileContent} from "./Tile";
import {Vector2} from "../support/Vector2";

export class ChunkUpdate {
    constructor(public readonly field: TileContent[], public readonly size: Vector2) {
    }
}
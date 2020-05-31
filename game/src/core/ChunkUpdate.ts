import {TileContent} from "./Tile";
import {Vector2} from "../support";

export class ChunkUpdate {

    constructor(
        public readonly chunk: Vector2,
        public readonly field: TileContent[],
        public readonly size: Vector2
    ) {
    }
}
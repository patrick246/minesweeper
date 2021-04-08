import {ChunkedPosition} from "./ChunkedPosition";

export class ClickUpdate {
    constructor(
        public readonly position: ChunkedPosition,
        public readonly username: string,
    ) {
    }
}
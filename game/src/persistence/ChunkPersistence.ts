import {Vector2} from "../index";

export class PersistedChunk {
    constructor(
        public chunkPosition: Vector2,
        public tiles: PersistedTile[],
    ) {
    }
}

export class PersistedTile {
    constructor(
        public readonly flaggedBy: string | undefined,
        public readonly flagAsset: string | undefined,
        public readonly opened: boolean,
        public readonly mine: boolean
    ) {
    }

    public static flagged(by: string, asset: string): PersistedTile {
        return new PersistedTile(by, asset, false, true);
    }

    public static closed(mine: boolean): PersistedTile {
        return new PersistedTile(undefined, undefined, false, mine);
    }

    public static opened(mine: boolean): PersistedTile {
        return new PersistedTile(undefined, undefined, true, mine);
    }
}

export interface ChunkPersistence {
    loadChunk(chunkPos: Vector2): Promise<PersistedChunk | null>;
    persistChunk(chunk: PersistedChunk): Promise<void>;
}
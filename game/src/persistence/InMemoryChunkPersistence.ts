import {ChunkPersistence, PersistedChunk} from "./ChunkPersistence";
import {Vector2, Vector2Key} from "../support";

export class InMemoryChunkPersistence implements ChunkPersistence {
    private chunks: Map<Vector2Key, PersistedChunk> = new Map<Vector2Key, PersistedChunk>();

    public async loadChunk(chunkPos: Vector2): Promise<PersistedChunk | null> {
        return this.chunks.get(chunkPos.asMapKey()) || null;
    }

    public async persistChunk(chunk: PersistedChunk): Promise<void> {
        this.chunks.set(chunk.chunkPosition.asMapKey(), chunk);
    }

}
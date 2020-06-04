import {ChunkPersistence, PersistedChunk} from "./ChunkPersistence";
import {Vector2} from "../support";

export class InMemoryChunkPersistence implements ChunkPersistence {
    private chunks: Map<Symbol, PersistedChunk> = new Map<Symbol, PersistedChunk>();

    public async loadChunk(chunkPos: Vector2): Promise<PersistedChunk | null> {
        return this.chunks.get(chunkPos.asMapKey()) || null;
    }

    public async persistChunk(chunk: PersistedChunk): Promise<void> {
        this.chunks.set(chunk.chunkPosition.asMapKey(), chunk);
    }

}
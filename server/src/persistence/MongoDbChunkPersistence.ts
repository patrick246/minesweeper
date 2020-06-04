import {ChunkPersistence, PersistedChunk, Vector2} from "game";
import {Collection} from "mongodb";

export class MongoDbChunkPersistence implements ChunkPersistence {
    constructor(private collection: Collection) {
    }

    public async loadChunk(chunkPos: Vector2): Promise<PersistedChunk | null> {
        return await this.collection.findOne<PersistedChunk>({_id: chunkPos.x + ',' + chunkPos.y});
    }

    public async persistChunk(persistedChunk: PersistedChunk): Promise<void> {
        await this.collection.replaceOne({
            _id: persistedChunk.chunkPosition.x + ',' + persistedChunk.chunkPosition.y,
        }, {
            ...persistedChunk
        }, {upsert: true});
    }
}
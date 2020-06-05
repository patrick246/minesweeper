import {ChunkPersistence, PersistedChunk, Vector2} from "game";
import {Collection} from "mongodb";
import {exponentialBuckets, Histogram} from "prom-client";

const chunkDurationHistogram = new Histogram({
    name: 'mongodb_persistence_chunk_duration_second',
    help: 'Time needed to persist a single chunk to mongodb',
    buckets: exponentialBuckets(0.001, 1.55, 20),
    labelNames: ["operation"]
});

export class MongoDbChunkPersistence implements ChunkPersistence {
    constructor(private collection: Collection) {
    }

    public async loadChunk(chunkPos: Vector2): Promise<PersistedChunk | null> {
        const timer = chunkDurationHistogram.startTimer({operation: 'read'});
        const chunk = await this.collection.findOne<PersistedChunk>({_id: chunkPos.x + ',' + chunkPos.y});
        timer();
        return chunk;
    }

    public async persistChunk(persistedChunk: PersistedChunk): Promise<void> {
        const timer = chunkDurationHistogram.startTimer({operation: 'write'});
        await this.collection.replaceOne({
            _id: persistedChunk.chunkPosition.x + ',' + persistedChunk.chunkPosition.y,
        }, {
            ...persistedChunk
        }, {upsert: true});
        timer();
    }
}
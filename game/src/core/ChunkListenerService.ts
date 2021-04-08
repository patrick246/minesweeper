import {ChunkUpdate} from "./ChunkUpdate";
import {Vector2, Vector2Key} from "../support";
import {generateListenerToken} from "../support/listenerToken";

export type ChunkListener = (chunkUpdate: ChunkUpdate) => void;


export class ChunkListenerService {
    private readonly registry: Map<Vector2Key, Map<string, ChunkListener>> = new Map<Vector2Key, Map<string, ChunkListener>>();
    private readonly tokenToChunk: Map<string, Vector2> = new Map<string, Vector2>();

    public async registerListener(chunkPos: Vector2, callback: ChunkListener): Promise<string> {
        const registrationToken = await generateListenerToken();
        this.tokenToChunk.set(registrationToken, chunkPos);

        if(this.registry.has(chunkPos.asMapKey())) {
            this.registry.get(chunkPos.asMapKey())!.set(registrationToken, callback);
        } else {
            const innerMap = new Map<string, ChunkListener>();
            innerMap.set(registrationToken, callback);
            this.registry.set(chunkPos.asMapKey(), innerMap);
        }
        this.printListenerStats();
        return registrationToken;
    }

    public unregisterListener(token: string): void {
        if(!this.tokenToChunk.has(token)) {
            return;
        }
        const chunkPos = this.tokenToChunk.get(token)!;
        if(this.registry.has(chunkPos.asMapKey())) {
            this.registry.get(chunkPos.asMapKey())!.delete(token);
        }
        this.tokenToChunk.delete(token);
        this.printListenerStats();
    }

    public onChunkUpdate(chunkUpdate: ChunkUpdate) {
        if(!this.registry.has(chunkUpdate.chunk.asMapKey())) {
            return;
        }

        this.registry.get(chunkUpdate.chunk.asMapKey())!
            .forEach(cb => {
                setTimeout(() => cb(chunkUpdate), 0);
            });
    }

    private printListenerStats(): void {
        let count = 0;
        for(let [_, chunk] of this.registry.entries()) {
            count += chunk.size;
        }
        console.log('listener stats', count);
    }
}
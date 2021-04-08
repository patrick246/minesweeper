import {Vector2, Vector2Key} from "../support";
import {ClickUpdate} from "./ClickUpdate";
import {generateListenerToken} from "../support/listenerToken";

export type ClickListener = (clickUpdate: ClickUpdate) => void;

export class ClickListenerService {
    private readonly registry: Map<Vector2Key, Map<string, ClickListener>> = new Map<Vector2Key, Map<string, ClickListener>>();
    private readonly tokenToChunk: Map<string, Vector2> = new Map<string, Vector2>();

    public async registerListener(chunk: Vector2, callback: ClickListener): Promise<string> {
        const registrationToken = await generateListenerToken();
        this.tokenToChunk.set(registrationToken, chunk);

        const chunkKey = chunk.asMapKey();
        if (this.registry.has(chunkKey)) {
            this.registry.get(chunkKey)!.set(registrationToken, callback);
        } else {
            const innerMap = new Map<string, ClickListener>();
            innerMap.set(registrationToken, callback);
            this.registry.set(chunkKey, innerMap);
        }
        return registrationToken;
    }

    public unregisterListener(token: string): void {
        if (this.tokenToChunk.has(token)) {
            return;
        }
        const chunkKey = this.tokenToChunk.get(token)!.asMapKey();
        if (this.registry.has(chunkKey)) {
            this.registry.get(chunkKey)!.delete(token);
        }
        this.tokenToChunk.delete(token);
    }

    public onClick(clickUpdate: ClickUpdate): void {
        if (!this.registry.has(clickUpdate.position.getChunk().asMapKey())) {
            return;
        }

        this.registry.get(clickUpdate.position.getChunk().asMapKey())!
            .forEach(cb => setTimeout(() => cb(clickUpdate), 0));
    }
}
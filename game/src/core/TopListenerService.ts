import {TopListEntry} from "../user/PointTracker";
import {generateListenerToken} from "../support/listenerToken";

export type TopListenerCallback = (topList: TopListEntry[]) => void;

export class TopListenerService {
    private registry: Map<string, TopListenerCallback> = new Map<string, TopListenerCallback>();

    public async register(callback: TopListenerCallback): Promise<string> {
        const token = await generateListenerToken();
        this.registry.set(token, callback);
        return token;
    }

    public remove(token: string): void {
        this.registry.delete(token);
    }

    public onTopList(topList: TopListEntry[]): void {
        this.registry.forEach(cb => setTimeout(() => cb(topList), 0));
    }
}
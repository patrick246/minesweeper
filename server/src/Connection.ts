import {User} from "game/dist/user/User";
import WebSocket from "ws";

export class Connection {
    private chunkListener: Set<string> = new Set<string>();
    private clickListener: Set<string> = new Set<string>();
    private topListener: Set<string> = new Set<string>();
    private user: User | null = null;

    public constructor(private socket: WebSocket) {
    }

    public getChunkListener(): Set<string> {
        return this.chunkListener;
    }

    public getClickListener(): Set<string> {
        return this.clickListener;
    }

    public getTopListener(): Set<string> {
        return this.topListener;
    }

    public isAuthenticated(): boolean {
        return this.user !== null;
    }

    public getUser(): User | null {
        return this.user;
    }

    public setUser(user: User) {
        this.user = user;
    }

    public getSocket(): WebSocket {
        return this.socket;
    }
}
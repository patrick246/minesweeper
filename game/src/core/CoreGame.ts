import {Context, Vector2, Vector2Key} from "../support";
import {TileContent} from "./Tile";
import {ChunkUpdate} from "./ChunkUpdate";
import {Game} from "./Game.interface";
import {ChunkedPosition} from "./ChunkedPosition";
import {World} from "./World";
import {ChunkListener, ChunkListenerService} from "./ChunkListenerService";
import {ChunkPersistence} from "../persistence";
import {Tracer} from "opentracing";
import {traced} from "../support/tracingHelper";
import {ClickUpdate} from "./ClickUpdate";
import {ClickListenerService} from "./ClickListenerService";
import {User} from "../user/User";
import {PointTracker, TopListEntry} from "../user/PointTracker";
import {TopListenerService} from "./TopListenerService";

export class CoreGame implements Game {
    private readonly world: World;
    private readonly chunkListenerService: ChunkListenerService = new ChunkListenerService();
    private readonly clickListenerService: ClickListenerService = new ClickListenerService();
    private readonly topListListener: TopListenerService = new TopListenerService();
    private readonly updateListeners: Map<Vector2Key, ChunkListener[]> = new Map<Vector2Key, ChunkListener[]>();
    private readonly chunkSize: Vector2 = new Vector2(64, 32);

    constructor(difficulty: number, chunkPersistence: ChunkPersistence, private tracer: Tracer, private pointTracker: PointTracker) {
        this.world = new World(
            this.chunkSize,
            (update) => this.onChunkUpdate(update),
            difficulty,
            chunkPersistence,
            tracer
        );
        setInterval(this.sendTopList.bind(this), 1000);
    }

    on(context: Context, _: "update", chunk: Vector2, callback: (update: ChunkUpdate) => void): Promise<string>;
    on(context: Context, _: "click", chunk: Vector2, callback: (click: ClickUpdate) => void): Promise<string>;
    public async on(ctx: Context, type: "update" | "click", chunk: Vector2, callback: ((update: ChunkUpdate) => void) | ((click: ClickUpdate) => void)): Promise<string> {
        switch (type) {
            case "click":
                return await this.onClick(ctx, type, chunk, callback as (update: ClickUpdate) => void);
            case "update":
                return await this.onUpdate(ctx, type, chunk, callback as (update: ChunkUpdate) => void);
        }
    }

    public async onTopList(_: Context, callback: (top: TopListEntry[]) => void): Promise<string> {
        return await this.topListListener.register(callback)
    }

    private async onUpdate(__: Context, _: 'update', chunk: Vector2, callback: (update: ChunkUpdate) => void): Promise<string> {
        return await this.chunkListenerService.registerListener(chunk, callback);
    }

    private async onClick(__: Context, _: 'click', chunk: Vector2, callback: (update: ClickUpdate) => void): Promise<string> {
        return await this.clickListenerService.registerListener(chunk, callback);
    }

    @traced()
    public async removeListener(__: Context, token: string): Promise<void> {
        this.chunkListenerService.unregisterListener(token);
    }

    @traced()
    public async removeClickListener(_: Context, token: string): Promise<void> {
        this.clickListenerService.unregisterListener(token);
    }

    @traced()
    public async removeTopListener(_: Context, token: string): Promise<void> {
        this.topListListener.remove(token);
    }

    @traced()
    public async getTileContents(context: Context, chunk: Vector2): Promise<TileContent[]> {
        return await this.world.getChunkTiles(context, chunk);
    }

    @traced()
    public async getChunkSize(__: Context): Promise<Vector2> {
        return this.chunkSize;
    }

    @traced()
    public async openTile(context: Context, position: ChunkedPosition): Promise<void> {
        console.log('opening tile', position);
        await this.world.openTile(context, position);
        this.sendClickEvent(context, position);
    }

    @traced()
    public async flag(context: Context, position: ChunkedPosition): Promise<void> {
        await this.world.flag(context, position);
        this.sendClickEvent(context, position);
    }

    private onChunkUpdate(update: ChunkUpdate) {
        this.chunkListenerService.onChunkUpdate(update);
        const listeners = this.updateListeners.get(update.chunk.asMapKey());
        if(listeners !== undefined) {
            listeners.forEach(cb => cb(update));
        }
    }

    private sendClickEvent(ctx: Context, position: ChunkedPosition): void {
        const user = ctx.getData<User>('user');
        if (!user) {
            return;
        }

        this.clickListenerService.onClick(new ClickUpdate(position, user.getUsername()));
    }

    private sendTopList(): void {
        const entries = this.pointTracker.getFiveMinuteTop();
        this.topListListener.onTopList(entries);
    }

    public getTracer(): Tracer {
        return this.tracer;
    }
}
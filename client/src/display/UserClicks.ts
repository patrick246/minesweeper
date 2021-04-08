import * as PIXI from 'pixi.js';
import {Context, Game, Vector2, Vector2Key} from "game";
import {VisibleChunkCalculator} from "./VisibleChunkCalculator";
import {ClickUpdate} from "game/dist/core/ClickUpdate";
import {ClickMarker} from "./ClickMarker";

import hslToRgb from '@f/hsl-to-rgb';

export class UserClicks {
    private clickContainer: PIXI.Container = new PIXI.Container();
    private visibleChunksCalculator: VisibleChunkCalculator = new VisibleChunkCalculator();
    private visibleChunks: Vector2[] = [];
    private tokens: Map<Vector2Key, string> = new Map<Vector2Key, string>();
    private usernameColor: Map<string, number> = new Map<string, number>();
    private clickMarker: ClickMarker[] = [];

    constructor(private game: Game, private tileSize: number, private myUsername: string) {
    }

    public getContainer(): PIXI.Container {
        return this.clickContainer;
    }

    public async adjustViewport(position: Vector2, viewport: Vector2): Promise<void> {
        const chunkSize = await this.game.getChunkSize(Context.empty());
        const newVisibleChunks = this.visibleChunksCalculator.getVisibleChunks(position, viewport, chunkSize, this.tileSize);

        const chunksToSubscribe = newVisibleChunks.filter(chunk => this.visibleChunks.findIndex(c => c.asMapKey() === chunk.asMapKey()) === -1);
        const chunksToUnsubscribe = this.visibleChunks.filter(chunk => newVisibleChunks.findIndex(c => c.asMapKey() === chunk.asMapKey()) === -1);

        if (chunksToSubscribe.length !== 0) {
            console.log('chunks to subscribe', chunksToSubscribe);
        }
        if (chunksToUnsubscribe.length !== 0) {
            console.log('chunks to unsubscribe', chunksToUnsubscribe);
        }

        const unsubscribePromises = chunksToUnsubscribe.map(chunk => {
            const token = this.tokens.get(chunk.asMapKey());
            if (!token) {
                return Promise.resolve();
            }
            return this.game.removeClickListener(Context.empty(), token);
        });

        const subscribePromises = chunksToSubscribe.map(async chunk => {
            const token = await this.game.on(Context.empty(), "click", chunk, this.onClick.bind(this));
            this.tokens.set(chunk.asMapKey(), token);
        });

        this.visibleChunks = newVisibleChunks;

        await Promise.all([...unsubscribePromises, ...subscribePromises]);
    }

    private onClick(clickUpdate: ClickUpdate): void {
        if (clickUpdate.username === this.myUsername) {
            return;
        }

        const cm = new ClickMarker(
            clickUpdate.position,
            clickUpdate.username,
            this.tileSize,
            this.getUsernameColor(clickUpdate.username)
        );
        this.clickMarker.push(cm);
        this.clickContainer.addChild(cm.getContainer());
    }

    public updateClickMarkers(dt: number): void {
        for (let cm of this.clickMarker) {
            cm.update(dt);
            if (cm.isExpired()) {
                this.clickContainer.removeChild(cm.getContainer());
            }
        }
        this.clickMarker = this.clickMarker.filter(cm => !cm.isExpired());
    }

    private getUsernameColor(username: string): number {
        if (this.usernameColor.has(username)) {
            return this.usernameColor.get(username)!;
        }

        const color = hslToRgb(Math.floor(Math.random() * 255), 1, .5);
        const colorNumber = color[0] << 16 | color[1] << 8 | color[2];
        this.usernameColor.set(username, colorNumber);
        return colorNumber;
    }
}
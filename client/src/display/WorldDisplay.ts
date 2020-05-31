import * as PIXI from 'pixi.js';
import {Game, Vector2} from "game";
import {ChunkLoader} from "./ChunkLoader";
import {ChunkedPosition} from "game/dist";

export class WorldDisplay {
    private readonly container: PIXI.Container = new PIXI.Container();
    private readonly chunkLoader: ChunkLoader;
    private location: Vector2 = new Vector2(0, 0);
    private tileSize: number = 32;
    private chunkSize?: Vector2;
    private offsetSinceLastRecalculation = new Vector2(0, 0);

    constructor(private game: Game) {
        this.chunkLoader = new ChunkLoader(this.game);
    }

    public getContainer(): PIXI.Container {
        return this.container;
    }

    public async onPlayerLocationUpdate(offset: Vector2, force: boolean = false) {
        this.location = this.location.add(offset);
        this.container.x = -this.location.x;
        this.container.y = -this.location.y;
        this.offsetSinceLastRecalculation = this.offsetSinceLastRecalculation.add(offset);

        console.log('offset since last view calc', this.offsetSinceLastRecalculation);

        const chunkSize = await this.getChunkSize();
        if(force || Math.abs(this.offsetSinceLastRecalculation.x) > (chunkSize.x / 2) * this.tileSize ||
            Math.abs(this.offsetSinceLastRecalculation.y) > (chunkSize.y / 2) * this.tileSize
        ) {
            this.offsetSinceLastRecalculation = new Vector2(0, 0);
            const visibleChunks = await this.chunkLoader.getChunksInViewport(this.location, new Vector2(window.innerWidth, window.innerHeight));
            for(let chunk of visibleChunks) {
                this.container.addChild(chunk.getContainer());
            }
        }
    }

    public async onPlayerClick(screenPosition: Vector2, button: number) {
        const chunkSize = await this.getChunkSize();
        const worldPosition = screenPosition.add(this.location);
        const absoluteTilePosition = worldPosition.scalarDivide(this.tileSize).floor();
        const chunkPos = absoluteTilePosition.elementDivide(await this.getChunkSize()).floor();
        const relativeTilePos = new Vector2(
            ((absoluteTilePosition.x % chunkSize.x) + chunkSize.x) % chunkSize.x,
            ((absoluteTilePosition.y % chunkSize.y) + chunkSize.y) % chunkSize.y,
        );

        console.log(
            'buttons', button,
            'screen pos', screenPosition,
            'world pos', worldPosition,
            'absolute tile pos', absoluteTilePosition,
            'chunk pos', chunkPos,
            'relative tile pos', relativeTilePos
        );

        if(button === 0) {
            this.game.openTile(new ChunkedPosition(chunkPos, relativeTilePos, chunkSize));
        } else if(button === 2) {
            this.game.flag(new ChunkedPosition(chunkPos, relativeTilePos, chunkSize));
        }
    }

    private async getChunkSize(): Promise<Vector2> {
        if(this.chunkSize) {
            return this.chunkSize
        }

        return this.chunkSize = await this.game.getChunkSize();
    }
}
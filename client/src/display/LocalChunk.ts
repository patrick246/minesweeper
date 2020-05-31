import {TileContent, Vector2} from "game";
import * as PIXI from 'pixi.js';
import {posToIndex} from "game/dist";

export class LocalChunk {
    private readonly container: PIXI.Container = new PIXI.Container();
    private readonly tileSize = 32;

    constructor(private readonly position: Vector2, private chunkSize: Vector2, private contents: TileContent[]) {
        this.container.x = position.x * this.tileSize * this.chunkSize.x;
        this.container.y = position.y * this.tileSize * this.chunkSize.y;

        this.updateContents(this.contents);
    }

    public getPosition(): Vector2 {
        return this.position;
    }

    public getContents(): TileContent[] {
        return this.contents;
    }

    public getContainer(): PIXI.Container {
        return this.container;
    }

    public updateContents(contents: TileContent[]): void {
        this.contents = contents;
        const newChildren: PIXI.DisplayObject[] = [];
        this.chunkSize.iterate2d((x, y, vec) => {
            const assetPath = LocalChunk.getAssetForTile(contents[posToIndex(vec, this.chunkSize)]);
            const tile = new PIXI.Sprite(PIXI.Loader.shared.resources[assetPath].texture);
            tile.x = x * this.tileSize;
            tile.y = y * this.tileSize;
            newChildren.push(tile);
        });
        this.container.removeChildren();
        this.container.addChild(...newChildren);


        const grid = new PIXI.Graphics()
        const text = new PIXI.Text(`${this.position.x}, ${this.position.y}`, {
            fontFamily: 'Arial',
            fontSize: '16px',
            fill: '#fff',
            align: 'center',
            stroke: '#000',
            strokeThickness: 4
        })

        grid.lineStyle(3, 0x000000, 0.6)
        grid.moveTo(0, 0)
        grid.lineTo(this.tileSize * this.chunkSize.x, 0)

        grid.moveTo(0, 0)
        grid.lineTo(0, this.tileSize * this.chunkSize.y)

        this.container.addChild(grid)
        this.container.addChild(text)
    }

    private static getAssetForTile(content: TileContent): string {
        switch (content) {
            case 'closed':
                return 'assets/tile_unopened_32.png';
            case 'mine':
                return 'assets/tile_exploded_32.png';
            case 'flag':
                return 'assets/tile_flagged_32.png';
            default:
                return `assets/tile_${content}_32.png`;
        }
    }
}
import * as PIXI from 'pixi.js';
import {ChunkedPosition} from "game";

export class ClickMarker {
    private readonly container: PIXI.Container = new PIXI.Container();
    private readonly graphics: PIXI.Graphics = new PIXI.Graphics();
    private readonly text: PIXI.Text;
    private readonly maxLifetime: number = 40;
    private lifetime: number = 0;

    public constructor(position: ChunkedPosition, username: string, private tileSize: number, private color: number) {
        const pos = position.getChunk()
            .elementMultiplicate(position.getChunkSize())
            .scalarMultiplicate(tileSize)
            .add(position.getPosition()
                .scalarMultiplicate(tileSize));

        this.graphics.x = pos.x;
        this.graphics.y = pos.y;

        this.text = new PIXI.Text(username, {
            fontFamily: 'Arial',
            fontSize: '18px',
            fill: `#${('000000' + color.toString(16)).slice(-6)}`,
            align: 'center',
            stroke: '#000000',
            strokeThickness: 4
        });
        this.text.x = pos.x;
        this.text.y = pos.y + 32;
        this.text.alpha = 1;

        this.container.addChild(this.graphics, this.text);
        this.update(0);
    }

    public update(dt: number): void {
        this.lifetime += dt;
        const alpha = Math.min(1, Math.max(0, -1/(this.maxLifetime) * this.lifetime + 1));

        this.graphics.clear();
        this.graphics.lineStyle(2, this.color, alpha);
        this.graphics.beginFill(0x000, 0);
        this.graphics.drawRect(0, 0, this.tileSize, this.tileSize);
        this.graphics.endFill();

        this.text.alpha = alpha;
    }

    public getContainer(): PIXI.Container {
        return this.container;
    }

    public isExpired(): boolean {
        return this.lifetime > this.maxLifetime;
    }
}
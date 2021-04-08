import * as PIXI from 'pixi.js';
import {Context, Game} from "game";
import {TopListEntry} from "game/dist/user/PointTracker";

export class TopList {
    private container: PIXI.Container = new PIXI.Container();
    private topEntries: PIXI.Text[] = [];

    public constructor(private game: Game) {
        const background = new PIXI.Graphics();
        background.beginFill(0x333333, 1);
        background.drawRect(0, 0, 200, 5 * 24 + 64);
        background.endFill();
        this.container.addChild(background);

        const titleText = new PIXI.Text('Top 5 (last 5 minutes)', {
            fontFamily: 'Arial',
            fontSize: '18px',
            fill: '#ffffff',
            align: 'center',
            strokeThickness: 0
        });

        titleText.y = 16;
        titleText.x = 16;

        this.container.addChild(titleText);

        for(let i = 0; i < 5; i++) {
            this.topEntries[i] = new PIXI.Text('---', {
                fontFamily: 'Arial',
                fontSize: '16px',
                fill: '#ffffff',
                align: 'center',
                strokeThickness: 0
            });

            this.topEntries[i].y = i * 24 + 48;
            this.topEntries[i].x = 16;
        }

        this.container.addChild(...this.topEntries);
        this.container.x = window.innerWidth - 200;
        this.container.y = window.innerHeight / 2 - this.container.height;
        this.game.onTopList(Context.empty(), this.onUpdate.bind(this));
    }

    public getContainer(): PIXI.Container {
        return this.container;
    }

    private onUpdate(topList: TopListEntry[]): void {
        for (let i = 0; i < 5; i++) {
            if (i < topList.length) {
                this.topEntries[i].text = `${topList[i].username}: ${topList[i].points}`;
            } else {
                this.topEntries[i].text = '---';
            }
        }
    }
}
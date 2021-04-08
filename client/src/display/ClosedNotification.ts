import * as PIXI from 'pixi.js';
import {GameClient} from "communication";

export class ClosedNotification {
    private container: PIXI.Container = new PIXI.Container();
    private notificationShown: boolean = false;

    constructor(private client: GameClient) {
    }

    public getContainer(): PIXI.Container {
        return this.container;
    }

    public checkConnection() {
        if (this.client.isClosed() && !this.notificationShown) {
            this.notificationShown = true;

            const background = new PIXI.Graphics();
            background.beginFill(0xFF8000, .95);
            background.drawRect(0, 0, window.innerWidth, 50);
            background.endFill();

            background.interactive = true;
            background.buttonMode = true;
            background.hitArea = new PIXI.Rectangle(0, 0, window.innerWidth, 50);

            background.on('pointerdown', () => {
                location.reload();
            })

            const text = new PIXI.Text('Disconnected. Click here to reload', {
                fontFamily: 'Arial',
                fontSize: '18px',
                fill: `#000000`,
                align: 'center',
            });
            text.x = (window.innerWidth - text.width) / 2;
            text.y = 16;

            this.container.addChild(background, text);
        }
    }
}
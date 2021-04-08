import * as PIXI from 'pixi.js';
import {GameClient} from "communication";
import {WorldDisplay} from "./display/WorldDisplay";
import {MouseDragListener} from "./display/MouseDragListener";
import {Vector2} from "game";
import {v4} from "uuid";
import {TopList} from "./display/TopList";
import {ClosedNotification} from "./display/ClosedNotification";

export class GameApplication {
    private app: PIXI.Application;
    private client: GameClient;
    private world: WorldDisplay | undefined;
    private topList: TopList | undefined;
    private offlineNotification: ClosedNotification | undefined;
    private mouseListener: MouseDragListener;

    constructor() {
        const url = this.findUrlValue();
        this.client = new GameClient(url);
        this.app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
        });
        this.app.renderer.view.style.position = "absolute";
        this.app.renderer.view.style.display = "block";
        window.addEventListener("resize", () => {
            this.onWindowResize();
        });

        this.mouseListener = new MouseDragListener(this.app.view);
        document.body.appendChild(this.app.view);
    }

    public async run(): Promise<void> {
        await this.client.waitForConnection();
        const loginResponse = await this.client.logIn(this.getSecret());
        await this.loadResources();
        console.log('Connected!');

        this.world = new WorldDisplay(this.client, loginResponse.username);
        this.app.stage.addChild(this.world.getContainer());

        this.topList = new TopList(this.client);
        this.app.stage.addChild(this.topList.getContainer());

        this.offlineNotification = new ClosedNotification(this.client);
        this.app.stage.addChild(this.offlineNotification.getContainer());

        setInterval(() => this.offlineNotification!.checkConnection(), 1000);

        this.mouseListener.on('drag', offset => setImmediate(() => this.world!.onPlayerLocationUpdate(offset)));
        this.mouseListener.on('click', (position, buttons) => this.world!.onPlayerClick(position, buttons));

        let startPosition = location.hash.substr(1).split(",");
        console.log(startPosition);
        if(startPosition.length !== 2) {
            startPosition = ['0', '0'];
        }
        await this.world.onPlayerLocationUpdate(
            Vector2.fromArray(startPosition.map(elem => parseInt(elem) || 0) as [number, number]),
            true
        );
    }

    private loadResources(): Promise<void> {
        return new Promise(resolve => {
            PIXI.Loader.shared.add([
                "assets/tile_32.png",
                "assets/tile_exploded_32.png",
                "assets/tile_flagged_32.png",
                "assets/tile_unopened_32.png",
                "assets/tile_0_32.png",
                "assets/tile_1_32.png",
                "assets/tile_2_32.png",
                "assets/tile_3_32.png",
                "assets/tile_4_32.png",
                "assets/tile_5_32.png",
                "assets/tile_6_32.png",
                "assets/tile_7_32.png",
                "assets/tile_8_32.png",
            ]).load(() => resolve());
        });
    }

    private findUrlValue(): string {
        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.has('server')) {
            const queryUrl = urlParams.get('server')!;
            this.setSavedGameUrl(queryUrl);
            return queryUrl;
        }
        const lastUrl = this.getSavedGameUrl();
        const url = prompt('Game Server URL', lastUrl || "ws://localhost:3000") || 'ws://localhost:3000';
        this.setSavedGameUrl(url);
        return url;
    }

    private getSecret(): string {
        let key = localStorage.getItem('minesweeper_secret');
        if (!key) {
            key = v4();
            localStorage.setItem('minesweeper_secret', key);
        }
        return key;
    }

    private getSavedGameUrl(): string | undefined {
        return localStorage.getItem('minesweeper_last_game_url') || undefined;
    }

    private setSavedGameUrl(url: string): void {
        localStorage.setItem('minesweeper_last_game_url', url);
    }


    /*
    Event Handlers
     */
    private onWindowResize() {
        this.app.renderer.resize(window.innerWidth, window.innerHeight);
    }
}
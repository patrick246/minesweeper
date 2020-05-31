import './index.css';
import * as PIXI from 'pixi.js';
import {GameApplication} from "./GameApplication";

PIXI.utils.sayHello('Minesweeper');

(async () => {
    const gameApp = new GameApplication();
    await gameApp.run();
})();

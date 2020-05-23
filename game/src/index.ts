import {CmdPlayer} from "./input/CmdPlayer";
import {Game} from "./core/Game";

const player = new CmdPlayer(new Game());
player.run().then(() => console.log('Finished')).catch(err => console.error(err));
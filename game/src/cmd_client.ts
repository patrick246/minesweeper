import {CmdPlayer} from "./input/CmdPlayer";
import {GameClient} from "./input/GameClient";

(async () => {

    const client = new GameClient("ws://localhost:3000");
    await client.waitForConnection();
    const player = new CmdPlayer(client);
    await player.run();
})();

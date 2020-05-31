/*(async () => {
    const gameServer = new GameServer(new CoreGame(), 3000);
    const gPromise = gameServer.run();


    const client = new GameClient("ws://localhost:3000");
    await client.waitForConnection();
    const player = new CmdPlayer(client);
    Promise.all([gPromise, player.run()]);
});*/

export * from './core';
export * from './support';
export * from './remote/Messages';
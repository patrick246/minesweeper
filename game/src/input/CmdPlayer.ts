import {ChunkedPosition, ChunkUpdate, Game, TileContent} from '../core';
import {Context, indexToPos, posToIndex, Vector2} from "../support";
import * as readline from "readline";

class Command {
    constructor(public action: 'exit' | 'open' | 'flag' | 'changeChunk', public data: any) {
    }
}

export class CmdPlayer {
    private rl: readline.Interface;
    private currentChunk: Vector2 = new Vector2(0, 0);
    private chunkSize: Vector2 = new Vector2(10, 10);
    private listenerToken: string = '';

    constructor(private game: Game) {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
    }

    public async run(): Promise<void> {
        //this.clearDisplay();
        this.chunkSize = await this.game.getChunkSize(Context.empty());
        await this.displayField(await this.game.getTileContents(Context.empty(), new Vector2(0, 0)), this.chunkSize);
        this.listenerToken = await this.game.on(Context.empty(), 'update', new Vector2(0, 0), update => {
            this.processUpdate(update);
        });
        while (true) {
            const command = await this.prompt();
            switch (command.action) {
                case "flag":
                    await this.game.flag(Context.empty(), new ChunkedPosition(this.currentChunk, command.data, this.chunkSize));
                    break;
                case "open":
                    await this.game.openTile(Context.empty(), new ChunkedPosition(this.currentChunk, command.data, this.chunkSize));
                    break;
                case "changeChunk":
                    this.currentChunk = command.data;
                    await this.game.removeListener(Context.empty(), this.listenerToken);
                    await this.displayField(await this.game.getTileContents(Context.empty(), this.currentChunk), this.chunkSize);
                    this.listenerToken = await this.game.on(Context.empty(), 'update', this.currentChunk, update => this.processUpdate(update));
                    break;
            }
        }
    }

    private async prompt(): Promise<Command> {
        while (true) {
            const pos: string = await new Promise((resolve) => {
                //process.stdout.cursorTo(0, process.stdout.rows - 1);
                this.rl.question('position to open> ', (answer: string) => resolve(answer))
            });

            if (pos === 'exit') {
                return {action: 'exit', data: 0};
            }

            if (pos[0].toLowerCase() === 'f') {
                const flagSubstr = pos.substr(2);
                const components = flagSubstr.split(',');
                const flagPos = new Vector2(parseInt(components[0]), parseInt(components[1]));
                return {
                    action: 'flag',
                    data: flagPos
                };
            }

            if(pos[0].toLowerCase() === 'c') {
                const chunkSubstr = pos.substr(2);
                const components = chunkSubstr.split(',');
                const chunkPos = new Vector2(parseInt(components[0]), parseInt(components[1]));
                return {
                    action: 'changeChunk',
                    data: chunkPos
                };
            }

            if (pos.indexOf(',') !== -1) {
                const components = pos.split(',');
                const openPos = new Vector2(parseInt(components[0]), parseInt(components[1]));
                return {
                    action: "open",
                    data: openPos
                };
            }
            process.stdout.write("Invalid command\n");
        }
    }

    private async displayField(field: TileContent[], size: Vector2): Promise<void> {
        const contents = field.map((entry, index) => {
            const pos = indexToPos(index, this.chunkSize);
            switch (entry) {
                case "closed":
                    return "[(" + pos.x + "," + pos.y + ")]";
                case "mine":
                    return "[  X  ]";
                case "flag":
                    return "[  F  ]";
            }
            return "[  " + entry + "  ]";
        });
        //this.clearDisplay();
        //process.stdout.cursorTo(0, 0);
        size.iterate2d(((x, _, vec) => {
            if (x === 0) {
                process.stdout.write("\n");
            }
            process.stdout.write(" " + contents[posToIndex(vec, size)])
        }));
    }

    private async processUpdate(chunkUpdate: ChunkUpdate) {
        console.log('update', chunkUpdate);
        if(!this.currentChunk.equals(chunkUpdate.chunk)) {
            // ignore
            return;
        }
        await this.displayField(chunkUpdate.field, chunkUpdate.size);
    }

    public clearDisplay(): void {
        for (let i = 0; i < process.stdout.rows; i++) {
            process.stdout.cursorTo(0, i);
            process.stdout.clearLine(0);
        }
    }
}
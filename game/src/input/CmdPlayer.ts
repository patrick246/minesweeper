import {Game} from '../core/Game';
import {indexToPos, posToIndex} from "../support/2dFieldOperations";
import * as readline from "readline";
import {Vector2} from "../support/Vector2";
import {TileContent} from "../core/Tile";

export class CmdPlayer {
    private rl: readline.Interface;

    constructor(private game: Game) {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        })
    }

    public async run(): Promise<void> {
        this.clearDisplay();
        const size = this.game.getSize();
        await this.displayField(this.game.getTileContents(), size);
        this.game.on('update', update => {
            this.displayField(update.field, update.size);
        });
        while (!this.game.isGameOver()) {
            await this.prompt();
        }
    }

    private async prompt(): Promise<void> {
        while (true) {
            const pos: string = await new Promise((resolve) => {
                process.stdout.cursorTo(0, process.stdout.rows - 1);
                this.rl.question('position to open> ', (answer: string) => resolve(answer))
            });

            if (pos === 'exit') {
                process.exit(0);
            }

            if (pos[0].toLowerCase() === 'f') {
                const flagSubstr = pos.substr(2);
                const components = flagSubstr.split(',');
                const flagPos = new Vector2(parseInt(components[0]), parseInt(components[1]));
                this.game.flag(flagPos);
                return;
            }

            if (pos.indexOf(',') !== -1) {
                const components = pos.split(',');
                const openPos = new Vector2(parseInt(components[0]), parseInt(components[1]));
                this.game.openTile(openPos);
                return;
            }
            process.stdout.write("Invalid position\n");
        }
    }

    private async displayField(field: TileContent[], size: Vector2): Promise<void> {
        const contents = field.map((entry, index) => {
            const pos = indexToPos(index, this.game.getField().getSize());
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
        this.clearDisplay();
        process.stdout.cursorTo(0, 0);
        size.iterate2d(((x, _, vec) => {
            if (x === 0) {
                process.stdout.write("\n");
            }
            process.stdout.write(" " + contents[posToIndex(vec, size)])
        }));
    }

    public clearDisplay(): void {
        for (let i = 0; i < process.stdout.rows; i++) {
            process.stdout.cursorTo(0, i);
            process.stdout.clearLine(0);
        }
    }
}
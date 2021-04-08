import {User} from "game/dist/user/User";
import {NameGenerator} from "./NameGenerator";
import {Collection} from "mongodb";
import {v4} from "uuid";

export class UserService {
    constructor(private nameGenerator: NameGenerator, private userDb: Collection) {
    }

    public async getUser(secret: string): Promise<User> {
        const id = v4();
        const name = this.nameGenerator.getNextName();

        const result = await this.userDb.findOneAndUpdate({ secret: secret }, {
            $setOnInsert: {
                _id: id,
                username: name,
            }
        }, {
            upsert: true
        });

        if (!result.value) {
            return new User(id, name);
        }

        return new User(result.value._id, result.value.username);
    }
}
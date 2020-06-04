import {User} from "./User";
import {v4} from 'uuid';
import {NameGenerator} from "./NameGenerator";

export class UserService {
    private users: Map<string, User> = new Map<string, User>();

    constructor(private nameGenerator: NameGenerator) {
    }

    public async getUserById(id: string): Promise<User | null> {
        if (this.users.has(id)) {
            return this.users.get(id)!;
        }
        return null;
    }

    public async createUser(): Promise<User> {
        const user = new User(v4(), await this.nameGenerator.getNextName());
        this.users.set(user.getId(), user);
        return user;
    }

    public async getUserFromToken(token: string): Promise<User> {
        void(token);
        throw new Error("Not implemented: get user from oidc access token");
    }
}
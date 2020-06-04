export class User {
    public constructor(
        private id: string,
        private username: string
    ) {
    }

    public getUsername(): string {
        return this.username;
    }

    public getId(): string {
        return this.id;
    }
}
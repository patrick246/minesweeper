type TopMap = { [user: string]: number };
export interface TopListEntry {
    username: string;
    points: number;
}

export class PointTracker {
    private tracker: {[fiveSecond: number]: {[user: string]: number}} = {}

    public track(user: string, points: number): void {
        const bucket = Math.floor(Date.now() / 1000 / 5);
        if (!this.tracker[bucket]) {
            this.tracker[bucket] = {};
        }

        if (!this.tracker[bucket][user]) {
            this.tracker[bucket][user] = 0;
        }

        this.tracker[bucket][user] += points;
    }

    public getFiveMinuteTop(): TopListEntry[] {
        const top = this.getTop(60);
        return Object.entries(top)
            .map(([username, points]) => ({username, points}))
            .sort((a, b) => b.points - a.points)
            .slice(0, 5);
    }

    private getTop(lastN5Seconds: number): TopMap {
        const top: TopMap = {};
        const currentBucket = Math.floor(Date.now() / 1000 / 5)
        for (let i = 0; i < lastN5Seconds; i++) {
            if (!this.tracker[currentBucket - i]) {
                continue;
            }
            for (let [user, points] of Object.entries(this.tracker[currentBucket - i])) {
                top[user] = (top[user] || 0) + points;
            }
        }
        return top;
    }

    public cleanUp(): void {
        const lastNecessaryBucket = Math.floor(Date.now() / 1000 / 5) - 60;
        for (let key of Object.keys(this.tracker)) {
            if (parseInt(key) < lastNecessaryBucket) {
                delete this.tracker[parseInt(key)];
            }
        }
    }
}

export type TrackFunction = (num: number) => void;

export function track(tracker: PointTracker, user: string): (points: number) => void {
    return function (points: number) {
        tracker.track(user, points);
    }
}

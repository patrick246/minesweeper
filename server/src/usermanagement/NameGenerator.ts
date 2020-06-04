// English adjectives
const ADJECTIVES = [
    "cute", "dapper", "large", "small", "long", "short", "thick", "narrow",
    "deep", "flat", "whole", "low", "high", "near", "far", "fast",
    "quick", "slow", "early", "late", "bright", "dark", "cloudy", "warm",
    "cool", "cold", "windy", "noisy", "loud", "quiet", "dry", "clear",
    "hard", "soft", "heavy", "light", "strong", "weak", "tidy", "clean",
    "dirty", "empty", "full", "close", "thirsty", "hungry", "fat", "old",
    "fresh", "dead", "healthy", "sweet", "sour", "bitter", "salty", "good",
    "bad", "great", "important", "useful", "expensive", "cheap", "free", "difficult",
    "strong", "weak", "able", "free", "rich", "afraid", "brave", "fine",
    "sad", "proud", "comfortable", "happy", "clever", "interesting", "famous", "exciting",
    "funny", "kind", "polite", "fair", "share", "busy", "free", "lazy",
    "lucky", "careful", "safe", "dangerous"
];

// English plural nouns (all animals)
const NOUNS = [
    "rabbit", "badger", "fox", "chicken", "bat", "deer", "snake", "hare",
    "hedgehog", "platypus", "mole", "mouse", "otter", "rat", "squirrel", "stoat",
    "weasel", "crow", "dove", "duck", "geese", "hawk", "heron", "kingfisher",
    "owl", "peafowl", "pheasant", "pigeon", "rook", "sparrow", "starling",
    "swan", "ant", "bee", "butterfly", "dragonfly", "fly", "moth", "spider",
    "pike", "salmon", "trout", "frog", "newt", "toad", "crab", "lobster",
    "clam", "cockle", "mussel", "oyster", "snail", "cattle", "dog", "donkey",
    "goat", "horse", "pig", "sheep", "ferret", "gerbil", "guinea pig", "parrot",
];

export class NameGenerator {

    public async getNextName(): Promise<string> {
        return ADJECTIVES[ADJECTIVES.length * Math.random()] + "_" + NOUNS[NOUNS.length * Math.random()];
    }
}
import {Span} from "opentracing";

export class Context {
    private constructor(private readonly data: Map<string, unknown>, private span?: Span) {
    }

    public static empty(): Context {
        return new Context(new Map<string, unknown>());
    }

    public getData<T>(key: string): T | null {
        if (!this.data.has(key)) {
            return null;
        }
        return this.data.get(key)! as T;
    }

    public withData<T>(key: string, value: T): Context {
        const newMap = new Map<string, unknown>(this.data);
        newMap.set(key, value);
        return new Context(newMap, this.span);
    }

    public withSpan(span: Span): Context {
        return new Context(new Map<string, unknown>(this.data), span);
    }

    public getSpan(): Span | undefined {
        return this.span;
    }
}
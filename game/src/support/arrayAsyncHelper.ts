export async function filterAsync<T>(array: Array<T>, predicate: (elem: T) => Promise<boolean>): Promise<Array<T>> {
    const shouldKeep = await Promise.all(array.map(predicate));
    const result: Array<T> = [];
    for(let [i, v] of array.entries()) {
        if(shouldKeep[i]) {
            result.push(v);
        }
    }
    return result;
}


import {randomBytes} from "crypto";

export function generateListenerToken(): Promise<string> {
    return new Promise((resolve, reject) => {
        randomBytes(8, (err, buf) => {
            if(err) {
                return reject(err);
            }
            resolve(buf.toString('hex'));
        })
    });
}
import * as zlib from "zlib";
export { constants } from "zlib";

declare module "fast-zlib" {
    export class Inflate {
        constructor(options?: zlib.ZlibOptions);
        process: (data: Buffer, flag?: number) => Buffer;
        instance: zlib.Inflate;
    }
    export class Deflate {
        constructor(options?: zlib.ZlibOptions);
        process: (data: Buffer, flag?: number) => Buffer;
        instance: zlib.Deflate;
    }
}

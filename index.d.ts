import {
    ZlibOptions,
    BrotliOptions,
    Inflate as InflateClass,
    Deflate as DeflateClass,
    InflateRaw as InflateRawClass,
    DeflateRaw as DeflateRawClass,
    Gzip as GzipClass,
    Gunzip as GunzipClass,
    Unzip as UnzipClass,
    BrotliCompress as BrotliCompressClass,
    BrotliDecompress as BrotliDecompressClass
} from "zlib";

export { constants } from "zlib";

declare abstract class Base {
    process: (buffer: Buffer, flag?: number) => Buffer;
    process: (arrayBuffer: WithImplicitCoercion<ArrayBuffer | SharedArrayBuffer>, flag?: number) => Buffer;
    process: (data: Uint8Array | ReadonlyArray<number>, flag?: number) => Buffer;
    process: (data: WithImplicitCoercion<Uint8Array | ReadonlyArray<number> | string>, flag?: number) => Buffer;
    process: (str: WithImplicitCoercion<string> | { [Symbol.toPrimitive](hint: 'string'): string }, flag?: number) => Buffer;
    close: () => void;
}

declare abstract class ZlibBase extends Base {
    constructor(options?: ZlibOptions);
}

declare abstract class BrotliBase extends Base {
    constructor(options?: BrotliOptions);
}

declare module "fast-zlib" {
    export class Inflate extends ZlibBase {
        instance: InflateClass;
    }
    export class Deflate extends ZlibBase {
        instance: DeflateClass;
    }
    export class InflateRaw extends ZlibBase {
        instance: InflateRawClass;
    }
    export class DeflateRaw extends ZlibBase {
        instance: DeflateRawClass;
    }
    export class Gzip extends ZlibBase {
        instance: GzipClass;
    }
    export class Gunzip extends ZlibBase {
        instance: GunzipClass;
    }
    export class Unzip extends ZlibBase {
        instance: UnzipClass;
    }
    export class BrotliCompress extends BrotliBase {
        instance: BrotliCompressClass;
    }
    export class BrotliDecompress extends BrotliBase {
        instance: BrotliDecompressClass;
    }
}

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

declare abstract class ZlibBase {
    constructor(options?: ZlibOptions);
    process: (data: Buffer, flag?: number) => Buffer;
}

declare abstract class BrotliBase {
    constructor(options?: BrotliOptions);
    process: (data: Buffer, flag?: number) => Buffer;
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

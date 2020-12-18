declare module "fast-zlib" {
    import * as z from "zlib";
    interface Instance {
        (data: string | Buffer, flushFlag: number): Buffer;
        zlib: z.Zlib
    }
    const zlib: {
        (method: string, options?: z.ZlibOptions): Instance;
        constants: object;
    }
    export = zlib;
}
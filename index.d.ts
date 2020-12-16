declare module "fast-zlib" {
    import * as zlib from "zlib";
    interface Instance {
        (data: string | Buffer, flushFlag: number): Buffer;
        zlib: zlib.Zlib
    }
    function lib(method: string, options?: zlib.ZlibOptions): Instance;
    lib.constants = zlib.constants;
    export = lib;
}
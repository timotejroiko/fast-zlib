# fast-zlib-sync

Or how to trick node's native zlib module into performing shared context compression synchronously.

Warning: This package uses node's undocumented private APIs which may change in future node.js versions.

Method originally developed by [isaacs/minizlib](github.com/isaacs/minizlib)

## Shared Context / Context Takeover

Shared context means that for each chunk of data that is compressed, some information about it is stored in the compressor so that in the next chunk of data the compressor will reuse some of that information to compress more efficiently. The decompressor will do the same thing, each decompressed chunk leaves some data behind to help the decompressor decode the next chunk.

Node's native zlib module does this asynchronously using transform streams to be as non-blocking as possible, however because zlib is cpu-bound, its an artificial async which can cause high latency and memory usage due to the overhead, data build up and memory fragmentation (see [ws#1369](https://github.com/websockets/ws/issues/1369) [node#8871](https://github.com/nodejs/node/issues/8871))

This package provides a way to create a shared zlib context while synchronously processing chunks in the same way as any other sync compression functions and libraries.

## Usage

Usage is similar to any other synchronous compression library, compress a chunk, then decompress it elsewhere.

```js
let zlib = require("fast-zlib-sync");

let deflate = zlib("deflate");
let inflate = zlib("inflate");

let data = "123456789";

let chunk1 = deflate(data); // Buffer(13) [120, 156, 50, 52, 50, 54, 49, 53, 51, 183, 176, 4, 8]  // first chunk of data sets up the shared context
let chunk2 = deflate(data); // Buffer(5) [32, 67, 24, 3, 32]  // shared context kicks in
let chunk3 = deflate(data); // Buffer(5) [128, 224, 12, 128, 0]  // and continues to apply to all subsequent chunks

let decoded1 = inflate(chunk1);
console.log(decoded1.toString()) // "123456789"

let decoded2 = inflate(chunk2);
console.log(decoded2.toString()) // "123456789"

let decoded3 = inflate(chunk3);
console.log(decoded3.toString()) // "123456789"
```

## Docs

All major zlib classes are supported:

```js
let zlib = require("fast-zlib-sync");

let inflate = zlib("inflate");
let deflate = zlib("deflate");
let inflateRaw = zlib("inflateRaw");
let deflateRaw = zlib("deflateRaw");
let gzip = zlib("gzip");
let unzip = zlib("unzip");
let gunzip = zlib("gunzip");
let brotli = zlib("brotliCompress");
let debrotli = zlib("brotliDecompress");

let data = gzip("wefwefwef");
console.log(unzip(data).toString());
```

Each zlib class can also be passed an options object as per zlib's documentation - [https://nodejs.org/docs/latest-v12.x/api/zlib.html](https://nodejs.org/docs/latest-v12.x/api/zlib.html)

```js
let zlib = require("fast-zlib-sync");

let inflateRaw = zlib("inflateRaw", {
	chunkSize: 64 * 1024,
});
```

Additionally, an extra **unsafe** option is available.

```js
let zlib = require("fast-zlib-sync");

let inflateRaw = zlib("inflateRaw", {
	unsafe: true
});
```

By default, compressors and decompressors accept any Buffer-compatible input (Buffer | TypedArray | DataView | ArrayBuffer | string) and return a Buffer.

If unsafe mode is enabled, only Buffers are accepted as inputs and the resulting Buffers are returned as reference instead of copy. This can potentially make processing faster, but the returned value must be immediately consumed, copied, transformed or dispatched, because next processed chunk will overwrite the previous one.

This library sets Z_SYNC_FLUSH as the default flush flag in order to process data immediately. If you want to experiment with flags that offer more control over the process, you can access the internal zlib class methods from an included zlib property.

```js
let zlib = require("fast-zlib-sync");

let deflate = zlib("deflate", {
	flush: zlib.Z_NO_FLUSH // all of zlib's constants are accessible from fast-zlib-sync
});

let inflate = zlib("inflate");

// here, deflate.zlib represents the instance of zlib.createDeflate() that is held within the function
// All compressors and decompressors have a .zlib property to access their internal zlib class
deflate("123");
deflate("456");
deflate("789");
deflate.zlib.flush();
let data = deflate.zlib.read();

console.log(inflate(data).toString()) // 123456789
```

## Caveats

Because of the shared context, decompression must be done in exactly the same order as compression because each chunk sequentially complements the previous and the next. Attempting to decode a chunk out of order will throw an error and invalidate the decompressor's internal state, forcing you to create a new decompressor and start again from the beginning, or destroying both and starting a new compressor and decompressor pair;

```js
let chunk1 = deflate(data)
let chunk2 = deflate(data)

inflate(chunk2) // error
inflate(chunk1) // error because the inflator is now invalid
inflate = fastzlib("inflate") // create a new inflator and start from the beginning
inflate(chunk1) // works
inflate(chunk2) // works
```

When working with streams that fragment data, such as a TCP stream, you need to make sure each zlib block of data is fully avai

## Benchmark

soon
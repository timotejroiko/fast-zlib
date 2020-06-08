# fast-zlib

This package is a simple `zlib` wrapper for Node.js that exposes functions for synchronous shared context compression.

Method inspired from [isaacs/minizlib](https://github.com/isaacs/minizlib)

## Shared Context / Context Takeover / Sliding Window

When working with data streams, zlib makes use of a "sliding window", in which a dictionary of common patterns is built and kept on both ends of the stream. When the compressor encounters a common pattern, it replaces it with a reference to the decompressor's dictionary and thus doesnt need to send that piece of data at all. This referenced pattern will simply be reconstructed by the decompressor using data from its dictionary. This is also known as context sharing or context takeover.

Node's native zlib module does not offer a public API to perform this task synchronously and instead offers an asynchronous API using transform streams. Because zlib itself is synchronous and does not depend on anything other than cpu, artificially making it asynchronous may cause problems with performance, high latency and memory fragmentation, especially with a high volume of small chunks of data. (see [ws#1369](https://github.com/websockets/ws/issues/1369) and [node#8871](https://github.com/nodejs/node/issues/8871))

Node does however include all the necessary tools and functionality in its private and undocumented APIs, for instance its `_processChunk()` method, which this package makes use of to provide an easy and fast way to synchronously process chunks in a shared zlib context.

## Docs

This package is essentially a high-order function that returns a compressor or a decompressor function.

### fastzlib(method[, options])

- `method` (String): A string representing the zlib class to create
- `options` (Object): An options object for the zlib instance
- Returns (Function): A compressor or a decompressor function

The returned function is powered by a zlib class instance behind the scenes. Buffer-compatible inputs are Buffer, TypedArray, DataView, ArrayBuffer and String.

### instance(data[, flag])

- `data` (Buffer-compatible): The data to be compressed or decompressed
- `flag` (Integer): A flush flag to override the default
- Returns (Buffer): A Buffer of data

All major zlib classes are supported:

```js
let zlib = require("fast-zlib");

let inflate = zlib("inflate");
let deflate = zlib("deflate");
let inflateRaw = zlib("inflateRaw");
let deflateRaw = zlib("deflateRaw");
let gzip = zlib("gzip");
let unzip = zlib("unzip");
let gunzip = zlib("gunzip");
let brotli = zlib("brotliCompress");
let debrotli = zlib("brotliDecompress");
```

## Usage Examples

Usage is similar to any other synchronous compression library, compress a chunk, then decompress it elsewhere, except that the functions keep track of its compression state and sliding window contexts.

```js
let zlib = require("fast-zlib");

let deflate = zlib("deflate"); // create a deflator
let inflate = zlib("inflate"); // create an inflator

let data = "123456789";

let chunk1 = deflate(data);
// Buffer(17) [120, 156, 50, 52, 50, 54, 49, 53, 51, 183, 176, 4, 0, 0, 0, 255, 255]
// first chunk of data is fully processed

let chunk2 = deflate(data);
// Buffer(9) [50, 132, 49, 0, 0, 0, 0, 255, 255]
// reusable patterns from previous compression are referenced

let chunk3 = deflate(data);
// Buffer(8) [130, 51, 0, 0, 0, 0, 255, 255]
// and continues to be applied to all subsequent chunks

inflate(chunk1).toString(); // "123456789"
inflate(chunk2).toString(); // "123456789"
inflate(chunk3).toString(); // "123456789"
```

Decompression must be done in exactly the same order as compression because each chunk sequentially complements the previous and the next. Attempting to decode a chunk out of order will throw an error and reset the decompressor so it has to either restart from the beginning or you will have to destroy both and create a new compressor/decompressor pair.

```js
let chunk1 = deflate(data);
let chunk2 = deflate(data);

inflate(chunk2); // error
inflate(chunk1); // works
inflate(chunk2); // works
```

Each zlib class can be passed an options object as per zlib's documentation.

```js
let deflateRaw = zlib("deflateRaw", {
	chunkSize: 128 * 1024,
	level: 8
});
let inflateRaw = zlib("inflateRaw", {
	chunkSize: 64 * 1024
});
```

This library uses Z_SYNC_FLUSH as the default flush flag in order to process data immediately. For more control over the compression process, flush flags can be set as an option and also passed directly to the function.

```js
// all of zlib's constants are accessible
let deflate = zlib("deflate", {
	flush: zlib.constants.Z_NO_FLUSH // set default flag to Z_NO_FLUSH
});
let inflate = zlib("inflate");

deflate("123"); // add data without processing
deflate("456");
deflate("789");

let data = deflate("hij", zlib.constants.Z_SYNC_FLUSH); // process all data added so far and return it

inflate(data).toString(); // 123456789hij
```

Flush flags can be used to achieve fine control over the compression process and even create checkpoints from where decompression can resume

```js
let deflate = zlib("deflateRaw");
let inflate = zlib("inflateRaw");

deflate("123", zlib.constants.Z_NO_FLUSH);
deflate("456", zlib.constants.Z_NO_FLUSH);
let data = deflate("789", zlib.constants.Z_SYNC_FLUSH);

deflate("abc", zlib.constants.Z_NO_FLUSH);
let data2 = deflate("789", zlib.constants.Z_FULL_FLUSH);
// Z_FULL_FLUSH creates a checkpoint from where the decompressor can restart

deflate("xyz", zlib.constants.Z_NO_FLUSH);
let data3 = deflate("789", zlib.constants.Z_SYNC_FLUSH);

inflate(data).toString(); // 123456789
inflate(data2).toString(); // abc789
inflate(data3).toString(); // zyx789

// we can restart the decompression sequence from a Z_FULL_FLUSH block at any time
inflate(data2).toString(); // abc789
inflate(data3).toString(); // xyz789
```

Not all classes support the same flags and there might be small differences in behavior between deflate, gzip and brotli. For example brotli uses different flush flags compared to deflate and gzip. Instead of `Z_NO_FLUSH` and `Z_SYNC_FLUSH`, its flags are `BROTLI_OPERATION_PROCESS` and `BROTLI_OPERATION_FLUSH`. Check zlib's documentation for more details about how each class works.

```js
// default flag is zlib.BROTLI_OPERATION_FLUSH
let compress = zlib("brotliCompress");
let decompress = zlib("brotliDecompress");

let compressed = compress("abc");
decompress(compressed).toString(); // abc

compress("123",zlib.constants.BROTLI_OPERATION_PROCESS);
compress("456",zlib.constants.BROTLI_OPERATION_PROCESS);
let data = compress("789",zlib.constants.BROTLI_OPERATION_FLUSH);

decompress(data).toString(); // 123456789
```

## Benchmark

Tested on Node.js v12.16.1 running on an i5 7300HQ 2.5ghz with default zlib options

Deflate performance on randomized json messages of various sizes

| Library | \~ 0.03kb | \~ 0.5kb | \~ 11kb |
|---------------|---------|--------|-------|
| zlib (stream) | 12839 op/s | 7441 op/s | 978 op/s |
| pako (stream) | 23071 op/s | 8961 op/s | 638 op/s |
| minizlib | 38939 op/s | 14933 op/s | 1131 op/s |
| fast-zlib | 61899 op/s | 16533 op/s | 1125 op/s |

Inflate performance on the same messages

| Library | \~ 0.03kb | \~ 0.5kb | \~ 11kb |
|---------------|---------|--------|-------|
| zlib (stream) | 13579 op/s | 10378 op/s | 3276 op/s |
| pako (stream) | 44077 op/s | 25278 op/s | 4159 op/s |
| minizlib | 68383 op/s | 39486 op/s | 7776 op/s |
| zlib-sync | 126418 op/s | 46206 op/s | 7384 op/s |
| fast-zlib | 138365 op/s | 53413 op/s | 8097 op/s |

More benchmarks can be found at [zlib-benchmark](https://github.com/timotejroiko/zlib-benchmark)

## Experimental Unsafe Mode

This package contains an additional `Z_SYNC_FLUSH_UNSAFE` experimental flag for maximum performance, but it can cause issues if not used carefully. It cannot be interchanged with Z_FULL_FLUSH, it does not append zlib's signature block delimiter (0,0,255,255), only accepts a Buffer as input, and reuses existing buffers when possible.

```js
let deflate = zlib("deflate");

let data = Buffer.from("123456789");

let chunkref = deflate(data, zlib.constants.Z_SYNC_FLUSH_UNSAFE); // Buffer(13) [120, 156, 50, 52, 50, 54, 49, 53, 51, 183, 176, 4, 8]
deflate(data, zlib.constants.Z_SYNC_FLUSH_UNSAFE); // Buffer(5) [32, 67, 24, 3, 32]

console.log(chunkref) // Buffer(13) [32, 67, 24, 3, 32, 54, 49, 53, 51, 183, 176, 4, 8]
// first 5 bytes overwritten by the second deflate call
// the second call writes to the existing buffer and returns a Buffer.subarray of it
```
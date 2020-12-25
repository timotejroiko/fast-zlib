# fast-zlib

A simple `zlib` wrapper for Node.js that enables synchronous shared context compression.

## Shared Context / Context Takeover / Sliding Window

When working with data streams, zlib makes use of a "sliding window", in which a dictionary of common patterns is built and kept on both ends of the stream. When the compressor encounters a common pattern, it replaces it with a reference to the decompressor's dictionary and thus doesnt need to send that piece of data at all. This referenced pattern will simply be reconstructed by the decompressor using data from its dictionary. This is also known as context sharing or context takeover.

Node's native zlib module does not offer a public API to perform this task synchronously and instead offers an asynchronous API using transform streams. Because zlib itself is synchronous, artificially defering it can cause issues such as high latency and memory fragmentation, especially when processing a high volume of small chunks of data like websocket messages. (see [ws#1369](https://github.com/websockets/ws/issues/1369) and [node#8871](https://github.com/nodejs/node/issues/8871))

Node does however include all the necessary tools and functionality in its private and undocumented APIs, for instance its `_processChunk()` method, which this package makes use of to provide an easy and fast way to synchronously process chunks of data without losing the zlib context.

## Usage

Fast-zlib exports a modified synchronous version of all zlib classes:

```js
const zlib = require("fast-zlib");

let inflate = new zlib.Inflate();
let deflate = new zlib.Deflate();
let inflateRaw = new zlib.InflateRaw();
let deflateRaw = new zlib.DeflateRaw();;
let gzip = new zlib.Gzip();
let unzip = new zlib.Unzip();
let gunzip = new zlib.Gunzip();
let brotli = new zlib.BrotliCompress();
let debrotli = new zlib.BrotliDecompress();
```

ES6 imports and typescript users can also use the following:

```ts
import zlib from "fast-zlib";
let deflate = new zlib.Deflate();
```

```ts
import { Deflate } from "fast-zlib";
let deflate = new Deflate();
```

Each fast-zlib class is a wrapper around the original zlib class and looks like this:

### constructor(options?)

Create a new instance of a fast-zlib class.

* `options` - An optional object of zlib or brotli options as per node's zlib documentation.

### .process(data, flag?)

Process a chunk of data.

* `data` - A Buffer of data to be compressed or decompressed. Non-Buffers will be internally converted to Buffer.
* `flag` - An optional flush flag to override the default flag.
* `=> Buffer` - A Buffer of processed data.

### .close()

Close the zlib handler and shut down the instance.

* `=> void`

### .instance

Access the underlying zlib instance for advanced usage.

## Examples

Usage is very simple, compress a chunk of data and decompress it elsewhere. The instance keeps track of its compression state and sliding window contexts.

```js
let zlib = require("fast-zlib");

let deflate = new zlib.Deflate(); // create a deflator
let inflate = new zlib.Inflate(); // create an inflator

let data = "123456789";

let chunk1 = deflate.process(data);
// Buffer(17) [120, 156, 50, 52, 50, 54, 49, 53, 51, 183, 176, 4, 0, 0, 0, 255, 255]
// the first chunk of data is fully processed

let chunk2 = deflate.process(data);
// Buffer(9) [50, 132, 49, 0, 0, 0, 0, 255, 255]
// reusable patterns from previous compressions are referenced

let chunk3 = deflate.process(data);
// Buffer(8) [130, 51, 0, 0, 0, 0, 255, 255]
// and the context continues to adapt to all subsequent chunks

inflate.process(chunk1).toString(); // "123456789"
inflate.process(chunk2).toString(); // "123456789"
inflate.process(chunk3).toString(); // "123456789"
```

Decompression must be done in exactly the same order as compression because chunks sequentially complement each other. Attempting to decode a chunk out of order may throw an error and reset the decompressor so it has to either restart from the beginning or you will have to destroy both and create a new pair.

```js
let chunk1 = deflate.process(data);
let chunk2 = deflate.process(data);

inflate.process(chunk2); // error
inflate.process(chunk1); // works
inflate.process(chunk2); // works
```

Each zlib class can be passed an options object as per zlib's documentation.

```js
let deflateRaw = new zlib.DeflateRaw({
    chunkSize: 128 * 1024,
    level: 8
});
let inflateRaw = new zlib.InflateRaw({
    chunkSize: 64 * 1024
});
```

This library uses Z_SYNC_FLUSH as the default flush flag in order to return data immediately. For more control over the compression process, flush flags can be set as an option and also passed directly to the process function.

```js
let deflate = new zlib.Deflate({
    flush: zlib.constants.Z_NO_FLUSH // set default flag to Z_NO_FLUSH
});
let inflate = new zlib.Inflate();

deflate.process("123"); // add data
deflate.process("456");
deflate.process("789");

// process all data added so far by passing Z_SYNC_FLUSH
let data = deflate.process("hij", zlib.constants.Z_SYNC_FLUSH);

inflate.process(data).toString(); // 123456789hij
```

Other flush flags are also available and can be used to achieve fine control over the process. Not all classes support the same flags and there might be differences in behavior between them. For example brotli uses `BROTLI_OPERATION_PROCESS` and `BROTLI_OPERATION_FLUSH` instead of `Z_NO_FLUSH` and `Z_SYNC_FLUSH`. Check zlib's documentation for more details about how each class works.

```js
// default flag is zlib.BROTLI_OPERATION_FLUSH
let compress = new zlib.BrotliCompress();
let decompress = new zlib.BrotliDecompress();

let compressed = compress.process("abc");
decompress.process(compressed).toString(); // abc

compress.process("123", zlib.constants.BROTLI_OPERATION_PROCESS);
compress.process("456", zlib.constants.BROTLI_OPERATION_PROCESS);
let data = compress.process("789", zlib.constants.BROTLI_OPERATION_FLUSH);

decompress.process(data).toString(); // 123456789
```

## Benchmark

Tested on Node.js v15.4.0 running on an i5 7300HQ 2.5ghz with default zlib options

Deflate performance on randomized json messages of various sizes

| Library | \~ 0.03kb | \~ 0.5kb | \~ 11kb |
|---------------|---------|--------|-------|
| zlib (stream) | 38140 op/s | 18496 op/s | 1621 op/s |
| pako (stream) | 38975 op/s | 13377 op/s | 835 op/s |
| minizlib | 74851 op/s | 26104 op/s | 1892 op/s |
| zlib-sync* | - | - | - |
| fast-zlib | 113056 op/s | 29612 op/s | 1948 op/s |

Inflate performance on the same messages

| Library | \~ 0.03kb | \~ 0.5kb | \~ 11kb |
|---------------|---------|--------|-------|
| zlib (stream) | 61274 op/s | 34272 op/s | 5262 op/s |
| pako (stream)* | - | - | - |
| minizlib | 198000 op/s | 96283 op/s | 13944 op/s |
| zlib-sync | 407455 op/s | 127178 op/s | 14875 op/s |
| fast-zlib | 641532 op/s | 145444 op/s | 15194 op/s |

*zlib-sync does not yet support compression.  
*pako v2 removed support for decompressing with Z_SYNC_FLUSH.

More benchmarks can be found at [zlib-benchmark](https://github.com/timotejroiko/zlib-benchmark)

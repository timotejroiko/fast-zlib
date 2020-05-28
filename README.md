# fast-zlib

Or how to trick node's native zlib module into performing shared context compression synchronously.

Warning: This package uses node's undocumented private APIs which may change in future node.js versions without notice.

Method inspired from [isaacs/minizlib](https://github.com/isaacs/minizlib)

## Shared Context / Context Takeover

Shared context means that for each chunk of data that is compressed, some information about it is stored in the compressor so that the next chunk can be more efficiently compressed by reusing saved information. The decompressor will do the same thing, each decompressed chunk leaves some data behind to help it decode the next chunk.

Node's native zlib module does not offer a public API to perform this task synchronously and instead offers an asynchronous API using transform streams to be as non-blocking as possible, but because zlib is cpu-bound, its artificially made asynchronous which ends up having problems with performance, high latency and memory usage due to the overhead, and memory fragmentation, especially with small chunks of data. (see [ws#1369](https://github.com/websockets/ws/issues/1369) and [node#8871](https://github.com/nodejs/node/issues/8871))

Node does however include all the necessary tools and functionality in its private and undocumented APIs, which this package makes use of to provide an easy way to synchronously process chunks in a shared zlib context.

## Usage

Usage is similar to any other synchronous compression library, compress a chunk, then decompress it elsewhere.

```js
let zlib = require("fast-zlib");

let deflate = zlib("deflate");
let inflate = zlib("inflate");

let data = "123456789";

let chunk1 = deflate(data);
// Buffer(17) [120, 156, 50, 52, 50, 54, 49, 53, 51, 183, 176, 4, 0, 0, 0, 255, 255]
// first chunk of data sets up the shared context

let chunk2 = deflate(data);
// Buffer(9) [50, 132, 49, 0, 0, 0, 0, 255, 255]
// shared context kicks in

let chunk3 = deflate(data);
// Buffer(8) [130, 51, 0, 0, 0, 0, 255, 255]
// and continues to apply to all subsequent chunks

let decoded1 = inflate(chunk1);
console.log(decoded1.toString()); // "123456789"

let decoded2 = inflate(chunk2);
console.log(decoded2.toString()); // "123456789"

let decoded3 = inflate(chunk3);
console.log(decoded3.toString()); // "123456789"
```

This package is essentially a function that returns a compressor or a decompressor function powered by zlib behind the scenes.

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

Compressors and decompressors accept any Buffer-compatible input (Buffer, TypedArray, DataView, ArrayBuffer, string) and return a Buffer.

```js
let data = gzip("wefwefwef");
console.log(data); // compressed buffer

let decompressed = unzip(data);
console.log(decompressed); // decompressed buffer
console.log(decompressed.toString()); // wefwefwef
```

Each zlib class can be passed an options object as per zlib's documentation - [https://nodejs.org/docs/latest-v12.x/api/zlib.html](https://nodejs.org/docs/latest-v12.x/api/zlib.html).

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
// all of zlib's constants are accessible from this package
let deflate = zlib("deflate", {
	flush: zlib.constants.Z_NO_FLUSH // set default flag to Z_NO_FLUSH
});
let inflate = zlib("inflate");

deflate("123");
deflate("456");
deflate("789");

let data = deflate("hij", zlib.constants.Z_SYNC_FLUSH);

let result = inflate(data);
console.log(result.toString()); // 123456789hij
```

The function's internal zlib instance is also exposed via a .zlib property for advanced usage.

```js
let deflate = zlib("deflate");
let deflate = zlib("inflate");

deflate("789", zlib.constants.Z_NO_FLUSH);

// here deflate.zlib is an instance of zlib.createDeflate() and we can use its internal methods
deflate.zlib.flush();
let data = deflate.zlib.read();

console.log(inflate(data).toString()); // 789
```

In shared context, decompression must be done in exactly the same order as compression because each chunk sequentially complements the previous and the next. Attempting to decode a chunk out of order will throw an error and reset the decompressor so it has to either restart from the beginning or you will have to destroy both and create a new compressor/decompressor pair.

```js
let chunk1 = deflate(data);
let chunk2 = deflate(data);

inflate(chunk2); // error
inflate(chunk1); // works
inflate(chunk2); // works
```

Flush flags can be used to achieve fine control over the process and even create checkpoints from where decompression can resume

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

console.log(inflate(data).toString()) // 123456789
console.log(inflate(data2).toString()) // abc789
console.log(inflate(data3).toString()) // zyx789

// we can restart the decompression sequence from a Z_FULL_FLUSH block at any time
console.log(inflate(data2).toString()) // abc789
console.log(inflate(data3).toString()) // xyz789
```

Brotli uses slightly different flush flags compared to deflate and gzip. Instead of `Z_NO_FLUSH` and `Z_SYNC_FLUSH`, its flags are `BROTLI_OPERATION_PROCESS` and `BROTLI_OPERATION_FLUSH`

```js
// default flag is zlib.BROTLI_OPERATION_FLUSH
let compress = zlib("brotliCompress");
let decompress = zlib("brotliDecompress");

let compressed = compress("abc");
console.log(decompress(compressed).toString()); // abc

compress("123",zlib.constants.BROTLI_OPERATION_PROCESS);
compress("456",zlib.constants.BROTLI_OPERATION_PROCESS);
let data = compress("789",zlib.constants.BROTLI_OPERATION_FLUSH);
console.log(decompress(data).toString()); // 123456789
```

When working with streams where fragmentation can occur (such as TCP streams) its a good idea to watch for zlib's delimiter and join chunks together. Decompression will still work with incomplete chunks but will return incomplete data that you will need to join yourself.

```js
stream.on("data", chunk => {
	if(chunk.length >= 4 && chunk.readUInt32BE(chunk.length - 4) === 0xffff) { // check if the chunk ends with 0,0,255,255
		let data = inflate(chunk, zlib.constants.Z_SYNC_FLUSH); // if it does, process it and continue
		console.log(data.toString())
	} else {
		inflate(chunk, zlib.constants.Z_NO_FLUSH); // otherwise add it to the internal buffer and wait for the next chunk
		return;
	}
});
```

## Benchmark

soon

## Unsafe Mode

This package contains an additional `Z_SYNC_FLUSH_UNSAFE` flag for maximum performance, but it can cause some issues if not used carefully. It cannot be used with deflate's Z_FULL_FLUSH, it does not append zlib's signature block delimiter (0,0,255,255), only accepts a Buffer as input, and reuses existing buffers when possible.

```js
let deflate = zlib("deflate");

let data = Buffer.from("123456789");

let chunkref = deflate(data, zlib.constants.Z_SYNC_FLUSH_UNSAFE); // Buffer(13) [120, 156, 50, 52, 50, 54, 49, 53, 51, 183, 176, 4, 8]
deflate(data, zlib.constants.Z_SYNC_FLUSH_UNSAFE); // Buffer(5) [32, 67, 24, 3, 32]

console.log(chunkref) // Buffer(13) [32, 67, 24, 3, 32, 54, 49, 53, 51, 183, 176, 4, 8]
// first 5 bytes overwritten by the second deflate call
// the second call writes to the existing buffer and returns a Buffer.subarray of it
```
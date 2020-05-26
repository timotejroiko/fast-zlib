# fast-zlib-sync

Or how to trick node's native zlib module into performing shared context compression synchronously.

Warning: This package uses node's undocumented private APIs which may change in future node.js versions without notice.

Method based on [isaacs/minizlib](https://github.com/isaacs/minizlib)

## Shared Context / Context Takeover

Shared context means that for each chunk of data that is compressed, some information about it is stored in the compressor so that the next chunk can be more efficiently compressed by reusing saved information. The decompressor will do the same thing, each decompressed chunk leaves some data behind to help it decode the next chunk.

Node's native zlib module does not offer a public API to perform this task synchronously and instead offers an asynchronous API using transform streams to be as non-blocking as possible, however because zlib is cpu-bound, its artificially made asynchronous which ends up having problems with performance, high latency and memory usage due to the overhead, and memory fragmentation, especially with small chunks of data. (see [ws#1369](https://github.com/websockets/ws/issues/1369) and [node#8871](https://github.com/nodejs/node/issues/8871))

Node does however include all the necessary tools and functionality in its private and undocumented APIs, which this package makes use of to provide an easy way to synchronously process chunks in a shared zlib context.

## Usage

Usage is similar to any other synchronous compression library, compress a chunk, then decompress it elsewhere.

```js
let zlib = require("fast-zlib-sync");

let deflate = zlib("deflate");
let inflate = zlib("inflate");

let data = "123456789";

let chunk1 = deflate(data); // Buffer(17) [120, 156, 50, 52, 50, 54, 49, 53, 51, 183, 176, 4, 0, 0, 0, 255, 255]  // first chunk of data sets up the shared context
let chunk2 = deflate(data); // Buffer(9) [50, 132, 49, 0, 0, 0, 0, 255, 255]  // shared context kicks in
let chunk3 = deflate(data); // Buffer(8) [130, 51, 0, 0, 0, 0, 255, 255]  // and continues to apply to all subsequent chunks

let decoded1 = inflate(chunk1);
console.log(decoded1.toString()) // "123456789"

let decoded2 = inflate(chunk2);
console.log(decoded2.toString()) // "123456789"

let decoded3 = inflate(chunk3);
console.log(decoded3.toString()) // "123456789"
```

## Docs

This package is essentially a function that returns a compressor or a decompressor function powered by zlib behind the scenes.

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
```

By default, compressors and decompressors accept any Buffer-compatible input (Buffer, TypedArray, DataView, ArrayBuffer, string) and return a Buffer.

```js
let data = gzip("wefwefwef");
console.log(data) // compressed buffer

let decompressed = unzip(data);
console.log(decompressed) // decompressed buffer
console.log(decompressed.toString()); // wefwefwef
```

Each zlib class can be passed an options object as per zlib's documentation - [https://nodejs.org/docs/latest-v12.x/api/zlib.html](https://nodejs.org/docs/latest-v12.x/api/zlib.html). Additionally, an extra **unsafe** option is available in this package.

If unsafe mode is enabled, only Buffers are accepted as input and the resulting Buffers are returned by reference instead of copy. This makes processing faster because it returns a reference of the value held inside the function instead of returning a copy of it, but the returned value must be immediately consumed, copied, transformed or dispatched, because next chunk will overwrite this value and update all references including those outside the function.

```js
let deflateRaw = zlib("deflateRaw", {
	chunkSize: 64 * 1024,
});
let inflateRaw = zlib("inflateRaw", {
	chunkSize: 64 * 1024,
	unsafe:true
});

let data = deflateRaw("abc");
let result = inflateRaw(data);
console.log(result.toString()) // abc

let data2 = deflateRaw("123");
let result2 = inflateRaw(data2);
console.log(result.toString()) // 123
console.log(result2.toString()) // 123
```

This library sets Z_SYNC_FLUSH as the default flush flag in order to process data immediately. For advanced usage and manual control of the compression process, zlib flags can be set as an option and also passed directly to the function.

```js
let deflate = zlib("deflate", {
	flush: zlib.Z_NO_FLUSH // set default flag to Z_NO_FLUSH. all of zlib's constants are accessible from this package
});
let inflate = zlib("inflate");

// when deflate is set to Z_NO_FLUSH, the very first compression will produce a header that must be passed to the decompressor
// this header doesnt exist in deflateRaw
let header = deflate("123");
deflate("456");
deflate("789");

let data = deflate("hij", zlib.Z_SYNC_FLUSH);

inflate(header);
let result = inflate(data);
console.log(result.toString()) // 123456789hij
```

The function's internal zlib instance is also exposed via a .zlib property for advanced usage.

```js
let deflate = zlib("deflate");
let deflate = zlib("inflate");

let header = deflate("789", zlib.Z_NO_FLUSH);
deflate("789", zlib.Z_NO_FLUSH);

// here deflate.zlib is an instance of zlib.createDeflate() and we can use its internal functions
deflate.zlib.flush();
let data = deflate.zlib.read();

inflate(header);
console.log(inflate(data).toString()); // 789789
```

Flush flags can be used to achieve fine control over the process and create checkpoints from where decompression can resume

```js
let deflate = zlib("deflateRaw");
let inflate = zlib("inflateRaw");

deflate("123", zlib.Z_NO_FLUSH); // there is no header in deflateRaw so we can skip it
deflate("456", zlib.Z_NO_FLUSH);
let data = deflate("789", zlib.Z_SYNC_FLUSH);
console.log(inflate(data).toString()) // 123456789

deflate("123");
deflate("456");
let data2 = deflate("789", zlib.Z_FULL_FLUSH); // Z_FULL_FLUSH creates a checkpoint from where the decompressor can restart
console.log(inflate(data2).toString()) // 123456789

let data3 = deflate("789", zlib.Z_SYNC_FLUSH);
console.log(inflate(data3).toString()) // 789

// we can restart the decompression sequence from a FULL_FLUSH block at any time
console.log(inflate(data2).toString()) // 123456789
console.log(inflate(data3).toString()) // 789
```

Zlib automatically appends all data chunks with 0,0,255,255 as a chunk delimiter but a custom Z_NO_APPEND flag can be used to prevent this. This flag works like Z_SYNC_FLUSH and since it does not append a delimiter it might increase performance, but it cannot be interchanged with Z_FULL_FLUSH and can introduce other unforeseen issues.

```js
let deflate = zlib("deflate");

let data = "123456789";

let chunk1 = deflate(data, zlib.Z_NO_APPEND); // Buffer(13) [120, 156, 50, 52, 50, 54, 49, 53, 51, 183, 176, 4, 8]
let chunk2 = deflate(data, zlib.Z_NO_APPEND); // Buffer(5) [32, 67, 24, 3, 32]
let chunk3 = deflate(data, zlib.Z_NO_APPEND); // Buffer(5) [128, 224, 12, 128, 0]
```

## Caveats

In shared context, decompression must be done in exactly the same order as compression because each chunk sequentially complements the previous and the next. Attempting to decode a chunk out of order will throw an error and reset the decompressor so it has to restart from the beginning or from the last checkpoint. Alternatively you can destroy both and create a new compressor/decompressor pair.

```js
let chunk1 = deflate(data)
let chunk2 = deflate(data)

inflate(chunk2) // error
inflate(chunk1) // works
inflate(chunk2) // works
```

When working with streams where fragmentation can occur (such as TCP streams) its a good idea to watch for zlib's delimiter and join chunks together. Decompression will still work with incomplete chunks but will return incomplete data that you will need to join yourself.

```js
stream.on("data", chunk => {
	let data;
	if(chunk.length >= 4 && chunk.readUInt32BE(chunk.length - 4) === 0xffff) { // check if the chunk ends with 0,0,255,255
		data = inflate(chunk, zlib.Z_SYNC_FLUSH); // if it does, process it and return the result
	} else {
		inflate(chunk, zlib.Z_NO_FLUSH); // otherwise add it to the internal buffer and wait for the next chunk
		return;
	}
	console.log(data.toString());
});
```

## Benchmark

soon
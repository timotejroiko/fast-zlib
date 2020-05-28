let zlib = require("zlib");
let methods = ["Inflate","Deflate","InflateRaw","DeflateRaw","Gzip","Gunzip","Unzip","BrotliDecompress","BrotliCompress"];

function lib(method,options = {}) {
	method = method.toString();
	method = method[0].toUpperCase() + method.substr(1);
	if(!methods.includes(method)) { throw new Error("invalid or unsupported zlib class"); }
	let brotli = method.startsWith("Brotli");
	let unsafe = options.flush === true;
	if(!Number.isInteger(options.flush)) { options.flush = brotli ? zlib.constants.BROTLI_OPERATION_FLUSH : zlib.constants.Z_SYNC_FLUSH; }
	let z = new zlib[method](options);
	let handle = z._handle;
	let handleClose = z._handle.close;
	let close = z.close;
	let buffer = [];
	let d = (data,f) => {
		if(!Number.isInteger(f) && f !== true) { f = z._defaultFlushFlag; }
		if(f!== true && !Buffer.isBuffer(data)) { data = Buffer.from(data); }
		z._handle.close = () => {};
		z.close = () => {};
		let result;
		let error;
		try {
			result = z._processChunk(data, f);
		} catch(e) {
			error = e;
		} finally {
			z._handle = handle;
			z._handle.close = handleClose;
			z.close = close;
			z.removeAllListeners("error");
			if(error) {
				z.reset();
				throw error;
			}
		}
		if(f !== true) {
			result = Buffer.from(result)
			if(f === (brotli ? zlib.constants.BROTLI_OPERATION_PROCESS : zlib.constants.Z_NO_FLUSH)) {
				if(result.length) {
					buffer.push(result);
					return Buffer.allocUnsafe(0);
				}
			} else if(buffer.length) {
				buffer.push(result);
				result = Buffer.concat(buffer);
				buffer = [];
			}
		}
		return result;
	}
	if(unsafe) { z._defaultFlushFlag = true; }
	d.zlib = z;
	return d;
}

lib.constants = zlib.constants;
lib.constants.Z_SYNC_FLUSH_UNSAFE = true;

module.exports = lib;
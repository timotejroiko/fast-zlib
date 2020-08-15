"use strict";

const zlib = require("zlib");
const methods = ["Inflate","Deflate","InflateRaw","DeflateRaw","Gzip","Gunzip","Unzip","BrotliDecompress","BrotliCompress"];

function lib(method,options = {}) {
	method = method.toString();
	method = method[0].toUpperCase() + method.substr(1);
	if(!methods.includes(method)) { throw new Error("invalid or unsupported zlib class"); }
	const brotli = method.startsWith("Brotli");
	const unsafe = options.flush === true;
	if(!Number.isInteger(options.flush)) { options.flush = brotli ? zlib.constants.BROTLI_OPERATION_FLUSH : zlib.constants.Z_SYNC_FLUSH; }
	const z = new zlib[method](options);
	const { close, _handle, _handle: { close:handleClose } } = z;
	let buffer = [];
	const d = (data,f) => {
		if(f !== true) {
			if(!Number.isInteger(f)) { f = z._defaultFlushFlag; }
			if(!Buffer.isBuffer(data)) { data = Buffer.from(data); }
		}
		z._handle.close = () => void 0;
		z.close = () => void 0;
		let result;
		let error;
		try {
			result = z._processChunk(data, f);
		} catch(e) {
			error = e;
		}
		z._handle = _handle;
		z._handle.close = handleClose;
		z.close = close;
		z.removeAllListeners("error");
		if(error) {
			z.reset();
			throw error;
		}
		if(f !== true) {
			result = Buffer.from(result);
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
	};
	if(unsafe) { z._defaultFlushFlag = true; }
	d._zlib = z;
	return d;
}

lib.constants = zlib.constants;
lib.constants.Z_SYNC_FLUSH_UNSAFE = true;

module.exports = lib;

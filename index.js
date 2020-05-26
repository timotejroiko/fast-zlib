let zlib = require("zlib");

function lib(method,options = {}) {
	method = method.toString();
	method = method[0].toUpperCase() + method.substr(1);
	if(!zlib[method]) { throw new Error("unknown or invalid zlib class"); }
	if(!Number.isInteger(options.flush)) { options.flush = zlib.Z_SYNC_FLUSH; }
	let z = new zlib[method](options);
	let handle = z._handle;
	let handleClose = z._handle.close;
	let close = z.close;
	let decomp = ["Inflate","InflateRaw","Unzip","Gunzip","BrotliDecompress"].includes(method);
	let buffer = []; // for some reason _processChunk ignores flush flags when decompressing, so we create our own flushing buffer
	let d = (data,f) => {
		if(!Buffer.isBuffer(data)) {
            if(!options.unsafe) { data = Buffer.from(data); }
            else { throw new Error("unsafe mode only accepts buffers"); }
        }
		if(!Number.isInteger(f) && f !== true) { f = z._defaultFlushFlag; }
		if(decomp && !f) { buffer.push(data); return Buffer.allocUnsafe(0); }
		if(buffer.length && f) { buffer.push(data); data = Buffer.concat(buffer); buffer = []; }
		z._handle.close = () => {};
		z.close = () => {};
		let result;
		try {
			result = z._processChunk(data, f);
		} catch(e) {} finally {
            if(z) {
                z._handle = handle;
                z._handle.close = handleClose;
                z.close = close;
                z.removeAllListeners("error");
            } else {
                throw new Error("zlib handle destroyed");
            }
		}
		if(!options.unsafe) {
			result = Buffer.from(result);
		}
		return result;
	}
	d.zlib = z;
	return d;
}

Object.assign(lib,zlib.constants,{Z_NO_APPEND:true});

module.exports = lib;
let zlib = require("zlib");

function lib(method,options = {}) {
	method = method.toString();
	method = method[0].toUpperCase() + method.substr(1);
	if(!zlib[method]) { throw new Error("unknown or invalid zlib class"); }
	if(!Number.isInteger(options.flush)) { options.flush = zlib.Z_SYNC_FLUSH; }
	let z = new zlib[method](options);
	let backups = [Buffer.concat,z._handle,z._handle.close,z.close];
	let d = (data,f) => {
		z._handle.close = () => {};
		z.close = () => {};
		Buffer.concat = a => a;
		let result;
		if(!Number.isInteger(f)) { f = z._defaultFlushFlag; }
		try {
			if(!Buffer.isBuffer(data)) {
				if(!options.unsafe) { data = Buffer.from(data); }
				else { throw new Error("unsafe z only accepts buffers"); }
			}
			result = z._processChunk(data, f);
			Buffer.concat = backups[0];
		} catch (e) {
			Buffer.concat = backups[0];
			throw e;
		} finally {
			if(z) {
				z._handle = backups[1];
				z._handle.close = backups[2];
				z.close = backups[3];
				z.removeAllListeners("error");
			} else {
				throw new Error("zlib handle destroyed");
			}
		}
		if(Array.isArray(result)) {
			result = Buffer.concat(result);
		}
		if(!options.unsafe) {
			result = Buffer.from(result)
		}
		return result;
	}
	d.zlib = z;
	return d;
}

Object.assign(lib,zlib.constants);

module.exports = lib;
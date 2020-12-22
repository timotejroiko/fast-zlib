"use strict";

const zlib = require("zlib");

class Base {
	constructor(type, options) {
		if(type.startsWith("Brotli")) {
			this._noFlushFlag = zlib.constants.BROTLI_OPERATION_PROCESS;
			if(!Number.isInteger(options.flush)) {
				options.flush = zlib.constants.BROTLI_OPERATION_FLUSH;
			}
		} else {
			this._noFlushFlag = zlib.constants.Z_NO_FLUSH;
			if(!Number.isInteger(options.flush)) {
				options.flush = zlib.constants.Z_SYNC_FLUSH;
			}
		}
		this._buffer = [];
		this.instance = new zlib[type](options);
	}
	process(data, flag) {
		let z = this.instance;
		let buffer = this._buffer;
		let nff = this._noFlushFlag;
		if(!Number.isInteger(flag)) { flag = z._defaultFlushFlag; }
		if(!Buffer.isBuffer(data)) { data = Buffer.from(data); }
		let c = z.close;
		let h = z._handle;
		let hc = z._handle.close;
		let result;
		let error;
		z.close = () => void 0;
		z._handle.close = () => void 0;
		try {
			result = z._processChunk(data, flag);
		} catch(e) {
			error = e;
		}
		z._handle = h;
		z._handle.close = hc;
		z.close = c;
		z.removeAllListeners("error");
		if(error) {
			z.reset();
			throw error;
		}
		result = Buffer.from(result);
		if(flag === nff) {
			if(result.length) {
				buffer.push(result);
				return Buffer.allocUnsafe(0);
			}
		} else if(buffer.length) {
			buffer.push(result);
			result = Buffer.concat(buffer);
			buffer = [];
		}
		return result;
	}
	close() {
		this.instance.close();
	}
}

exports.Inflate = class extends Base {
	constructor(options = {}) {
		super("Inflate", options);
	}
}

exports.Deflate = class extends Base {
	constructor(options = {}) {
		super("Deflate", options);
	}
}

exports.InflateRaw = class extends Base {
	constructor(options = {}) {
		super("InflateRaw", options);
	}
}

exports.DeflateRaw = class extends Base {
	constructor(options = {}) {
		super("DeflateRaw", options);
	}
}

exports.Gzip = class extends Base {
	constructor(options = {}) {
		super("Gzip", options);
	}
}

exports.Gunzip = class extends Base {
	constructor(options = {}) {
		super("Gunzip", options);
	}
}

exports.Unzip = class extends Base {
	constructor(options = {}) {
		super("Unzip", options);
	}
}

exports.BrotliCompress = class extends Base {
	constructor(options = {}) {
		super("BrotliCompress", options);
	}
}

exports.BrotliDecompress = class extends Base {
	constructor(options = {}) {
		super("BrotliDecompress", options);
	}
}

exports.constants = zlib.constants;

exports.default = exports;

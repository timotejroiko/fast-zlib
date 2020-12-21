"use strict";

const zlib = require("zlib");

function process(data, flag) {
	let z = this._zlib;
	let buffer = this._buffer;
	let nff = this._noFlushFlag;
	if(!Number.isInteger(flag)) { flag = z._defaultFlushFlag; }
	if(!Buffer.isBuffer(data)) { data = Buffer.from(data); }
	let c = z.close;
	let h = z._handle;
	let hc = z._handle.close;
	let result;
	let error;
	z.close = () => {};
	z._handle.close = () => {};
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

exports.Inflate = class {
	constructor(options = {}) {
		if(!Number.isInteger(options.flush)) { options.flush = zlib.constants.Z_SYNC_FLUSH; }
		this.instance = new zlib.Inflate(options);
		this.process = process.bind(this);
		this._buffer = [];
		this._noFlushFlag = zlib.constants.Z_NO_FLUSH;
	}
}

exports.Deflate = class {
	constructor(options = {}) {
		if(!Number.isInteger(options.flush)) { options.flush = zlib.constants.Z_SYNC_FLUSH; }
		this.instance = new zlib.Deflate(options);
		this.process = process.bind(this);
		this._buffer = [];
		this._noFlushFlag = zlib.constants.Z_NO_FLUSH;
	}
}

exports.InflateRaw = class {
	constructor(options = {}) {
		if(!Number.isInteger(options.flush)) { options.flush = zlib.constants.Z_SYNC_FLUSH; }
		this.instance = new zlib.InflateRaw(options);
		this.process = process.bind(this);
		this._buffer = [];
		this._noFlushFlag = zlib.constants.Z_NO_FLUSH;
	}
}

exports.DeflateRaw = class {
	constructor(options = {}) {
		if(!Number.isInteger(options.flush)) { options.flush = zlib.constants.Z_SYNC_FLUSH; }
		this.instance = new zlib.DeflateRaw(options);
		this.process = process.bind(this);
		this._buffer = [];
		this._noFlushFlag = zlib.constants.Z_NO_FLUSH;
	}
}

exports.Gzip = class {
	constructor(options = {}) {
		if(!Number.isInteger(options.flush)) { options.flush = zlib.constants.Z_SYNC_FLUSH; }
		this.instance = new zlib.Gzip(options);
		this.process = process.bind(this);
		this._buffer = [];
		this._noFlushFlag = zlib.constants.Z_NO_FLUSH;
	}
}

exports.Gunzip = class {
	constructor(options = {}) {
		if(!Number.isInteger(options.flush)) { options.flush = zlib.constants.Z_SYNC_FLUSH; }
		this.instance = new zlib.Gunzip(options);
		this.process = process.bind(this);
		this._buffer = [];
		this._noFlushFlag = zlib.constants.Z_NO_FLUSH;
	}
}

exports.Unzip = class {
	constructor(options = {}) {
		if(!Number.isInteger(options.flush)) { options.flush = zlib.constants.Z_SYNC_FLUSH; }
		this.instance = new zlib.Unzip(options);
		this.process = process.bind(this);
		this._buffer = [];
		this._noFlushFlag = zlib.constants.Z_NO_FLUSH;
	}
}

exports.BrotliCompress = class {
	constructor(options = {}) {
		if(!Number.isInteger(options.flush)) { options.flush = zlib.constants.BROTLI_OPERATION_FLUSH; }
		this.instance = new zlib.BrotliCompress(options);
		this.process = process.bind(this);
		this._buffer = [];
		this._noFlushFlag = zlib.constants.BROTLI_OPERATION_PROCESS;
	}
}

exports.BrotliDecompress = class {
	constructor(options = {}) {
		if(!Number.isInteger(options.flush)) { options.flush = zlib.constants.BROTLI_OPERATION_FLUSH; }
		this.instance = new zlib.BrotliDecompress(options);
		this.process = process.bind(this);
		this._buffer = [];
		this._noFlushFlag = zlib.constants.BROTLI_OPERATION_PROCESS;
	}
}

exports.constants = zlib.constants;

exports.default = exports;

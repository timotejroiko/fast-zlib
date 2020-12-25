"use strict";

const zlib = require("./index.js");
const randomStrings = new Array(10).fill().map(() => Math.random().toString(36) + Math.random().toString(36));
const methods = [["Deflate", "Inflate"], ["DeflateRaw", "InflateRaw"], ["Gzip", "Gunzip"], ["Gzip", "Unzip"], ["BrotliCompress", "BrotliDecompress"]];

for(const method of methods) {
	console.log(`testing ${method.join("/")}`);
	const instance = new zlib[method[0]]();
	const instance2 = new zlib[method[1]]();
	const results = [];
	for(const string of randomStrings) {
		const compressed = instance.process(string);
		results.push(compressed);
	}
	let returned = [];
	for(const data of results) {
		const decompressed = instance2.process(data);
		returned.push(decompressed.toString());
	}
	if(returned.join("") !== randomStrings.join("")) { throw new Error(`failed test for ${method.join("/")}`); }
	for(const string of randomStrings) {
		instance.process(string, zlib.constants.Z_NO_FLUSH);
	}
	returned = instance2.process(instance.process(""));
	if(returned.toString() !== randomStrings.join("")) { throw new Error(`failed test for ${method.join("/")}`); }
}

console.log("all tests passed");

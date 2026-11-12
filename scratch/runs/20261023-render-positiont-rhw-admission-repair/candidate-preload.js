'use strict';
const path=require('path'),fs=require('fs'),crypto=require('crypto'),assert=require('assert');
const candidate=path.join(__dirname,'candidate-shader-ir.js');
assert.strictEqual(crypto.createHash('sha256').update(fs.readFileSync(candidate)).digest('hex'),'7f6cbc38cef7085cc0b9df1aed0648f680fa3195f66fcedbc485c51707286e83');
const local=require.resolve('../../../lib/d3d-shader-ir');require(local);require.cache[local].exports=require(candidate);
console.log('EXACT previous candidate JS producer, blob 365ca83bc8d917e286f6f1d8c094af76b1f90904');

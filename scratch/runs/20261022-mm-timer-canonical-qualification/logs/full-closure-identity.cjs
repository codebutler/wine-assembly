'use strict';
const fs=require('fs'),crypto=require('crypto'),assert=require('assert'),path=require('path');
const root=process.cwd(),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const bytes=require(path.join(root,'test/compile-src')).compileSrcWasm();
const {appendSection}=require(path.join(root,'tools/region-layout-hash'));
const layout=require(path.join(root,'lib/region-map.generated')).LAYOUT_HASH;
const stamped=appendSection(bytes,layout),shipping=fs.readFileSync('build/wine-assembly.wasm');
assert.deepStrictEqual(stamped,shipping);
console.log(JSON.stringify({result:'PASS',assertions:1,rawTestCompilerSha256:sha(bytes),shippingSha256:sha(shipping),rawBytes:bytes.length,shippingBytes:shipping.length,layout,explanation:'Exact byte equality after the same appendSection layout metadata step used by tools/build-compile-wat.js; no executable section changes.'}));

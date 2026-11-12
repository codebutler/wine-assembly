'use strict';
// Exercise the actual synchronous host boundary without compiling a module.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../..');
const {createHostImports} = require(path.join(root, 'lib/host-imports'));
const api = require(path.join(root, 'src/api_table.json'));
const memory = new WebAssembly.Memory({initial: 1});
function make(table=api) {
  return createHostImports({getMemory: () => memory.buffer, renderer: null,
    resourceJson: {}, apiTable: table}).host;
}
function lookup(host, dll, ordinal) {
  new Uint8Array(memory.buffer).set(Buffer.from(dll+'\0'), 0x100);
  return host.resolve_ordinal(0x100, ordinal);
}
const host=make();
assert.strictEqual(lookup(host, 'OLEAUT32.dll', 8), api.find(r => r.name==='VariantInit').id);
assert.strictEqual(lookup(host, 'oleaut32.DLL', 8), api.find(r => r.name==='VariantInit').id);
for (const ordinal of [0,151,65535]) assert.strictEqual(lookup(host,'OLEAUT32.dll',ordinal),-1);
assert.strictEqual(lookup(host,'DefinitelyAbsent.dll',8),-1);
assert.strictEqual(lookup(make(api.filter(r => r.name!=='VariantInit')),'OLEAUT32.dll',8),-1,
  'a missing real handler cannot be replaced by a fabricated API id');
const {scanSources,check}=require(path.join(root,'tools/callback-ownership-census'));
const reviewed=require(path.join(root,'tools/callback-ownership-census.json'));
const changed=fs.readFileSync(path.join(root,'lib/host-imports.js'),'utf8')
  .replace("'OLEAUT32.DLL#8': 'VariantInit'", "'OLEAUT32.DLL#8': 'VariantClear'");
assert.notStrictEqual(changed,fs.readFileSync(path.join(root,'lib/host-imports.js'),'utf8'));
const watSources=fs.readdirSync(path.join(root,'src')).filter(n=>/\.watx?$/.test(n))
 .map(n=>({file:'src/'+n,src:fs.readFileSync(path.join(root,'src',n),'utf8')}));
const entries=scanSources([...watSources,{file:'lib/host-imports.js',src:changed}])
 .filter(r=>r.file==='lib/host-imports.js');
const one=reviewed.entries.filter(r=>r.file==='lib/host-imports.js');
assert.deepStrictEqual(check(entries,{version:1,entries:one}),
 ['changed producer lib/host-imports.js:host-file (sha256); review its lifetime']);
console.log('PASS actual host ordinal8 identity/handler selection; unknown/missing-handler controls and VariantClear producer mutation reject; no WAT compilation or guest execution');

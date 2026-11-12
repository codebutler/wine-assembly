'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { canonicalNeName, prepareNeSources } = require('../lib/ne-sources');
const { NeLoadError } = require('../lib/ne-load-error');
const { neLifecycleImage } = require('./helpers/ne-lifecycle-image');
const { neFixedBuiltinId } = require('../lib/ne-image');

// JS import ownership must use the dispatcher's actual fixed identities.
const nativeIds=fs.readFileSync(path.join(__dirname,'../src/08c-ne-loader.wat'),'utf8');
for(const [name,id] of Object.entries({KERNEL:1,USER:2,GDI:3,KEYBOARD:4,SOUND:5,
  SHELL:6,MMSYSTEM:7,COMMDLG:8,DDEML:10,NDDEAPI:11,WIN87EM:12})) {
  assert.equal(neFixedBuiltinId(name),id);
  assert.match(nativeIds,new RegExp('WIN16_NAME_'+name+'\\)\\)\\s+\\(then \\(return \\(i32.const '+id+'\\)'));
}
for(const name of ['CARDS','TOOLHELP','CUSTOM',''])assert.equal(neFixedBuiltinId(name),0);

for (const name of ['demo', 'DEMO.DLL', 'C:\\Outlaws\\Demo.dll', 'c:/outlaws/demo.DLL', 'C:DEMO.DLL'])
  assert.equal(canonicalNeName(name), 'DEMO');
for (const name of ['', 'a\0.dll', 'x.exe', '../', 'abcdefghijklmnop.dll'])
  assert.throws(() => canonicalNeName(name));

const root = neLifecycleImage({importEntry: {module: 'HELPER', symbol: 'VALUE'}});
const helper = neLifecycleImage({dependencies: ['KERNEL']});
const files = new Map([['demo.dll', root], ['helper.dll', helper]]), requests = [];
const prepared = prepareNeSources('C:\\Outlaws\\Demo.dll', (file, full) => {
  requests.push([file, full]); return files.get(file);
});
assert.equal(prepared.name, 'DEMO');
assert.deepEqual([...prepared.sources.keys()], ['DEMO', 'HELPER']);
assert.deepEqual(requests, [['demo.dll', 'C:\\Outlaws\\Demo.dll'], ['helper.dll', 'C:\\Outlaws\\helper.dll']]);
root.fill(0); helper.fill(0);
assert.equal(prepared.sources.get('DEMO')[0], 0x4d, 'source snapshot survives VFS mutation');
assert.equal(prepared.sources.get('HELPER')[0], 0x4d);
const relative=[];
prepareNeSources('C:DEMO',(file,full)=>{relative.push(full);return neLifecycleImage();});
assert.deepEqual(relative,['C:DEMO.dll'],'drive-relative bare name receives DLL extension before VFS lookup');

assert.throws(() => prepareNeSources('missing', () => null), e => e instanceof NeLoadError && e.guestCode === 2);
assert.throws(() => prepareNeSources('bad', () => new Uint8Array(2)), e => e instanceof NeLoadError && e.guestCode === 11);
assert.throws(() => prepareNeSources('async', () => Promise.resolve(null)), /owned settlement/);
const ioFailure = Error('VFS unavailable');
assert.throws(() => prepareNeSources('io', () => { throw ioFailure; }), e => e === ioFailure);
const missingImport = neLifecycleImage({importEntry: {module: 'HELPER', symbol: 'ABSENT'}});
assert.throws(() => prepareNeSources('demo', file => file === 'demo.dll' ? missingImport : neLifecycleImage()),
  e => e instanceof NeLoadError && e.guestCode === null);
assert.throws(() => prepareNeSources('demo', () => neLifecycleImage({dependencies: ['DEMO']})), /recursive/);
const unsupported = neLifecycleImage(); unsupported.writeUInt16LE(0x400, 0x80 + 0x3e);
assert.throws(() => prepareNeSources('demo', () => unsupported), e => !(e instanceof NeLoadError) && /not implemented/.test(e.message));

// Builtins have dispatcher identities, not files. An unknown ordinal must
// remain admissible to the existing fail-fast dispatcher; CARDS is an image.
for (const module of ['KERNEL','USER','GDI','KEYBOARD','SOUND','SHELL','MMSYSTEM',
  'COMMDLG','DDEML','NDDEAPI','WIN87EM','TOOLHELP','VER','AVIFILE','MSVIDEO','DISPLAY','LZEXPAND']) {
  for (const symbol of [65535, 'UNKNOWN_EXPORT']) {
    const requests=[];
    const prepare=()=>prepareNeSources('demo', name=>{
      requests.push(name);
      assert.equal(name,'demo.dll','builtin must not consult or load a supplied image');
      return neLifecycleImage({importEntry:{module,symbol}});
    });
    if(typeof symbol==='string')assert.throws(prepare,/importer-owned name resolution/);
    else assert.deepEqual([...prepare().sources.keys()],['DEMO']);
    assert.deepEqual(requests,['demo.dll']);
  }
}
for (const module of ['CARDS','CUSTOM']) {
  const requests=[];
  assert.throws(()=>prepareNeSources('demo',name=>{
    requests.push(name);
    return name==='demo.dll'?neLifecycleImage({dependencies:[module]}):null;
  }),e=>e instanceof NeLoadError && e.guestCode===2);
  assert.deepEqual(requests,['demo.dll',module.toLowerCase()+'.dll']);
}

// Classic-script consumers share a lexical global scope: loading each file
// separately also catches accidental duplicate top-level declarations.
const browser = vm.createContext({Uint8Array, DataView, Map, Set});
for (const file of ['ne-load-error', 'ne-image', 'ne-invoke', 'ne-lifecycle', 'ne-sources'])
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../lib', file + '.js'), 'utf8'), browser, {filename: file});
assert.equal(browser.NeSources.canonicalNeName('C:\\DEMO.DLL'), 'DEMO');
assert.equal(typeof browser.NeLifecycle.createNeLifecycle, 'function');
assert.equal(browser.NeSources.prepareNeSources('demo', () => neLifecycleImage()).sources.size, 1);
console.log('PASS NE source closure: VFS paths, immutable copies, typed failures, cycles, unsupported waits and classic scripts');

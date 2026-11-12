'use strict';
// Cheap integration checks only: no fixture/compiler imports or WASM execution.
const assert = require('node:assert/strict');
const fs = require('node:fs'), cp = require('node:child_process');
const root = process.cwd();
const boot = require(root+'/lib/process-boot');
const registry = require(root+'/lib/dll-registry');
const {buildVersionBlob,buildVersionPe,findVersionBlob} = require(root+'/tools/pe-version');
const {sourceFunction} = require(root+'/test/wat-source-function');
assert(registry.isLoadableDll('DSETUP.DLL'));
assert.equal(registry.dllPath('dsetup.dll'), null);
const files = ['DDRAW.DLL','DSOUND.DLL','DPLAYX.DLL','D3DRM.DLL','D3D8.DLL'];
for (const name of files) {
  const key='c:\\windows\\system\\'+name.toLowerCase();
  const original={data:buildVersionPe(buildVersionBlob([0xFEEF04BD,0x10000,0x00040006,0x00030206])),attrs:0x20};
  const vfs={files:new Map([[key,original]])};
  boot.mountDirectXSystemModules(vfs);
  assert.equal(vfs.files.get(key),original);
  original.staticModule=true;
  boot.mountDirectXSystemModules(vfs);
  const placeholder=vfs.files.get(key);
  assert.notEqual(placeholder,original);
  assert.equal(findVersionBlob(Buffer.from(placeholder.data)),null);
  assert.equal(boot.findVfsDllBytes(vfs,name,name),null);
  assert.equal(boot.mountDirectXSystemModules(vfs),0);
}
const before=cp.execFileSync('git',['show','89f1e9d2c67aa94d56d2319115589d07204d42e0:src/09a1-comctl-handlers.wat'],{encoding:'utf8'});
const after=fs.readFileSync('src/09a1-comctl-handlers.wat','utf8');
for(const name of ['file_version_resource','file_version_info_size_named','file_version_info_named','handle_GetFileVersionInfoSizeW','handle_GetFileVersionInfoW'])
  assert.equal(sourceFunction(after,name),sourceFunction(before,name));
const old=JSON.parse(cp.execFileSync('git',['show','89f1e9d2:tools/callback-ownership-census.json'],{encoding:'utf8'}));
const next=JSON.parse(fs.readFileSync('tools/callback-ownership-census.json'));
assert.equal(old.entries.length,407);assert.equal(next.entries.length,407);
const changed=[];
old.entries.forEach((row,i)=>{
  const now=next.entries[i];
  if(JSON.stringify(row)!==JSON.stringify(now)) {
    const fields=Object.keys({...row,...now}).filter(k=>JSON.stringify(row[k])!==JSON.stringify(now[k])).sort();
    assert.deepEqual(fields,['reason','sha256']);
    assert.equal(now.ownership,'pending');assert.equal(now.kind,'host-entry');
    assert(now.reason.startsWith(row.reason));changed.push(row.file);
  }
});
assert.deepEqual(changed,['lib/process-boot.js','lib/storage.js']);
console.log('PASS five supplied files preserved, marked placeholders refreshed without versions/native bytes, idempotence, DSETUP policy, unchanged VERSION helpers/W handlers, exactly two census seals with pending ownership');

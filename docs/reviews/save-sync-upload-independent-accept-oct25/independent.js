'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const {test} = require('node:test');
const repo = process.env.ACCEPT_REPO || '/tmp/save-sync-upload-independent-accept-oct25/repo';
const source = process.env.ACCEPT_SOURCE;
const filename = path.join(repo,'lib/save-sync.js');
if (source) {
 const m = new Module(filename); m.filename=filename; m.paths=Module._nodeModulePaths(path.dirname(filename));
 m._compile(fs.readFileSync(source,'utf8'),filename); require.cache[filename]=m;
}
const sync = require(filename);
const sb = require(path.join(repo,'lib/save-bundle.js'));
const {VirtualFS} = require(path.join(repo,'lib/filesystem.js'));
const appId='independent_upload';
const make = (day='20', id=appId) => sb.exportBundle({appId:id,vfs:new VirtualFS(),patterns:[],store:{},createdAt:`2026-10-${day}T00:00:00Z`});
const ok={status:200,ok:true}, missing={status:404,ok:false};
const equal=(a,b)=>assert.ok(a.length===b.length&&a.every((v,i)=>v===b[i]),'full invocation bytes preserved');
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
for(const method of ['push','sync']) {
 for(const kind of ['Uint8Array','subarray','Buffer']) {
  test(`${method} ${kind}: validator mutates caller before reading snapshot`, async()=>{
   const expected=make();
   const backing=kind==='Buffer'?Buffer.alloc(expected.length+16):new Uint8Array(expected.length+16);
   const caller=kind==='Uint8Array'?expected.slice():backing.subarray(7,7+expected.length);
   caller.set(expected);
   let verified, sent, count=0;
   const result=await sync[method]({appId,bundle:caller,saveBundle:{readBundle(bytes,options){
    count++; verified=bytes; caller.fill(0); return sb.readBundle(bytes,options);
   }},fetchImpl:async(url,init)=>{
    if(url.endsWith('/metadata'))return missing;
    sent=init.body;equal(sent,expected);assert.equal(sent,verified,'upload uses exact validated object');
    assert.notEqual(sent.buffer,caller.buffer,'no caller storage alias');return ok;
   }});
   assert.equal(count,1);assert.ok(sent); if(method==='sync')assert.equal(result.action,'pushed');
  });
 }
 test(`${method}: validator reenters push without cross-invocation state`,async()=>{
  const original=make('20'), expected=original.slice(), nested=make('21'), nestedExpected=nested.slice();
  const writes=[];let nestedPending;let outerValidated;
  const fetchImpl=async(url,init)=>{if(url.endsWith('/metadata'))return missing;writes.push(init.body);return ok;};
  await sync[method]({appId,bundle:original,fetchImpl,saveBundle:{readBundle(bytes,options){
   outerValidated=bytes;
   nestedPending=sync.push({appId,bundle:nested,fetchImpl});nested.fill(0);original.fill(0);
   return sb.readBundle(bytes,options);
  }}});
  await nestedPending;assert.equal(writes.length,2);equal(writes[0],nestedExpected);equal(writes[1],expected);
  assert.equal(writes[1],outerValidated);assert.notEqual(writes[0],writes[1]);
 });
}
test('sync: supported validation option getter mutates caller before parser reads',async()=>{
 const caller=make(), expected=caller.slice();let reads=0,sent;
 await sync.sync({appId,bundle:caller,get maxBundleBytes(){reads++;caller.fill(0);return 16*1024*1024;},fetchImpl:async(url,init)=>{
  if(url.endsWith('/metadata'))return missing;sent=init.body;return ok;
 }});
 assert.equal(reads,1);equal(sent,expected);
});
test('sync: deferred pull body and transport retain same local validated buffer',async()=>{
 const caller=Buffer.from(make('20')),expected=Uint8Array.from(caller), remote=make('10');
 const bodyGate=gate(), started=gate(), uploadGate=gate(), uploading=gate();let validated, validations=0,sent;
 const pending=sync.sync({appId,bundle:caller,saveBundle:{readBundle(b,o){if(++validations===1)validated=b;return sb.readBundle(b,o);}},fetchImpl:async(url,init)=>{
  if(url.endsWith('/metadata'))return {...ok,text:async()=>'{"updatedAt":"2099-server"}'};
  if(init.method==='GET')return {...ok,arrayBuffer:async()=>{started.resolve();await bodyGate.promise;return remote.buffer;}};
  assert.equal(init.body,validated);uploading.resolve();await uploadGate.promise;sent=Uint8Array.from(init.body);return ok;
 }});
 await started.promise;caller.set(make('01'));bodyGate.resolve();
 // If a policy regression avoids uploading, settle and reject rather than hang.
 await Promise.race([uploading.promise,pending.then(()=>assert.fail('expected upload'))]);
 caller.fill(255);uploadGate.resolve();const result=await pending;
 equal(sent,expected);assert.equal(validations,2);assert.equal(result.action,'pushed');assert.equal(result.updatedAt,'2099-server');
});
test('invalid initial bytes, wrong app, and validator rejection issue zero requests',async()=>{
 for(const method of ['push','sync'])for(const kind of ['invalid','wrong-app','hook-reject']){
  const expected=make(), caller=kind==='invalid'?new Uint8Array(expected.length):kind==='wrong-app'?make('20','unrelated_app'):expected.slice();let requests=0;
  const pending=sync[method]({appId,bundle:caller,saveBundle:kind==='hook-reject'?{readBundle(){caller.set(expected);throw Error('validator-reject');}}:sb,fetchImpl:async()=>{requests++;return missing;}});
  caller.set(expected.subarray(0,caller.length));await assert.rejects(pending);assert.equal(requests,0);
 }
});
test('no local bundle validates nothing; remote capture time decides and identity errors survive',async()=>{
 let n=0;
 assert.equal((await sync.sync({appId,saveBundle:{readBundle(){throw Error('unexpected local validation');}},fetchImpl:async()=>{n++;return missing;}})).action,'none');assert.equal(n,1);
 for(const day of ['20','21']){
  let writes=0;const remote=make(day);
  const result=await sync.sync({appId,bundle:make('20'),fetchImpl:async(url,init)=>{
   if(init.method!=='GET'){writes++;return ok;}
   return url.endsWith('/metadata')?{...ok,text:async()=>'{"updatedAt":"1900"}'}:{...ok,arrayBuffer:async()=>remote.buffer};
  }});assert.equal(result.action,day==='20'?'in-sync':'pulled');assert.equal(writes,0);
 }
 for(const status of [401,500])await assert.rejects(sync.push({appId,bundle:make(),endpoint:'https://unit.invalid',method:'PUT',fetchImpl:async(url,init)=>{
  assert.equal(url,'https://unit.invalid/api/data/wine-saves-independent_upload');assert.equal(init.method,'PUT');assert.equal(init.credentials,'same-origin');return {status,ok:false};
 }}),e=>status===401?e.authRequired&&e.loginUrl==='https://unit.invalid/api/auth/login':/500/.test(e.message));
});
test('push and sync upload timeouts abort stalled injected transport and clear deadlines',async()=>{
 const realSet=global.setTimeout,realClear=global.clearTimeout;
 const timers=new Map();let next=0;
 global.setTimeout=(fn,ms)=>{assert.equal(ms,17);timers.set(++next,fn);return next;};
 global.clearTimeout=id=>timers.delete(id);
 try{
  for(const method of ['push','sync']){
   let signal,writes=0;
   await assert.rejects(sync[method]({appId,bundle:make(),timeoutMs:17,fetchImpl:async(url,init)=>{
    if(url.endsWith('/metadata'))return missing;
    writes++;signal=init.signal;
    queueMicrotask(()=>{assert.equal(timers.size,1);for(const fn of timers.values())fn();});
    return new Promise(()=>{});
   }}),e=>e.name==='TimeoutError'&&/17ms/.test(e.message));
   assert.equal(writes,1);assert.equal(signal.aborted,true);assert.equal(timers.size,0);
  }
 }finally{global.setTimeout=realSet;global.clearTimeout=realClear;}
});

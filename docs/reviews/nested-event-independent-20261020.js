#!/usr/bin/env node
'use strict';
// Independent production-provider/scheduler oracles. No production edits.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const Module = require('module');
const root = path.resolve(__dirname, '../..');
const manager = path.join(root, 'lib/thread-manager.js');
const baseline = process.argv.includes('--baseline');
if (baseline) {
  const mod = new Module(manager, module);
  mod.filename = manager; mod.paths = Module._nodeModulePaths(path.dirname(manager));
  mod._compile(cp.execFileSync('git', ['-C', root, 'show',
    'c9e03eb6e40481f6bb570a89f96b856a9a1d5e83:lib/thread-manager.js'], {encoding:'utf8'}), manager);
  require.cache[manager] = mod;
}
const {ThreadManager} = require(manager);
const {readSyncObjectName} = require(path.join(root, 'lib/mem-utils'));
const cli = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
const begin = cli.indexOf('  const win32ThreadId = () => threadManager.currentWin32ThreadId();');
const end = cli.indexOf('  // Check if a DLL file exists', begin);
assert(begin > 0 && end > begin);
const imports = new Function('h','threadManager','memory','readSyncObjectName','ctx', cli.slice(begin,end));
// Tiny actual Wasm callback and sibling dispatch; exported register/lifecycle
// getters and thread registration below are explicit fixtures, not a full VM.
const siblingModule = new WebAssembly.Module(Uint8Array.from([
  0,97,115,109,1,0,0,0,1,8,2,96,0,0,96,1,127,0,
  2,12,1,1,104,6,115,105,103,110,97,108,0,0,3,2,1,1,
  7,7,1,3,114,117,110,0,1,10,6,1,4,0,16,0,11]));
const callbackModule = new WebAssembly.Module(Uint8Array.from([
  0,97,115,109,1,0,0,0,1,5,1,96,0,1,127,
  2,10,1,1,104,4,119,97,105,116,0,0,3,2,1,0,
  7,7,1,3,114,117,110,0,1,10,6,1,4,0,16,0,11]));
function fixture() {
  const memory = new WebAssembly.Memory({initial:2, maximum:2, shared:true});
  const tm = new ThreadManager({}, memory, {exports:{get_sync_table:()=>0}}, ()=>({host:{}}));
  const h={}, logs=[], slices=[];
  tm._log = x=>logs.push(x);
  imports(h,tm,memory,readSyncObjectName,{exports:{get_sync_msg_depth:()=>1}});
  const event=h.create_event(0,0,0,0);
  const runSlice=tm.runSlice;
  tm.runSlice=function(...args) {const r=runSlice.apply(this,args); slices.push({...r}); return r;};
  const callback=new WebAssembly.Instance(callbackModule,{h:{wait:()=>h.wait_single(event,-1)}}).exports.run;
  function add(action, {cold=false,suspended=0}={}) {
    const tid=tm.threads.size+1, handle=0xe1000+tid;
    let runs=0;
    const inst=new WebAssembly.Instance(siblingModule,{h:{signal:()=>{
      runs++; assert.strictEqual(tm._runningThreadHandle,handle); action();
    }}});
    const e={memory,run:inst.exports.run,get_sync_table:()=>0,
      get_dll_callback_lock:()=>65536,get_dll_callback_owner:()=>tid+1,
      get_dll_lifecycle_table:()=>65600,get_dll_lifecycle_stride:()=>60,
      get_dll_table:()=>66000,get_dll_count:()=>0,
      dll_load_lock_begin:()=>{},dll_load_lock_release_once:()=>{},
      get_eip:()=>0x401000,get_yield_reason:()=>0,get_sleep_yielded:()=>0};
    const t={tid,state:'active',suspendCount:suspended,sleepCount:0,
      sleepUntil:0,waitPolls:0,instance:{exports:e}};
    if (!cold) t._dllAttachNotified=true;
    tm.threads.set(handle,t);
    return {t,e,handle,runs:()=>runs};
  }
  return {tm,h,event,callback,add,logs,slices,memory};
}
const results=[];
function record(name, fn) {results.push({name,...fn()});}
for (const reuse of [false,true]) record(reuse?'close-and-reuse':'close-during-pump',()=>{
  const f=fixture(); let replacement=0, closed=false;
  const slot=f.tm._getSyncIdx(f.event);
  const sibling=f.add(()=>{
    if(closed)return;
    assert.strictEqual(f.h.close_event(f.event),1); closed=true;
    if(reuse) {
      replacement=f.h.create_event(0,0,0,0);
      assert.notStrictEqual(replacement,f.event);
      assert.strictEqual(f.tm._getSyncIdx(replacement),slot);
    }
  });
  const actual=f.callback()>>>0;
  assert.strictEqual(actual,baseline?0xffffffff:0,'exact observed regression');
  assert.strictEqual(closed,!baseline);
  if(replacement) assert.strictEqual(f.h.wait_single(replacement,0),0x102);
  assert.strictEqual(f.tm._runningThreadHandle||0,0);
  assert.deepStrictEqual(f.logs,[]);
  return {actual,expectedNoFalseSuccess:actual!==0,runs:sibling.runs(),replacement};
});
record('already-invalid-is-inherited',()=>{
  const f=fixture(); f.h.close_event(f.event);
  const actual=f.callback()>>>0; assert.strictEqual(actual,0);
  return {actual,inherited:true};
});
if (!baseline) {
  record('three-active-siblings-and-nested-ownership',()=>{
    const f=fixture(); let ownerChecks=0;
    const other=f.h.create_event(0,0,0,0);
    const a=f.add(()=>{assert.strictEqual(f.h.wait_single(other,-1)>>>0,0xffffffff);ownerChecks++;});
    const b=f.add(()=>{});
    const c=f.add(()=>assert.strictEqual(f.h.set_event(f.event),1));
    assert.strictEqual(f.callback(),0); assert(a.runs()>0&&b.runs()>0&&c.runs()>0);
    assert.deepStrictEqual(f.logs,[]); assert.strictEqual(f.tm._runningThreadHandle,0);
    return {ownerChecks,runs:[a.runs(),b.runs(),c.runs()],steps:f.slices.map(s=>s.steps)};
  });
  record('nonproducer-real-scheduler-budget',()=>{
    const f=fixture(); const siblings=[f.add(()=>{}),f.add(()=>{}),f.add(()=>{})];
    assert.strictEqual(f.callback()>>>0,0xffffffff);
    const steps=f.slices.reduce((n,s)=>n+s.steps,0);
    assert(steps>=67108864 && steps<67408864);
    assert(f.slices.every(s=>s.steps>0 && s.steps<=300000));
    return {steps,slices:f.slices.length,runs:siblings.map(s=>s.runs())};
  });
  record('cold-empty-DLL-and-zero-measured-blocks',()=>{
    const f=fixture(); const s=f.add(()=>f.h.set_event(f.event),{cold:true});
    assert.strictEqual(f.callback(),0); assert(s.t._dllAttachNotified);
    assert(f.slices.every(s=>s.blocks===0)); assert(f.slices.some(s=>s.steps>0));
    assert.deepStrictEqual(Array.from(new Int32Array(f.memory.buffer,65536,2)),[0,0]);
    return {runs:s.runs(),steps:f.slices.map(s=>s.steps),blocks:f.slices.map(s=>s.blocks)};
  });
  record('cold-attach-created-with-zero-steps',()=>{
    const f=fixture(); const s=f.add(()=>f.h.set_event(f.event),{cold:true});
    // Actual scheduler suppression of a render-send target is downstream of
    // beginDllThreadNotification. This creates attach work but executes no run.
    f.tm._renderSendTargets.add(s.e);
    assert.strictEqual(f.callback()>>>0,0xffffffff);
    assert(s.t._dllAttachOperation); assert.strictEqual(s.runs(),0);
    assert.strictEqual(f.slices.length,1); assert.strictEqual(f.slices[0].steps,0);
    f.tm._renderSendTargets.delete(s.e);
    assert.strictEqual(f.callback(),0);
    return {initialSteps:0,attachCreated:true,afterReleaseRuns:s.runs()};
  });
  record('suspended-and-finite-unchanged',()=>{
    const f=fixture(); const s=f.add(()=>f.h.set_event(f.event),{suspended:1});
    assert.strictEqual(f.h.wait_single(f.event,20),0xffff);
    assert.strictEqual(f.callback()>>>0,0xffffffff);assert.strictEqual(s.runs(),0);
    f.tm.resumeThread(s.handle); assert.strictEqual(f.callback(),0);
    return {resumed:true};
  });
}
console.log(JSON.stringify({baseline,results},null,2));
if(process.argv.includes('--accept')) {
  assert(results.filter(r=>r.name.startsWith('close-')).every(r=>r.expectedNoFalseSuccess),
    'a valid unsignaled event closed during pumping must not become WAIT_OBJECT_0');
}

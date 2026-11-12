#!/usr/bin/env node
'use strict';
// Actual CLI imports, ThreadManager provider and runSlice. A tiny Wasm sibling
// calls its host signal import; lifecycle/getter exports model an empty DLL set.
// This is not x86 decoding, a full PE or native Windows qualification.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const managerPath = path.join(root, 'lib/thread-manager.js');
const mode = process.argv[2];
if (mode) {
  let source = mode === '--baseline' ? cp.execFileSync('git', ['-C', root, 'show',
    'c9e03eb6e40481f6bb570a89f96b856a9a1d5e83:lib/thread-manager.js'], {encoding:'utf8'})
    : fs.readFileSync(managerPath, 'utf8');
  function change(a, b) {
    assert.strictEqual(source.split(a).length, 2, 'unique mutation anchor');
    source = source.replace(a, b);
  }
  if (mode === '--fake-success') change('  waitSingleCooperative(handle, timeout, threadId = 1) {',
    '  waitSingleCooperative(handle, timeout, threadId = 1) { return 0;');
  else if (mode === '--run-suspended') {
    change("if (t.state === 'active' && !(t.suspendCount > 0)) activeCount++;", "if (t.state === 'active') activeCount++;");
    change('        if (thread.suspendCount > 0) continue;', '        // bad suspension gate');
    change("if (t.state === 'active' && !(t.suspendCount > 0)) return true;", "if (t.state === 'active') return true;");
  } else if (mode === '--reenter') change('    if (this._runningThreadHandle) return 0xFFFFFFFF;\n    const eventIdx',
    '    // bad owner gate\n    const eventIdx');
  else if (mode === '--non-atomic') change('Atomics.compareExchange(this.syncView, idx * 4 + 2, 1, 0) === 1',
    '(Atomics.store(this.syncView, idx * 4 + 2, 0), true)');
  else assert.strictEqual(mode, '--baseline');
  const mod = new Module(managerPath, module);
  mod.filename = managerPath; mod.paths = Module._nodeModulePaths(path.dirname(managerPath));
  require.cache[managerPath] = mod; mod._compile(source, managerPath);
}
const { ThreadManager } = require(managerPath);
const { readSyncObjectName } = require(path.join(root, 'lib/mem-utils'));
const cli = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
const start = cli.indexOf('  const win32ThreadId = () => threadManager.currentWin32ThreadId();');
const end = cli.indexOf('  // Check if a DLL file exists', start);
assert(start >= 0 && end > start);
// (module (import "h" "signal" (func)) (func (export "run") (param i32) call 0))
const wasm = new WebAssembly.Module(Uint8Array.from([
  0,97,115,109,1,0,0,0, 1,8,2,96,0,0,96,1,127,0,
  2,12,1,1,104,6,115,105,103,110,97,108,0,0,
  3,2,1,1, 7,7,1,3,114,117,110,0,1, 10,6,1,4,0,16,0,11,
]));
// A live main Wasm callback frame calls the production wait import and receives
// its result synchronously after the separate sibling instance has run.
const callbackWasm = new WebAssembly.Module(Uint8Array.from([
  0,97,115,109,1,0,0,0, 1,5,1,96,0,1,127,
  2,10,1,1,104,4,119,97,105,116,0,0,
  3,2,1,0, 7,7,1,3,114,117,110,0,1, 10,6,1,4,0,16,0,11,
]));
function fixture({manual=0, suspended=0, cold=false, signal=true, depth=1}={}) {
  const memory = new WebAssembly.Memory({initial:2, maximum:2, shared:true});
  const tm = new ThreadManager({}, memory, {exports:{get_sync_table:()=>0}}, ()=>({host:{}}));
  const logs=[]; tm._log = s=>logs.push(s);
  const h={}, ctx={exports:{get_sync_msg_depth:()=>depth}};
  new Function('h','threadManager','memory','readSyncObjectName','ctx',cli.slice(start,end))(
    h,tm,memory,readSyncObjectName,ctx);
  const event=h.create_event(manual,0,0,0), handle=0xe1010;
  const callback=new WebAssembly.Instance(callbackWasm,{h:{wait:()=>h.wait_single(event,-1)}}).exports.run;
  let runs=0, metadata=0, hook=()=>{};
  const instance=new WebAssembly.Instance(wasm,{h:{signal:()=>{
    runs++; assert.strictEqual(tm._runningThreadHandle,handle,'sibling owns dispatch');
    hook(); if(signal) assert.strictEqual(h.set_event(event),1);
  }}});
  const e={ memory, run:instance.exports.run, get_sync_table:()=>0,
    get_dll_callback_lock:()=>65536, get_dll_callback_owner:()=>2,
    get_dll_lifecycle_table:()=>65600, get_dll_lifecycle_stride:()=>60,
    get_dll_table:()=>66000, get_dll_count:()=>0,
    dll_load_lock_begin:()=>{metadata++;},
    dll_load_lock_release_once:()=>{assert(metadata>0);metadata--;},
    get_eip:()=>0x401000, get_yield_reason:()=>0, get_sleep_yielded:()=>0 };
  const worker={tid:1,state:'active',suspendCount:suspended,sleepCount:0,
    sleepUntil:0,waitPolls:0,instance:{exports:e}};
  if(!cold) worker._dllAttachNotified=true;
  tm.threads.set(handle,worker);
  return {tm,h,event,worker,handle,ctx,memory,logs,callback,runs:()=>runs,
    hook:f=>{hook=f;}, metadata:()=>metadata};
}
let groups=0;
for(const manual of [0,1]) for(const cold of [false,true]) {
  const f=fixture({manual,cold});
  assert.strictEqual(f.callback(),0,'nested event progresses runnable Wasm sibling');
  assert(f.runs()>0,'success requires real sibling execution');
  assert.strictEqual(f.h.wait_single(f.event,0),manual?0:0x102,'reset-mode consumption');
  assert.strictEqual(f.worker._dllAttachNotified,true);
  assert.strictEqual(f.metadata(),0);
  assert.deepStrictEqual(Array.from(new Int32Array(f.memory.buffer,65536,2)),[0,0]);
  assert.deepStrictEqual(f.logs,[],'scheduler must not hide a trap');
  assert(!f.tm._runningThreadHandle,'dispatch ownership restored'); groups++;
}
{
  const f=fixture();
  assert.strictEqual(f.h.wait_single(f.event,0),0x102);
  assert.strictEqual(f.runs(),0,'timeout-zero does not dispatch');
  assert.strictEqual(f.h.wait_single(f.event,25),0xffff,'finite wait retains deadline-owning yield path');
  assert.strictEqual(f.runs(),0,'finite call is not converted to unbounded pumping');
  f.ctx.exports.get_sync_msg_depth=()=>0;
  assert.strictEqual(f.h.wait_single(f.event,-1),0xffff,'ordinary main wait yields'); groups++;
}
{
  const f=fixture({suspended:1});
  assert.strictEqual(f.h.wait_single(f.event,-1)>>>0,0xffffffff,'suspended producer cannot signal');
  assert.strictEqual(f.runs(),0);
  assert.strictEqual(f.tm.resumeThread(f.handle),1);
  assert.strictEqual(f.h.wait_single(f.event,-1),0,'resumed producer now progresses'); groups++;
}
{
  const f=fixture(); f.worker.sleepUntil=Number.MAX_SAFE_INTEGER;
  assert.strictEqual(f.h.wait_single(f.event,-1)>>>0,0xffffffff,'event wait must not erase sibling sleep');
  assert.strictEqual(f.runs(),0); assert.strictEqual(f.worker.sleepUntil,Number.MAX_SAFE_INTEGER); groups++;
}
{
  const f=fixture(); f.tm.threads.clear();
  assert.strictEqual(f.h.wait_single(f.event,-1)>>>0,0xffffffff,'no available producer is not success');
  assert.strictEqual(f.h.wait_single(f.event,0),0x102);
  assert.strictEqual(f.h.close_event(f.event),1);
  assert.strictEqual(f.h.wait_single(f.event,-1),f.tm.waitSingle(f.event,-1),'stale handle preserves provider semantics');
  assert.strictEqual(f.h.wait_single(0x123456,0),f.tm.waitSingle(0x123456,0),'unknown handle preserves provider semantics'); groups++;
}
{
  const f=fixture(); f.tm._runningThreadHandle=0xe1020;
  assert.strictEqual(f.h.wait_single(f.event,-1)>>>0,0xffffffff,
    'active worker callback must not recursively dispatch siblings');
  assert.strictEqual(f.runs(),0,'active worker callback must not recursively dispatch siblings');
  assert.strictEqual(f.tm._runningThreadHandle,0xe1020,'outer ownership intact'); groups++;
}
{
  const f=fixture(); const other=f.h.create_event(0,0,0,0);
  f.hook(()=>{
    assert.strictEqual(f.h.wait_single(other,-1)>>>0,0xffffffff,'nested sibling wait cannot reenter itself');
    assert.strictEqual(f.tm._runningThreadHandle,f.handle,'nested rejection keeps owner');
  });
  assert.strictEqual(f.h.wait_single(f.event,-1),0); assert.deepStrictEqual(f.logs,[]); groups++;
}
{
  const f=fixture({cold:true}); const lock=new Int32Array(f.memory.buffer,65536,2);
  Atomics.store(lock,0,99); Atomics.store(lock,1,1);
  assert.strictEqual(f.h.wait_single(f.event,-1)>>>0,0xffffffff,'foreign lifecycle owner blocks entry');
  assert.strictEqual(f.runs(),0); assert.deepStrictEqual(Array.from(lock),[99,1]);
  assert(!f.worker._dllAttachNotified);
  Atomics.store(lock,0,0); Atomics.store(lock,1,0);
  assert.strictEqual(f.h.wait_single(f.event,-1),0,'released lifecycle gate permits producer'); groups++;
}
{
  const f=fixture({signal:false});
  assert.strictEqual(f.h.wait_single(f.event,-1)>>>0,0xffffffff,'runnable nonproducer cannot fabricate success');
  assert(f.runs()>0 && f.runs()<2000,'guest instruction budget bounds a nonproducer');
  assert.strictEqual(f.h.wait_single(f.event,0),0x102); groups++;
}
{
  const f=fixture(); f.tm.workerBackend={};
  assert.strictEqual(f.h.wait_single(f.event,-1),0xffff,'Worker backend has independent wait ownership');
  assert.strictEqual(f.runs(),0); groups++;
}
{
  const f=fixture(); f.h.set_event(f.event);
  const idx=f.tm._getSyncIdx(f.event)*4+2;
  // Deterministic competing atomic consumer between load and acquisition.
  const load=Atomics.load; let stolen=false;
  Atomics.load=function(view,i){
    const v=load(view,i);
    if(view===f.tm.syncView && i===idx && v===1 && !stolen) {
      stolen=true; assert.strictEqual(Atomics.compareExchange(view,i,1,0),1);
    }
    return v;
  };
  try { assert.strictEqual(f.h.wait_single(f.event,0),0x102,'only one atomic consumer may win'); }
  finally { Atomics.load=load; }
  assert(stolen); groups++;
}
console.log('PASS '+groups+' nested event production-boundary groups');

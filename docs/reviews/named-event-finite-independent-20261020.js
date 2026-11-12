#!/usr/bin/env node
'use strict';
// Independent scheduler adversaries. Real authority, virtual monotonic clock
// only in ThreadManager; guest registers are explicit fixtures, not x86 boot.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const root = path.resolve(__dirname, '../..');
const filename = path.join(root, 'lib/thread-manager.js');
let code = fs.readFileSync(filename, 'utf8');
const control = process.argv.find(x => x.startsWith('--control='))?.split('=')[1];
function replace(a,b) { assert(code.includes(a), a); code=code.replace(a,b); }
if (control === 'late-start') replace('deadline: started + timeout', 'deadline: performance.now() + timeout');
if (control === 'no-expiry') replace('performance.now() >= wait.deadline', 'false');
if (control === 'no-exit-cleanup') replace('if (this._authorityWaits) this._authorityWaits.delete(((thread.tid | 0) + 1) | 0);', '/* removed exit cleanup */');
if (control === 'nested-probe') replace('if ((timeout >>> 0) !== 0 &&\n        this._issuedAuthorityEvents.has((handle >>> 0) & 0x7fffffff)) return 0xFFFFFFFF;', '/* removed nested guard */');
let now = 1000;
globalThis.__finiteReviewClock = { now: () => now };
const mod = new Module(filename, module);
mod.filename=filename; mod.paths=Module._nodeModulePaths(path.dirname(filename));
mod._compile('const performance = globalThis.__finiteReviewClock;\n'+code, filename);
const {ThreadManager} = mod.exports;
const tm = new ThreadManager({}, new WebAssembly.Memory({initial:2,maximum:2,shared:true}),
  {exports:{get_sync_table:()=>0}}, ()=>({host:{}}));
tm._log=()=>{}; tm.enableNamedEventAuthority();
let seq=0,groups=0;
const create=(manual=0,initial=0)=>tm.createEvent(manual,initial,'independent-'+(++seq))&0x7fffffff;
const record=(handle,timeout)=>({waitHandle:handle,waitTimeout:timeout,waitStackBytes:12,waitHandlesPtr:0});
const resolve=(h,t,id=1,opts={})=>tm.resolveWait(record(h,t),{}, {threadId:id,...opts});
function group(name,fn) {fn(); groups++; console.log('PASS '+name);}
function frame(h,t,id=1) {
  let yieldReason=1,esp=0x1000,eip=0x402000,eax,completions=0,runs=0;
  return {get_sync_table:()=>0,get_yield_reason:()=>yieldReason,get_wait_handle:()=>h,
    get_wait_timeout:()=>t,get_wait_handles_ptr:()=>0,get_wait_stack_bytes:()=>12,
    get_current_thread_id:()=>id,get_esp:()=>esp,get_eip:()=>eip,
    get_sleep_yielded:()=>0,guest_read32:()=>0x403000,
    set_esp:v=>{esp=v;},set_eip:v=>{eip=v;},set_eax:v=>{eax=v>>>0;},
    clear_yield:()=>{yieldReason=0;completions++;},run:()=>{runs++;},
    snapshot:()=>({esp,eip,eax,completions,runs})};
}
function begin(h,t,id=1) {assert.equal(tm.waitSingle(h,t,id),65535); return tm._authorityWaits.get(id);}
group('initial transport time is charged before first poll',()=>{
  const h=create(),client=tm._eventClient(),original=client.acquire.bind(client);
  client.acquire=ref=>{const r=original(ref);now+=60;return r;};
  begin(h,50);client.acquire=original;
  tm.setEvent(h);
  assert.equal(resolve(h,50).result,258);assert.equal(tm.waitSingle(h,0),0);
});
group('frozen and accelerated guest clocks, exact deadline and late-signal preservation',()=>{
  const h=create();begin(h,50);const at=now;
  for(const guestTime of [0,1e15,-1e15]) {
    tm._waitNow=()=>guestTime;now=at+49;assert.equal(resolve(h,50),null);
  }
  now=at+50;tm.setEvent(h);assert.equal(resolve(h,50).result,258);
  assert.equal(tm.waitSingle(h,0),0);assert.equal(tm._authorityWaits.size,0);
});
group('distinct per-thread deadlines survive zero probes and recursive rejection',()=>{
  const h=create();const a=begin(h,100,2);now+=10;const b=begin(h,200,3);
  assert.equal(tm.waitSingle(h,0,2),258);
  assert.equal(tm.waitSingleCooperative(h,5,2),0xffffffff);
  assert.equal(resolve(h,100,2,{wallClock:true}).result,0xffffffff);
  assert.equal(tm._authorityWaits.get(2),a);assert.equal(tm._authorityWaits.get(3),b);
  now=a.deadline;tm.setEvent(h);assert.equal(resolve(h,100,2).result,258);
  assert.equal(resolve(h,200,3).result,0);assert.equal(tm._authorityWaits.size,0);
});
group('missing or mismatched identity fails without consuming another thread signal',()=>{
  const h=create(),other=create();begin(h,50,2);tm.setEvent(h);
  assert.equal(resolve(h,50,3).result,0xffffffff);
  assert.equal(resolve(other,50,2).result,0xffffffff);
  assert.equal(tm.waitSingle(h,0),0);assert.equal(tm._authorityWaits.size,0);
});
group('main frame is unchanged through poll guards, completes exactly once',()=>{
  const h=create();begin(h,100);const e=frame(h,100);tm.mainInstance.exports=e;
  const initial=e.snapshot();tm.workerBackend={_localSendFrames:[{}]};
  tm.setEvent(h);assert.equal(tm.checkMainYield(),true);assert.deepEqual(e.snapshot(),initial);
  tm.workerBackend=null;tm._renderSendTargets.add(e);
  assert.equal(tm.checkMainYield(),true);assert.deepEqual(e.snapshot(),initial);
  tm._renderSendTargets.delete(e);assert.equal(tm.checkMainYield(),false);
  assert.deepEqual(e.snapshot(),{esp:0x100c,eip:0x403000,eax:0,completions:1,runs:0});
  assert.equal(tm.checkMainYield(),false);assert.equal(e.snapshot().completions,1);
  assert.equal(tm.waitSingle(h,0),258);
});
group('guards do not restart the deadline after nested callbacks',()=>{
  const h=create();const w=begin(h,40);const e=frame(h,40);tm.mainInstance.exports=e;
  tm._renderSendTargets.add(e);now=w.deadline+10;tm.setEvent(h);
  assert.equal(tm.checkMainYield(),true);tm._renderSendTargets.delete(e);
  assert.equal(tm.checkMainYield(),false);assert.equal(e.snapshot().eax,258);
  assert.equal(tm.waitSingle(h,0),0);
});
group('recursive positive acquisition rejects even an already set event',()=>{
  const h=create(0,1);assert.equal(tm.waitSingleCooperative(h,1,1),0xffffffff);
  assert.equal(tm.waitSingle(h,0),0);
});
group('cooperative scheduler preserves frame, ignores poll floor, completes once',()=>{
  const h=create();const w=begin(h,60,5),e=frame(h,60,5);
  const t={tid:4,state:'active',suspendCount:0,sleepUntil:0,sleepCount:0,waitPolls:0,
    _dllAttachNotified:true,instance:{exports:e}};
  tm.threads.set(0xe1004,t);tm.runSlice(1);assert.equal(e.snapshot().completions,0);
  now=w.deadline;tm.setEvent(h);tm.runSlice(1);
  assert.equal(e.snapshot().eax,258);assert.equal(e.snapshot().esp,0x100c);
  tm.runSlice(1);assert.equal(e.snapshot().completions,1);assert.equal(tm.waitSingle(h,0),0);
  tm.threads.clear();
});
group('runnable Wasm sibling and nested callback progress while main frame stays parked',()=>{
  const h=create(),nested=create(0,1);const owned=begin(h,100);
  const e=frame(h,100);tm.mainInstance.exports=e;let calls=0;
  const wasm=new WebAssembly.Module(Uint8Array.from([
    0,97,115,109,1,0,0,0,1,8,2,96,0,0,96,1,127,0,
    2,12,1,1,104,6,115,105,103,110,97,108,0,0,3,2,1,1,
    7,7,1,3,114,117,110,0,1,10,6,1,4,0,16,0,11]));
  const inst=new WebAssembly.Instance(wasm,{h:{signal:()=>{
    calls++;assert.equal(tm.waitSingleCooperative(nested,10,1),0xffffffff);
    assert.equal(tm._authorityWaits.get(1),owned);assert.equal(e.snapshot().completions,0);
    tm.setEvent(h);
  }}});
  tm.threads.set(0xe1020,{tid:31,state:'active',suspendCount:0,sleepUntil:0,sleepCount:0,
    waitPolls:0,_dllAttachNotified:true,instance:{exports:{run:inst.exports.run,
      get_eip:()=>0x404000,get_yield_reason:()=>0,get_sleep_yielded:()=>0}}});
  assert.equal(tm.checkMainYield(),true);tm.runSlice(1);assert(calls>0);
  assert.equal(e.snapshot().completions,0);assert.equal(tm.checkMainYield(),false);
  assert.equal(e.snapshot().eax,0);assert.equal(e.snapshot().completions,1);
  assert.equal(tm.waitSingle(nested,0),0);tm.threads.clear();
});
group('parked Worker poll caches one acquired completion without reacquisition',()=>{
  const h=create();begin(h,100,6);
  const t={tid:5,parkedWait:record(h,100)};
  assert.equal(tm._pollParkedWait(t),false);tm.setEvent(h);
  assert.equal(tm._pollParkedWait(t),true);const done=t.parkedWaitDone;
  tm.setEvent(h);for(let n=0;n<20;n++)assert.equal(tm._pollParkedWait(t),true);
  assert.equal(t.parkedWaitDone,done);assert.equal(done.result,0);
  assert.equal(tm.waitSingle(h,0),0);assert.equal(tm._authorityWaits.size,0);
});
group('forced cancellation and exit remove only the victim continuation',()=>{
  const h=create();const survivor=begin(h,100,2);begin(h,100,7);
  const t={tid:6,state:'active',instance:{exports:{}}};tm.threads.set(0xe1006,t);
  tm.terminateThread(0xe1006,9);assert.equal(t.state,'exited');
  assert.equal(tm._authorityWaits.has(7),false);assert.equal(tm._authorityWaits.get(2),survivor);
  tm.setEvent(h);assert.equal(resolve(h,100,7).result,0xffffffff);
  assert.equal(resolve(h,100,2).result,0);tm.threads.clear();
  begin(h,100,8);tm._markThreadExited(0xe1007,{tid:7,state:'active'},0,'normal exit');
  assert.equal(tm._authorityWaits.size,0);
});
group('partial close and repeated slot reuse preserve original lifetime',()=>{
  const h=create();assert.equal(tm.openEvent('independent-'+seq),h);
  begin(h,100);tm.closeEvent(h);tm.setEvent(h);assert.equal(resolve(h,100).result,0);
  begin(h,100);const slot=tm._getSyncIdx(h);tm.closeEvent(h);
  for(let i=0;i<20;i++){const replacement=create(0,1);assert.equal(tm._getSyncIdx(replacement),slot);
    assert.equal(tm.waitSingle(replacement,0),0);tm.closeEvent(replacement);}
  const replacement=create(0,1);assert.equal(resolve(h,100).result,0xffffffff);
  assert.equal(tm.waitSingle(replacement,0),0);
});
group('infinite and positive multiwait boundaries reject without consumption',()=>{
  const h=create(0,1),local=tm.createEvent(0,1);
  new Uint32Array(tm.memory.buffer,70000,2).set([local,h]);
  assert.equal(tm.waitSingle(h,0xffffffff),0xffffffff);
  for(const all of [false,true])for(const timeout of [1,100,0xffffffff])
    assert.equal(tm.waitMultiple(2,70000,all,timeout,1),0xffffffff);
  assert.equal(tm.waitMultiple(2,70000,true,0,1),0xffffffff);
  assert.equal(tm.waitSingle(h,0),0);assert.equal(tm.waitSingle(local,0),0);
});
group('transient Set/Reset misses both manual and auto waiting threads (known conformance gap)',()=>{
  for(const manual of [0,1]) {
    const h=create(manual);begin(h,100,2);const w=begin(h,100,3);
    tm.setEvent(h);tm.resetEvent(h);
    assert.equal(resolve(h,100,2),null);assert.equal(resolve(h,100,3),null);
    now=w.deadline;assert.equal(resolve(h,100,2).result,258);
    assert.equal(resolve(h,100,3).result,258);
    // Persistent-signal negative control: distinguish lost transient from broken fixture.
    begin(h,100,2);begin(h,100,3);tm.setEvent(h);
    assert.equal(resolve(h,100,2).result,0);
    const r=resolve(h,100,3);assert.equal(r?.result,manual?0:undefined);
    if(!manual){now+=100;assert.equal(resolve(h,100,3).result,258);}
    tm.resetEvent(h);
  }
});
group('transport exception neither fabricates completion nor destroys another identity',()=>{
  const h=create();const a=begin(h,100,2),b=begin(h,100,3);
  const client=tm._eventClient(),original=client.acquire;
  client.acquire=()=>{throw Object.assign(Error('injected lost reply'),{code:'EIO'});};
  assert.throws(()=>resolve(h,100,2),{code:'EIO'});
  assert.equal(tm._authorityWaits.get(2),a);assert.equal(tm._authorityWaits.get(3),b);
  client.acquire=original;now+=100;
  assert.equal(resolve(h,100,2).result,258);assert.equal(resolve(h,100,3).result,258);
});
assert.equal(tm._authorityWaits.size,0);
// Fresh actual Node Workers, real guest RPC and production CLI adapter. Unlike
// submitted competition tests, expire one identity before a surviving identity
// acquires, then terminate another parked identity before a signal arrives.
async function workers() {
  const {Worker}=require('node:worker_threads');
  const RPC=require(path.join(root,'lib/guest-rpc'));
  const cli=fs.readFileSync(path.join(root,'test/run.js'),'utf8');
  const start=cli.indexOf('    wh.wait_single = (handle, timeout) => {');
  const end=cli.indexOf('\n    };',start)+7;assert(start>0&&end>start);
  const live=[];
  async function launch(tid,h,timeout) {
    const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
    const sigs={wait_single:{params:['i32','i32'],results:['i32']}};
    const wh={};new Function('wh','workerInstance','threadManager','tid','h',cli.slice(start,end))
      (wh,null,tm,tid,{wait_single:()=>{throw Error('unexpected local route');}});
    const broker=RPC.createMainBroker(memory,wh,sigs);
    const worker=new Worker(`
      const {parentPort,workerData:d}=require('node:worker_threads');
      const h=require(d.rpc).createWorkerImports(d.memory,d.sigs,m=>parentPort.postMessage(m),
        {slot:0,getSyncMsgDepth:()=>0}).imports.host;
      let started=false,done=false,completed=0,esp=1024,eax;
      parentPort.on('message',m=>{try{let value;
        if(m.op==='slice'){
          if(!started){started=true;if((h.wait_single(d.handle,d.timeout)>>>0)!==65535)throw Error('not parked');}
          value=done?{eip:0x403000,yield:0}:{eip:0x402000,yield:1,waitHandle:d.handle,
            waitTimeout:d.timeout,waitHandlesPtr:0,waitStackBytes:12};
        } else if(m.op==='complete') {if(done)throw Error('duplicate completion');done=true;completed++;
          esp+=m.bytes;eax=m.result;value={eip:0x403000};
        } else value={started,done,completed,esp,eax};
        parentPort.postMessage({id:m.id,value});
      }catch(e){parentPort.postMessage({id:m.id,error:e.message});}});
    `,{eval:true,workerData:{memory,sigs,handle:h,timeout,rpc:path.join(root,'lib/guest-rpc')}});
    live.push(worker);let serial=0;const pending=new Map();
    worker.on('message',m=>{if(m.t==='rpc')broker.serveRpc(m.slot);else {
      const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);
        m.error?p.reject(Error(m.error)):p.resolve(m.value);}}});
    const ask=(op,extra={})=>new Promise((resolve,reject)=>{
      const id=++serial,timer=setTimeout(()=>reject(Error('Worker watchdog')),4000);
      pending.set(id,{resolve,reject,timer});worker.postMessage({op,id,...extra});});
    const link={slot:tid,startEip:0x402000,slice:()=>ask('slice'),
      completeWait:(result,bytes)=>ask('complete',{result,bytes}),callExport:async()=>0,syncThunks:async()=>{}};
    const t={tid,state:'active',suspendCount:0,sleepUntil:0,sleepCount:0,waitPolls:0,
      waitStartedAt:0,link,_dllAttachNotified:true};
    const handle=0xe1000+tid;tm.threads.set(handle,t);
    return {t,handle,state:()=>ask('state')};
  }
  tm.workerBackend={threadLinks:new Map(),dropThread:()=>{}};
  try {
    const h=create(),a=await launch(8,h,50),b=await launch(9,h,150);
    await tm.runWorkerSlices(1);
    assert(a.t.parkedWait&&b.t.parkedWait);assert.equal(tm._authorityWaits.size,2);
    now+=50;tm.setEvent(h);await tm.runWorkerSlices(1);await tm.runWorkerSlices(1);
    const states=await Promise.all([a.state(),b.state()]);
    assert.deepEqual(states.map(s=>s.eax),[258,0]);
    for(const s of states){assert.equal(s.completed,1);assert.equal(s.esp,1036);}
    tm.threads.clear();
    const c=await launch(10,h,100);await tm.runWorkerSlices(1);
    assert(c.t.parkedWait);tm.terminateThread(c.handle,42);
    assert.equal(tm._authorityWaits.has(11),false);tm.setEvent(h);
    await tm.runWorkerSlices(1);assert.equal((await c.state()).completed,0);
    assert.equal(tm.waitSingle(h,0),0);tm.threads.clear();
    groups++;console.log('PASS real ordinary Workers: deadline identity, one completion, cancellation without consumption');
  } finally {tm.workerBackend=null;for(const w of live)await w.terminate();}
}
workers().then(()=>console.log(JSON.stringify({groups,control:control||null,
  scope:'scheduler fixtures and actual RPC Workers with real authority; transient wake reservation missing'})))
  .catch(e=>{console.error(e);process.exitCode=1;});

#!/usr/bin/env node
'use strict';
// Actual CLI import blocks, fork statements, scheduler and Node Worker RPC.
// Register/PE/link fixtures are explicit: this is not a complete x86/CLI boot.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');
const { Worker } = require('node:worker_threads');
const root = path.resolve(__dirname, '..');
if (process.argv.includes('--zero-regression')) {
  // A NEW scoped replay of the accepted acquisition suite. Preserve its file
  // and historical positive-wait expectations; this replay only narrows the
  // main positive-wait assertion to INFINITE, which remains unsupported.
  const file=path.join(root,'test/test-named-event-cli-integration.js');
  const old=fs.readFileSync(file,'utf8');
  const needle='for (const timeout of [1, 500, -1])';
  assert.equal(old.split(needle).length,2);
  const replay=new Module(file,module);replay.filename=file;
  replay.paths=Module._nodeModulePaths(path.dirname(file));
  replay._compile(old.replace(needle,'for (const timeout of (depth ? [1, 500, -1] : [-1]))'),file);
  return;
}
const base = '8f4ade77e9af1b47463f527118f1035fc22cb986';
const baseline = process.argv.includes('--baseline');
function source(file) {
  return baseline ? cp.execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}
let tmSource = source('lib/thread-manager.js');
if (process.argv.includes('--fake-success')) {
  const needle = 'return 0xFFFF; // ordinary scheduler continuation, never an inline wait';
  assert(tmSource.includes(needle)); tmSource = tmSource.replace(needle, 'return 0; // rejecting control');
}
if (process.argv.includes('--no-deadline')) {
  const needle = 'performance.now() >= wait.deadline';
  assert(tmSource.includes(needle)); tmSource = tmSource.replace(needle, 'false');
}
const mod = new Module(path.join(root, 'lib/thread-manager.js'), module);
mod.filename = path.join(root, 'lib/thread-manager.js');
mod.paths = Module._nodeModulePaths(path.dirname(mod.filename));
mod._compile(tmSource, mod.filename);
const { ThreadManager } = mod.exports;
const { readSyncObjectName } = require('../lib/mem-utils');
const RPC = require('../lib/guest-rpc');
const cli = source('test/run.js');
const begin = cli.indexOf('  const win32ThreadId = () => threadManager.currentWin32ThreadId();');
const end = cli.indexOf('  // Check if a DLL file exists', begin);
assert(begin > 0 && end > begin);
const install = new Function('h','threadManager','memory','readSyncObjectName','ctx',cli.slice(begin,end));
const forks = [...cli.matchAll(/    const child = fork\(__filename, args, .*?\);/g)].map(x=>x[0]);
assert.equal(forks.length,2);
const delay = ms => new Promise(r=>setTimeout(r,ms));
const resources=[];
function fixture() {
  const memory = new WebAssembly.Memory({initial:2,maximum:2,shared:true});
  const ctx={exports:{get_sync_msg_depth:()=>0}}, h={};
  const tm = new ThreadManager({},memory,{exports:{get_sync_table:()=>0}},()=>({host:{}}));
  tm._log=()=>{};
  install(h,tm,memory,readSyncObjectName,ctx);
  const name=s=>{new Uint8Array(memory.buffer).set(Buffer.from(s+'\0'),65536);return 65536;};
  return {tm,h,ctx,memory,name,create:(s,m=0,v=0)=>h.create_event(m,v,name(s),0)&0x7fffffff};
}
function parkedExports(handle,timeout,tid=1) {
  let yr=1, eax, esp=0x100, eip=0x401000;
  return {get_sync_table:()=>0,get_yield_reason:()=>yr,get_wait_handle:()=>handle,
    get_wait_timeout:()=>timeout,get_wait_handles_ptr:()=>0,get_wait_stack_bytes:()=>12,
    get_current_thread_id:()=>tid,get_esp:()=>esp,guest_read32:()=>0x401234,
    get_eip:()=>eip,clear_yield:()=>{yr=0;},set_eax:v=>{eax=v>>>0;},
    set_esp:v=>{esp=v;},set_eip:v=>{eip=v;},result:()=>eax};
}
function beginMain(p,handle,timeout) {
  const at=performance.now();
  assert.equal(p.h.wait_single(handle,timeout)>>>0,65535,'unsignaled finite wait must park, not fail or succeed');
  const e=parkedExports(handle,timeout); p.tm.mainInstance.exports=e;
  return {e,at};
}
async function finishMain(p,w,action=()=>{}) {
  while(p.tm.checkMainYield()) {
    assert(performance.now()-w.at<4000,'finite wait must complete within bounded harness budget');
    // Exercise the actual CLI main suspension closure and asynchronous park
    // statement, not merely ThreadManager's import and direct zero probes.
    const start=cli.indexOf('  const mainExecutionSuspended = () => {');
    const end=cli.indexOf('\n  };',start)+5;
    const suspended=new Function('instance','threadManager',cli.slice(start,end)+'\nreturn mainExecutionSuspended();');
    assert.equal(suspended(p.tm.mainInstance,p.tm),true,'CLI must not reenter parked main');
    const park=cli.match(/      if \(threadManager.isMainNamedEventWaiting\(\)\) \{\n        await new Promise\(resolve => setTimeout\(resolve, 4\)\);\n      \}/);
    assert(park,'actual CLI async named-event park');
    action();
    await new (Object.getPrototypeOf(async function(){}).constructor)('threadManager',park[0])(p.tm);
  }
  assert.equal(w.e.get_esp(),0x10c,'one stdcall completion');
  assert.equal(w.e.get_eip(),0x401234);
  return w.e.result();
}
function fork(which) {
  const args=['--child'];
  const child=new Function('fork','__filename','args','ThreadManager',forks[which]+'\nreturn child;')
    (cp.fork,__filename,args,ThreadManager);
  resources.push(()=>child.kill()); child.stderr.pipe(process.stderr);
  let seq=0;
  child.ask=msg=>new Promise((resolve,reject)=>{
    const id=++seq,t=setTimeout(()=>{child.off('message',on);reject(Error('child RPC timeout'));},5000);
    function on(m){if(m.id===id){clearTimeout(t);child.off('message',on);m.error?reject(Error(m.error)):resolve(m.value);}}
    child.on('message',on);child.send({...msg,id});
  });
  return child;
}
const siblingModule=new WebAssembly.Module(Uint8Array.from([
  0,97,115,109,1,0,0,0,1,8,2,96,0,0,96,1,127,0,
  2,12,1,1,104,6,115,105,103,110,97,108,0,0,3,2,1,1,
  7,7,1,3,114,117,110,0,1,10,6,1,4,0,16,0,11]));
function addSibling(p,action) {
  const tid=p.tm.threads.size+1,handle=0xe1000+tid;
  let runs=0;
  const inst=new WebAssembly.Instance(siblingModule,{h:{signal:()=>{runs++;action();}}});
  const e={run:inst.exports.run,get_sync_table:()=>0,get_eip:()=>0x401000,
    get_yield_reason:()=>0,get_sleep_yielded:()=>0};
  const t={tid,state:'active',suspendCount:0,sleepUntil:0,sleepCount:0,waitPolls:0,
    _dllAttachNotified:true,instance:{exports:e}};
  p.tm.threads.set(handle,t);return {t,e,runs:()=>runs};
}
function workerImports(p,tid) {
  // Execute the production per-thread single-wait override after primitive adoption.
  const a=cli.indexOf('    wh.wait_single = (handle, timeout) => {');
  const b=cli.indexOf('\n    };',a)+7;
  if(baseline) return p.h;
  assert(a>0&&b>a);
  const wh={...p.h};
  let block=cli.slice(a,b);
  if(process.argv.includes('--wrong-worker-id'))block=block.replaceAll('(tid | 0) + 1','1');
  new Function('wh','workerInstance','threadManager','tid','h',block)(wh,null,p.tm,tid,p.h);
  return wh;
}
async function realWorker(p,handle,timeout,tid) {
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const sigs={wait_single:{params:['i32','i32'],results:['i32']}};
  const errors=[];
  const broker=RPC.createMainBroker(memory,workerImports(p,tid),sigs,{onError:(n,e)=>errors.push(e.code)});
  const w=new Worker(`
    const {parentPort,workerData:d}=require('node:worker_threads');
    const RPC=require(d.rpc);
    const h=RPC.createWorkerImports(d.memory,d.sigs,m=>parentPort.postMessage(m),
      {slot:0,getSyncMsgDepth:()=>0}).imports.host;
    let entered=false,done=false,esp=256,eax;
    parentPort.on('message',m=>{
      try {
        let value;
        if(m.op==='slice') {
          if(!entered){entered=true;const r=h.wait_single(d.handle,d.timeout)>>>0;
            if(r!==65535)throw Error('worker failed to park: '+r);}
          value=done?{eip:0x401234,yield:0}:{eip:0x401000,yield:1,
            waitHandle:d.handle,waitTimeout:d.timeout,waitHandlesPtr:0,waitStackBytes:12};
        } else if(m.op==='complete'){if(done)throw Error('double completion');
          done=true;esp+=m.bytes;eax=m.result;value={eip:0x401234};}
        else if(m.op==='state')value={entered,done,esp,eax};
        parentPort.postMessage({id:m.id,value});
      }catch(e){parentPort.postMessage({id:m.id,error:e.message});}
    });
  `,{eval:true,workerData:{memory,sigs,handle,timeout,rpc:path.join(root,'lib/guest-rpc')}});
  resources.push(()=>w.terminate());
  let seq=0;const pending=new Map();
  w.on('message',m=>{if(m.t==='rpc')broker.serveRpc(m.slot);else{
    const f=pending.get(m.id);if(f){pending.delete(m.id);m.error?f.reject(Error(m.error)):f.resolve(m.value);}}});
  w.on('error',e=>{for(const f of pending.values())f.reject(e);});
  const ask=(op,extra={})=>new Promise((resolve,reject)=>{
    const id=++seq;pending.set(id,{resolve,reject});w.postMessage({id,op,...extra});});
  const link={slot:tid,slice:()=>ask('slice'),completeWait:(result,bytes)=>ask('complete',{result,bytes}),
    callExport:async()=>0,syncThunks:async()=>{},startEip:0x401000};
  const t={tid,state:'active',suspendCount:0,sleepUntil:0,sleepCount:0,link,
    waitPolls:0,waitStartedAt:0,_dllAttachNotified:true};
  p.tm.threads.set(0xe1000+tid,t);
  p.tm.workerBackend={dropThread:()=>{},threadLinks:new Map()};
  return {t,link,errors,state:()=>ask('state'),stop:()=>w.terminate()};
}
async function main() {
  const p=fixture(), a=fork(0),b=fork(1);
  await Promise.all([a.ask({op:'ready'}),b.ask({op:'ready'})]);
  const h=p.create('finite-main');
  await a.ask({op:'open',name:'finite-main'});
  // Arm the child's delay only after main parks: host load cannot turn this
  // into an already-signaled acquisition masquerading as waiting.
  let w=beginMain(p,h,1500);
  await a.ask({op:'later',ms:80});
  assert.equal(await finishMain(p,w),0,'subprocess delayed Set wakes main');
  assert(performance.now()-w.at<1500,'signal completed before deadline');
  assert.equal(p.h.wait_single(h,0),258);
  console.log('PASS actual fork/import main delayed producer');
  // Finite waits may acquire immediately when already signaled; zero probes
  // are not the only way to consume, but neither leaves a parked record.
  p.h.set_event(h);assert.equal(p.h.wait_single(h,100),0);
  assert.equal(p.h.wait_single(h,0),258);
  assert.equal(p.tm._authorityWaits.size,0);
  w=beginMain(p,h,80);
  // A huge guest clock jump and no local producer must not fast-timeout.
  p.tm._waitNow=()=>1e12;
  assert.equal(p.tm.checkMainYield(),true,'no early timeout with no local threads');
  assert.equal(await finishMain(p,w),258);
  assert(performance.now()-w.at>=80,'timeout measured from import entry');
  // Deadline already elapsed before the first scheduler poll: no late consume.
  w=beginMain(p,h,30); await delay(50);p.h.set_event(h);
  assert.equal(await finishMain(p,w),258);
  assert.equal(p.h.wait_single(h,0),0,'late signal retained');
  console.log('PASS unsignaled/deadline/no-local-producer accounting');
  const s=addSibling(p,()=>p.h.set_event(h));
  w=beginMain(p,h,1500);
  assert.equal(await finishMain(p,w,()=>p.tm.runSlice(100,{quantumSteps:100,maxWallMs:12})),0);
  assert(s.runs()>0,'actual Wasm sibling dispatched by scheduler');p.tm.threads.clear();
  console.log('PASS same-host runnable producer');
  for(const manual of [0,1]) {
    const ev=p.create('compete-'+manual,manual);
    const x=await realWorker(p,ev,250,1),y=await realWorker(p,ev,250,2);
    const entered=performance.now();await p.tm.runWorkerSlices(100);
    assert(x.t.parkedWait&&y.t.parkedWait,'two actual RPC Workers parked');
    assert.equal(p.tm._authorityWaits.size,2,'distinct per-worker deadline ownership');
    p.tm.workerFreeRun=true;
    assert(p.tm.freeRunParkBound(50)>0&&p.tm.freeRunParkBound(50)<=4,
      'parked Workers bound idle host polling without guest reentry');
    p.tm.workerFreeRun=false;
    p.h.set_event(ev);
    const start=performance.now();
    while(x.t.parkedWait||y.t.parkedWait){await p.tm.runWorkerSlices(100);await delay(4);
      assert(performance.now()-start<2000,'Worker finite deadline completes');}
    const states=await Promise.all([x.state(),y.state()]);
    assert.deepEqual(states.map(v=>v.eax).sort((a,b)=>a-b),manual?[0,0]:[0,258]);
    if(!manual)assert(performance.now()-entered>=250,'Worker loser waited out its finite deadline');
    for(const st of states)assert.equal(st.esp,268);
    assert.equal(p.h.wait_single(ev,0),manual?0:258);
    p.h.reset_event(ev);assert.equal(p.h.wait_single(ev,0),258);
    assert.deepEqual(x.errors,[]);assert.deepEqual(y.errors,[]);
    await x.stop();await y.stop();p.tm.threads.clear();p.tm.workerBackend=null;
  }
  console.log('PASS real ordinary Workers broker/scheduler auto-one/manual-both/reset');
  const reset=p.create('finite-reset',1);
  w=beginMain(p,reset,500);p.h.set_event(reset);p.h.reset_event(reset);
  assert.equal(p.tm.checkMainYield(),true,'Reset before poll cancels manual signal');
  p.h.set_event(reset);assert.equal(await finishMain(p,w),0);
  assert.equal(p.h.wait_single(reset,50),0,'manual finite acquisition retains signal');
  p.h.reset_event(reset);w=beginMain(p,reset,30);
  assert.equal(await finishMain(p,w),258,'reset finite wait times out');
  // Cooperative guest wait completion also uses the ordinary scheduler.
  const c=addSibling(p,()=>{}),ev=p.create('cooperative-wait');
  assert.equal(p.tm.waitSingle(ev,500,c.t.tid+1),65535);
  const ex=parkedExports(ev,500,c.t.tid+1);Object.assign(c.e,ex);
  p.tm.runSlice(100);assert.equal(ex.result(),undefined);
  assert(p.tm.parkedThreadDelay(50)>0&&p.tm.parkedThreadDelay(50)<=4,
    'cooperative named wait permits bounded idle host park');
  p.h.set_event(ev);p.tm.runSlice(100);assert.equal(ex.result(),0);
  p.tm.threads.clear();
  console.log('PASS cooperative guest scheduler continuation');
  // Repeated Open holds a reference; final close/reuse never completes stale wait.
  const life=p.create('life');assert.equal(p.h.open_event(p.name('life'),0),life);
  w=beginMain(p,life,500);p.h.close_event(life);p.h.set_event(life);
  assert.equal(await finishMain(p,w),0);
  w=beginMain(p,life,500);const slot=p.tm._getSyncIdx(life);p.h.close_event(life);
  const replacement=p.create('life',0,1);assert.equal(p.tm._getSyncIdx(replacement),slot);
  assert.equal(await finishMain(p,w),0xffffffff);assert.equal(p.h.wait_single(replacement,0),0);
  console.log('PASS partial reference/final close/slot reuse');
  p.h.set_event(h);const local=p.h.create_event(0,1,0,0);
  new Uint32Array(p.memory.buffer,70000,2).set([local,h]);
  for(const timeout of [1,50,-1]){
    p.ctx.exports.get_sync_msg_depth=()=>1;
    assert.equal(p.h.wait_single(h,timeout),0xffffffff);
    p.ctx.exports.get_sync_msg_depth=()=>0;
    for(const all of [0,1])assert.equal(p.h.wait_multiple(2,70000,all,timeout),0xffffffff);
  }
  assert.equal(p.h.wait_single(h,-1),0xffffffff);
  assert.equal(p.h.wait_single(h,0),0);assert.equal(p.h.wait_single(local,0),0);
  // Recursive Worker resolver must reject even if an outer wait exists.
  w=beginMain(p,h,500);p.h.set_event(h);
  assert.equal(p.tm.resolveWait({waitHandle:h,waitTimeout:500,waitStackBytes:12},{},
    {threadId:1,wallClock:true}).result,0xffffffff);
  assert.equal(await finishMain(p,w),0);
  console.log('PASS unsupported nested/infinite/multiwait preconsumption guards');
  w=beginMain(p,h,1500);
  const client=p.tm._namedEventClient;client.timeoutMs=40;await client.worker.terminate();
  assert.throws(()=>p.tm.checkMainYield(),e=>e.code==='ETIMEDOUT');
  assert.throws(()=>p.tm.checkMainYield(),e=>e.code==='ECLOSED');
  assert.equal(p.tm._namedEventClient,client,'no replacement/replay');
  assert.equal(w.e.result(),undefined,'transport error never completes with success/timeout');
  console.log('PASS transport failure explicit and retained poison');
}
if(process.argv.includes('--child')){
  const p=fixture();let h;
  process.on('message',m=>{
    try{let value=1;
      if(m.op==='open'){h=p.h.open_event(p.name(m.name),0);assert(h);value=h;}
      if(m.op==='later')setTimeout(()=>p.h.set_event(h),m.ms);
      process.send({id:m.id,value});
    }catch(e){process.send({id:m.id,error:e.message});}
  });
}else main().catch(e=>{console.error(e);process.exitCode=1;})
  .finally(async()=>{for(const stop of resources)await stop();});

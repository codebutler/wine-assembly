#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const {audioContext}=require('./test-beep-output');
const RPC=require('../lib/guest-rpc');
const {sigs}=require('../lib/host-import-sigs.generated.json');
const {Worker}=require('node:worker_threads');
const {GuestThreadHost,WorkerLink}=require('../lib/guest-thread-host');
(async()=>{
 const extraWat=`
 (func (export "tone_process") (param i32 i32) (result i32) (call $host_beep_process_begin (local.get 0) (local.get 1)))
 (func (export "tone_thread") (param i32 i32 i32 i32 i32) (result i32) (call $host_beep_thread_begin (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)))
 (func (export "tone_retire") (param i32 i32 i32) (result i32) (call $host_beep_retire_thread (local.get 0) (local.get 1) (local.get 2)))
 (func (export "tone_shutdown") (result i32) (call $host_beep_shutdown))
 (func (export "tone_owned") (param i32 i32 i32 i32 i32) (result i32) (call $host_beep_start (local.get 0) (local.get 1) (local.get 2) (local.get 3) (local.get 4)))
 (func (export "tone_start") (param i32 i32) (result i32) (call $host_beep_start (local.get 0) (local.get 1) (i32.const 1) (i32.const 2) (i32.const 0)))
 (func (export "tone_status") (param i32 i32) (result i32) (call $host_beep_status (local.get 0) (local.get 1)))
 (func (export "tone_cancel") (param i32) (result i32) (call $host_beep_cancel (local.get 0)))`;
 const h=await bootRenderHarness({extraWat,fonts:'none'}),ac=audioContext();
 h.hostCtx._voices._ensureCtx=()=>ac;
 const broker=RPC.createMainBroker(h.memory,h.host,sigs,{});
 const remote=RPC.createWorkerImports(h.memory,sigs,msg=>broker.serveRpc(msg.slot),{slot:3});
 const calls=new Map(),host={...h.host};
 for(const n of ['beep_process_begin','beep_thread_begin','beep_retire_thread','beep_shutdown','beep_start','beep_status','beep_cancel']){
  calls.set(n,0);host[n]=(...args)=>{calls.set(n,calls.get(n)+1);return remote.imports.host[n](...args);};
 }
 const e=new WebAssembly.Instance(h.module,{host,gdi:h.gdi}).exports;
 assert.equal(e.tone_process(1,0),1);assert.equal(e.tone_thread(1,2,0,1,0),1);
 const id=e.tone_start(750,100);assert(id>0);assert.equal(ac.nodes.length,1);
 assert.equal(h.exports.tone_status(id,1),0);assert.equal(e.tone_status(id,0),0);
 ac.currentTime+=0.1;assert.equal(e.tone_status(id,1),1);assert.equal(h.exports.tone_status(id,0),-6);
 const cancelled=e.tone_start(800,200);assert.equal(e.tone_cancel(cancelled),-995);
 assert.equal(h.exports.tone_status(cancelled,1),-995);
 ac.state='suspended';assert.equal(e.tone_start(800,200),-50);
 ac.state='running';
 const retired=e.tone_start(800,200);assert.equal(e.tone_retire(1,2,0),1);
 assert.equal(e.tone_status(retired,0),-6);assert.equal(e.tone_start(800,200),-995);
 assert.equal(e.tone_shutdown(),1);assert.equal(e.tone_process(1,0),-995);
 for(const [name,count] of calls)assert(count>0,'compiled broker route exercised: '+name);
 assert.equal(remote.stats.sync,[...calls.values()].reduce((sum,n)=>sum+n,0),'every exercised import used synchronous broker');
 // An actual OS Worker blocks in the compiled import while main retires its
 // owner. Release that already-issued request only after installing a new root.
 const worker=new Worker(`
  const {parentPort,workerData:d}=require('node:worker_threads');
  const RPC=require(d.rpc);
  const remote=RPC.createWorkerImports(d.memory,d.sigs,m=>parentPort.postMessage(m),{slot:4});
  const gdi={};for(const i of WebAssembly.Module.imports(d.module))if(i.module==='gdi')gdi[i.name]=()=>{throw Error('unexpected GDI '+i.name)};
  const e=new WebAssembly.Instance(d.module,{host:remote.imports.host,gdi}).exports;
  parentPort.on('message',m=>{
   if(m==='start')parentPort.postMessage({t:'started',process:e.tone_process(10,1),thread:e.tone_thread(2,11,1,10,1),id:e.tone_owned(750,100,2,11,1)});
   if(m==='stale')parentPort.postMessage({t:'stale',result:e.tone_owned(750,100,2,11,1)});
  });
 `,{eval:true,workerData:{rpc:require.resolve('../lib/guest-rpc'),module:h.module,memory:h.memory,sigs}});
 let hold=false,held,waiting;
 const messages=[];
 const receive=t=>new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('Worker message timeout: '+t)),10000);
  const take=m=>{clearTimeout(timer);resolve(m)};
  const index=messages.findIndex(m=>m.t===t);
  if(index>=0)take(messages.splice(index,1)[0]);else waiting={t,take};
 });
 worker.on('message',m=>{
  if(m.t==='rpc'){
   if(hold){held=m;if(waiting?.t==='held'){const w=waiting;waiting=null;w.take({t:'held'})}else messages.push({t:'held'});}
   else broker.serveRpc(m.slot);
  }else if(waiting?.t===m.t){const w=waiting;waiting=null;w.take(m)}else messages.push(m);
 });
 let workerFailure;
 worker.on('error',error=>{workerFailure=error;});
 try{
  worker.postMessage('start');const started=await receive('started');
  assert.equal(started.process,1);assert.equal(started.thread,1);assert(started.id>0);
  const late=ac.nodes.at(-1).onended;
  hold=true;worker.postMessage('stale');await receive('held');
  assert.equal(h.exports.tone_retire(2,11,1),1);
  assert.equal(h.exports.tone_thread(2,12,1,10,1),1);
  const fresh=h.exports.tone_owned(750,100,2,12,1);assert(fresh>started.id);
  hold=false;broker.serveRpc(held.slot);
  assert.equal((await receive('stale')).result,-995);
  late();assert.equal(h.exports.tone_status(fresh,0),0);
  assert.equal(h.exports.tone_retire(2,11,1),0);
  const link=new WorkerLink({slot:4,memory:h.memory,module:h.module,sigs,broker});link.worker=worker;
  const backend=new GuestThreadHost({hostImports:h.host,log:()=>{}});backend.threadLinks.set(4,link);
  const stopped=backend.stop();
  assert.equal(h.exports.tone_status(fresh,0),-6,'output retired before native Worker termination');
  await stopped;assert.equal(link.worker,null);assert.equal(worker.threadId,-1);
  assert.equal(h.exports.tone_owned(750,100,2,12,1),-995);
  assert.equal(workerFailure,undefined);
 }finally{await worker.terminate();}
 h.hostCtx.stopAudio();
 console.log('Beep compiled lifecycle imports, sibling broker and actual OS Worker retirement: PASS (controlled audio, no hardware claim)');
})().catch(e=>{console.error(e);process.exitCode=1;});

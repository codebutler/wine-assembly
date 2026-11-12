'use strict';
const assert=require('node:assert/strict');
const {invokeNeQtSync}=require('../lib/ne-invoke');
const {ThreadManager}=require('../lib/thread-manager');
const {observeNeQtRun}=require('./helpers/ne-qt-run-observer');
function fixture({begin=true,result=1n,yieldReason=0,settle=true,trap=false}={}) {
  const calls=[];
  return {calls,e:{
    win16_guest_request_valid:t=>t===7n,
    win16_bridge_frame_begin(){calls.push('frame');return 8n;},
    win16_bridge_qt_begin(t,target){assert.equal(t,8n);assert.equal(target,0x12340042);calls.push('begin');return begin;},
    run(n){assert(n>0&&n<=2);calls.push('run');if(trap)throw new Error('guest trap');},
    win16_bridge_qt_result:()=>result,get_yield_reason:()=>yieldReason,
    win16_guest_qt_settle(request,t){assert.equal(request,7n);assert.equal(t,8n);calls.push('settle');return settle;},
    win16_bridge_frame_end(t){assert.equal(t,8n);calls.push('end');return 1;},
  }};
}
const invoke=(f,options={})=>invokeNeQtSync(f.e,7n,0x12340042,{maxBlocks:4,sliceBlocks:2,...options});
let f=fixture();invoke(f);assert.deepEqual(f.calls,['frame','begin','run','settle']);
for(const [config,pattern] of [
  [{begin:false},/ownership rejected/],[{result:-1n},/budget exhausted/],
  [{result:-1n,yieldReason:5},/Unsupported QT/],[{settle:false},/settlement rejected/],
  [{trap:true},/guest trap/],
]) {
  f=fixture(config);assert.throws(()=>invoke(f),pattern);
  assert.equal(f.calls.at(-1),'end');assert.equal(f.calls.filter(c=>c==='end').length,1);
}
f=fixture();assert.throws(()=>invoke(f,{signal:{aborted:true,reason:new Error('cancel')}}),/cancel/);
assert.deepEqual(f.calls,[]);
f=fixture();const run=f.e.run;let aborted=false;f.e.run=n=>{run(n);aborted=true;};
assert.throws(()=>invoke(f,{signal:{get aborted(){return aborted;}}}),/cancelled/);
assert.deepEqual(f.calls,['frame','begin','run','end'],'cancellation before settlement restores frame');
for(const options of [{maxBlocks:0},{sliceBlocks:5},{stackWords:[]},{serviceYield:()=>{}}]) {
  f=fixture();assert.throws(()=>invoke(f,options));assert.deepEqual(f.calls,[]);
}
console.log('PASS QT driver bounded execution, cancellation, failure teardown and native-only settlement');

// Use the production get-only facade without instantiating Wasm or a guest.
// Every forwarded function must retain its scoped caller and retirement gate.
f=fixture();
const manager=Object.create(ThreadManager.prototype),callerExports={};
manager._runningThreadHandle=99;
for(const [name,fn] of Object.entries(f.e))callerExports[name]=(...args)=>{
  assert.equal(manager._runningThreadHandle,123,'forwarded export owns caller');
  return fn(...args);
};
const thread={instance:{exports:callerExports},state:'active'};
manager.threads=new Map([[123,thread]]);
const cooperative=manager.cooperativeCallbackExports(thread);
assert.deepEqual(Object.keys(cooperative),[],'production facade has no enumerable exports');
assert.throws(()=>invoke({e:{...cooperative,run:()=>{}}}),/win16_guest_request_valid/,
  'original spread loses non-run exports');
let cancelled=false;
const observed=observeNeQtRun(cooperative,()=>{
  assert.equal(manager._runningThreadHandle,99,'observer runs after owner restoration');
  cancelled=true;
});
assert.equal(typeof observed.win16_bridge_frame_begin,'function');
assert.throws(()=>invoke({e:observed},{signal:{get aborted(){return cancelled;}}}),/cancelled/);
assert.deepEqual(f.calls,['frame','begin','run','end']);
assert.equal(manager._runningThreadHandle,99);
thread.state='exited';assert.throws(()=>observed.win16_guest_request_valid(7n),/retired/);
assert.equal(manager._runningThreadHandle,99);
console.log('PASS QT cancellation observer forwards production cooperative exports, owner scope and retirement checks');

'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const [tool,runnerPath,schedPath]=process.argv.slice(2),o=require(tool);
const runner=fs.readFileSync(runnerPath,'utf8'),sched=fs.readFileSync(schedPath,'utf8');
assert.equal(crypto.createHash('sha256').update(sched).digest('hex'),o.SCHEDULER);
assert(runner.includes('threadManager = new ThreadManager(wasmModule, memory, instance, makeWorkerImports, {'));
function fixture({esp=0x401000,image=0x400000,ip=0x75040f8,reason=8,id=934,missing=false,fail=false,cap={}}={}) {
 const buffer=new SharedArrayBuffer(0x18000),data=new DataView(buffer),snapshot=()=>Buffer.from(new Uint8Array(buffer));
 const calls=[],lines=[],token={},error={},e=Object.create(null);let nextThrow=false;
 const state={eip:ip,esp,yield_reason:reason,last_run_halt:4,yield_flag:0};
 for(const [k,v] of Object.entries(state))e['get_'+k]=()=>v;
 e.get_image_base=()=>image;e.get_count=()=>972;e.get_thunk_base=()=>0x7500000;e.get_thunk_end=()=>0x7505000;
 if(!missing)e.thunk_word=(addr,n)=>{assert.equal(addr,ip);return n?id:0x1234;};
 const forbidden=()=>{throw Error('forbidden mutator/translation');};
 for(const name of ['clear_yield','clear_counts','guest_write32','guest_read32','guest_to_wasm','clear_cache'])e[name]=forbidden;
 e.run=function(...args){calls.push({receiver:this,args});if(nextThrow)throw error;return token;};
 Object.freeze(e);
 // Real exports accessor is on the instance prototype, with immutable own export data descriptors.
 const proto={};Object.defineProperty(proto,'exports',{get(){assert.equal(this,instance);return e;}});
 const instance=Object.create(proto),obs=o.createObserver(line=>{if(fail)throw error;lines.push(JSON.parse(line.slice(line.indexOf('{'))));},cap);
 const wrapped=obs.wrapInstance(instance,{buffer});
 const put=(guest,words)=>words.forEach((v,i)=>data.setUint32(((guest-image+0x12000)>>>0)+i*4,v,true));
 return {e,instance,wrapped,obs,lines,calls,token,error,put,snapshot,throwNext:()=>nextThrow=true};
}
const f=fixture();f.put(0x401000,[0x7a3366,0,0x402000,0,0,0x403000]);f.put(0x402000,[2,11,22]);f.put(0x403000,[0,500]);
const before=f.snapshot();assert.equal(f.wrapped.exports,f.wrapped.exports);assert.equal(Object.getPrototypeOf(f.wrapped.exports),null);
for(const k of Object.keys(f.e))if(k!=='run'){assert.equal(f.wrapped.exports[k],f.e[k]);assert.deepEqual(Object.getOwnPropertyDescriptor(f.wrapped.exports,k),Object.getOwnPropertyDescriptor(f.e,k));}
assert.equal(f.wrapped.exports.run(123,456),f.token);assert.equal(f.calls[0].receiver,f.e);assert.deepEqual(f.calls[0].args,[123,456]);
const detached=f.wrapped.exports.run;assert.equal(detached.call(null,789),f.token);assert.equal(f.calls[1].receiver,null);
f.throwNext();assert.throws(()=>f.wrapped.exports.run(0),e=>e===f.error);assert.equal(f.calls.length,3);assert.deepEqual(f.snapshot(),before);
assert.deepEqual(f.lines[0].detail.fdSets,[{count:2,prefix:[11,22],truncated:false},'NULL','NULL']);assert.deepEqual(f.lines[0].detail.timeval,[0,500]);
assert.equal(f.lines[1].movCallExecuted,false);assert.equal(f.lines[1].apiResult,'unattributed');assert.equal(f.lines[0].before.selectDeadline,'unavailable');
// Whole stack span must fit actual memory and uint32 guest range, including when affine start wraps.
for(const [opts,expected] of [[{esp:0x405fe8},[0,0,0,0,0,0]],[{esp:0x405fec},'out-of-range'],[{esp:0xfffffff0,image:0xfffe0000},'out-of-range'],[{esp:0x50000000},'out-of-range']]){
 const x=fixture(opts);x.wrapped.exports.run(1);assert.deepEqual(x.lines[0].detail.stack,expected);
}
// Missing metadata is explicitly unverified; conflicting metadata cannot become a select event.
for(const [opts,event] of [[{missing:true},'select-address-net-wait-unverified'],[{id:933},null],[{reason:1},null],[{ip:0x7504100,id:933},null]]){
 const x=fixture(opts);x.wrapped.exports.run(1);assert.equal(x.lines.length>0,!!event);if(event)assert(x.lines[0].events.includes(event));
}
for(const opts of [{fail:true},{cap:{maxBytes:0}},{cap:{maxRecords:0}}]){
 const x=fixture(opts);assert.equal(x.wrapped.exports.run(7),x.token);x.throwNext();assert.throws(()=>x.wrapped.exports.run(8),e=>e===x.error);assert.equal(x.calls.length,2);
}
// Source-bound rejecting controls: our receiver and safety assertions reject actual observer mutations.
let rejected=0;const source=o.createObserver.toString();
for(const [from,to,oracle] of [
 ['this === facade ? e : this','this',factory=>{const x=fixture();const w=factory(()=>{}).wrapInstance(x.instance,{buffer:new SharedArrayBuffer(0x18000)});w.exports.run(1);assert.equal(x.calls[0].receiver,x.e);}],
 ['start + length > buffer.byteLength','false',factory=>{const x=fixture({esp:0x405fec});const lines=[];factory(s=>lines.push(JSON.parse(s.slice(s.indexOf('{'))))).wrapInstance(x.instance,{buffer:new SharedArrayBuffer(0x18000)}).exports.run(1);assert.equal(lines[0].detail.stack,'out-of-range');}],
 ["meta[1] === 934","meta[1] === 933",factory=>{const x=fixture({id:933});const lines=[];factory(s=>lines.push(s)).wrapInstance(x.instance,{buffer:new SharedArrayBuffer(0x18000)}).exports.run(1);assert.equal(lines.length,0);}]
]){assert(source.includes(from));const mutant=vm.runInNewContext('('+source.replaceAll(from,to)+')',{Buffer});assert.throws(()=>oracle(mutant));rejected++;}
console.log(JSON.stringify({status:'PASS',qualification:'offline JS only, no native module',controls:['null-prototype frozen exports and prototype accessor','non-run identity/descriptors','run receiver/args/return/exception identity','SharedArrayBuffer immutable bytes','whole spans and guest wrap rejection','metadata conflict and fallback','caps/logger failure preserve run'],rejectingControls:rejected}));

'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const Capture = require('./d3d9-layout-capture');
const {Bridge} = require('../lib/d3d9-host');
const Rpc = require('../lib/guest-rpc');
const Regions = require('../lib/region-map.generated');
const {g2w} = require('../lib/mem-utils');

// Only a few pages are touched. No module, GPU, guest, worker or renderer runs.
function fixture() {
  const memory = {buffer:new SharedArrayBuffer(Regions.BASE.THREAD_RPC + Regions.SIZE.THREAD_RPC)};
  const view = new DataView(memory.buffer), put = (p,v) => view.setUint32(p,v,true);
  const program = 0x90000000, programWA = 0x100000, device = 0x410000, descriptor = 0x20000;
  // Real packed-PTE translation, with non-affine high guest address.
  for (let page=0;page<8;page++)
    put(Regions.BASE.GUEST_PAGE_TABLE + ((program>>>12)+page)*4, (programWA+page*4096)|0x800);
  const exports = {guest_to_wasm:a=>g2w(a,0x400000,memory),get_current_thread_id:()=>19,
    get_esp:()=>0x420000,get_eax:()=>0};
  put(exports.guest_to_wasm(device+4),3);
  put(Regions.BASE.DX_OBJECTS+3*32,20); put(Regions.BASE.DX_OBJECTS+3*32+20,program);
  put(descriptor,device);put(descriptor+4,program);put(descriptor+40,0x430000);
  const capture = Capture.create({identity:{source:'synthetic-only'},getMemory:()=>memory.buffer,
    getExports:()=>exports});
  const bridge = new Bridge({getMemory:()=>memory.buffer,guestToWasm:exports.guest_to_wasm});
  // Existing entry avoids device construction; real draw validation still runs.
  bridge.devices.set(device,{});
  capture.attachHost(bridge);
  return {memory,put,exports,program,programWA,device,descriptor,capture,bridge};
}

test('actual broker dispatch reaches real Bridge exact layout read with scoped origin',()=>{
  const f=fixture();
  let receiver = 'not called';
  const imports={gpu_gl_call:function(...args){receiver=this;return f.bridge.call(...args);}};
  const broker=Rpc.createMainBroker(f.memory,slot=>f.capture.brokerTable(imports,slot),
    {gpu_gl_call:{params:['i32','i32','i32'],results:['i32']}},{});
  const v=Rpc.views(f.memory,4).i32;
  v[Rpc.SLOT.FN]=0;v[Rpc.SLOT.ARGC]=3;
  v[Rpc.SLOT.ARGS]=0x30001;v[Rpc.SLOT.ARGS+1]=f.descriptor;
  Atomics.store(v,Rpc.SLOT.STATUS,Rpc.STATUS_REQ);
  assert.equal(broker.serveRpc(4),true);
  assert.equal(receiver,undefined,'instrumentation preserves the real broker receiver');
  assert.equal(v[Rpc.SLOT.RESULT],-1);
  assert.match(f.bridge.lastError.message,/FVF 0/);
  const packet=f.capture.snapshot(), host=packet.observers[0];
  assert.equal(packet.crossBoundaryPairingQualified,false);
  assert.equal(packet.producerAttributionQualified,false);
  assert.equal(host.observerErrors,0);
  const read=host.records.find(r=>r.kind==='host-read');
  assert.deepEqual(read.thread,{slot:4,id:null});assert.equal(read.correlation,null);
  assert.equal(read.program,f.programWA);assert.equal(read.declaration,0);assert.equal(read.fvf,0);
  assert.equal(host.records[0].state.program,f.program);
  assert.ok(f.capture.dispose().every(Boolean));
  assert.equal(Object.hasOwn(f.bridge.options,'onLayoutRead'),false);
});

test('worker import adapters use real translator and actual thread getter; unmapped words disqualify',()=>{
  const f=fixture(), imports={gpu_gl_call:()=>1,log(){},log_i32(){},log_api_exit(){}};
  const worker=f.capture.installWorker(imports,[],()=>f.exports,7);
  assert.equal(imports.gpu_gl_call(0x30001,f.descriptor,0),1);
  const event=worker.snapshot().records[0];
  assert.deepEqual(event.thread,{slot:7,id:19});assert.equal(event.state.program,f.program);
  assert.equal(event.correlation,null);
  f.put(f.descriptor+4,0xa0000000);
  assert.equal(imports.gpu_gl_call(0x30001,f.descriptor,0),1);
  assert.equal(worker.snapshot().pairingDisqualified,true);
  assert.ok(f.capture.dispose().every(Boolean));
});

test('nested and throwing origin scopes restore and later callback owners survive disposal',()=>{
  const f=fixture(), marker={};
  const read=()=>f.bridge.options.onLayoutRead({address:1,program:2,declaration:3,fvf:4});
  const inner=f.capture.brokerTable({gpu_gl_call(){read();throw marker;}},8,()=>31);
  const outer=f.capture.brokerTable({gpu_gl_call(){
    read();assert.throws(()=>inner.gpu_gl_call(),e=>e===marker);read();return 91;
  }},2,()=>11);
  assert.equal(outer.gpu_gl_call(),91);read();
  assert.deepEqual(f.capture.snapshot().observers[0].records.map(r=>r.thread),
    [{slot:2,id:11},{slot:8,id:31},{slot:2,id:11},null]);
  const later=()=>{}; f.bridge.options.onLayoutRead=later;
  assert.ok(f.capture.dispose().includes(false));assert.equal(f.bridge.options.onLayoutRead,later);
});

test('failed host installation restores existing callback descriptor',()=>{
  const capture=Capture.create({getMemory:()=>new ArrayBuffer(4096),getExports:()=>({})});
  const previous=()=>{}, options={};
  Object.defineProperty(options,'onLayoutRead',{value:previous,writable:true,configurable:true,enumerable:false});
  const before=Object.getOwnPropertyDescriptor(options,'onLayoutRead');
  const bridge={options};
  Object.defineProperty(bridge,'call',{value(){return 7;},writable:false,configurable:false});
  assert.throws(()=>capture.attachHost(bridge),TypeError);
  assert.deepEqual(Object.getOwnPropertyDescriptor(options,'onLayoutRead'),before);
  assert.equal(bridge.call(),7);
  assert.ok(capture.dispose().every(Boolean));
});

test('identity hashes supplied exact bytes and reads real source checkout state',()=>{
  const bytes=Buffer.from('synthetic module bytes, not a guest capture');
  const pinned=Capture.identity({moduleBytes:bytes,repository:__dirname,runId:'synthetic-only'});
  assert.equal(pinned.moduleSHA256,createHash('sha256').update(bytes).digest('hex'));
  assert.match(pinned.sourceCommit,/^[a-f0-9]{40}$/);assert.equal(typeof pinned.sourceDirty,'boolean');
  bytes.fill(0);assert.notEqual(pinned.moduleSHA256,createHash('sha256').update(bytes).digest('hex'));
});

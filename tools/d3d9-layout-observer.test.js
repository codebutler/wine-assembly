'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {create} = require('./d3d9-layout-observer');
function fixture(capacity = 32) {
  const memory = new ArrayBuffer(200000), view = new DataView(memory);
  const put = (a,v) => view.setUint32(a,v,true);
  let program = 2000;
  const observer = create({capacity, getMemory:()=>memory, g2w:x=>x,
    resolveProgram:()=>program, getThread:()=>({slot:2, id:7}), identity:{source:'synthetic-only'}});
  put(2000+21780,7); put(2000+8,88); put(2000,99);
  put(300,1000); put(304,2000);
  return {observer,put,memory, setProgram:v=>program=v};
}
test('recorded state is separate, Capture derives owner, Reset resolves new program',()=>{
  const f=fixture(), o=f.observer, block=50000;
  f.put(block+8,1000); f.put(block+18936,1); f.put(block+18944,258);
  f.put(2000+1740,block);
  const t=o.apiEnter('IDirect3DStateBlock9_Capture',[block]);
  f.put(block+18940,88); o.apiExit(t,0);
  let records=o.snapshot().records;
  assert.equal(records[0].device,1000); assert.equal(records[0].state.declaration,88);
  assert.equal(records[0].state.recording.fvf,258); assert.equal(records[1].block.declaration,88);
  const r=o.apiEnter('IDirect3DDevice9_Reset',[1000,123]);
  f.setProgram(90000); o.apiExit(r,0);
  records=o.snapshot().records;
  assert.equal(records[2].state.program,2000); assert.equal(records[3].state.program,90000);
});
test('issue, exact read, rejection ring freezes; receiver, return, exceptions survive',()=>{
  const f=fixture(8), o=f.observer;
  let calls=0;
  const host={n:3, call(op,ptr,aux){assert.equal(this.n,3); assert.deepEqual([op,ptr,aux],[0x30001,300,4]); calls++; o.hostRead({address:ptr,program:2000,declaration:0,fvf:0},'rpc-9'); return -1;}};
  const original=host.call;
  o.installGPU(host,'call','host-entry',()=> 'rpc-9');
  const worker={gpu(op,p,a){return host.call(op,p,a);}};
  o.installGPU(worker,'gpu','draw-issue',()=> 'rpc-9');
  for(let i=0;i<20;i++){const t=o.apiEnter('IDirect3DDevice9_SetFVF',[1000,258]);o.apiExit(t,0);}
  assert.equal(worker.gpu(0x30001,300,4),-1);
  let snapshot=o.snapshot(); assert.equal(snapshot.frozen,true);assert.equal(snapshot.records.length,8);
  assert.equal(snapshot.records.at(-2).kind,'host-read'); assert.equal(snapshot.records.at(-2).declaration,0);
  assert.equal(snapshot.records.at(-3).descriptorState.declaration,88);
  worker.gpu(0x30001,300,4); assert.equal(calls,2);assert.deepEqual(o.snapshot(),snapshot);
  assert.deepEqual(o.dispose(),[true,true]); assert.equal(host.call,original);
  const g=fixture(), error={same:'object'}, throwing={call(){throw error;}};
  g.observer.installGPU(throwing,'call','draw-issue');
  assert.throws(()=>throwing.call(0x30001,300,4), e=>e===error);
  assert.equal(g.observer.snapshot().frozen,true);
});
test('invalid observation cannot change call; restoration preserves later wrapper',()=>{
  const f=fixture(), o=f.observer;
  const obj={call(){return 123;}};
  o.installGPU(obj,'call','draw-issue');assert.equal(obj.call(0x30001,0xffffffff),123);
  assert.ok(o.snapshot().observerErrors>0);
  const next=()=>456;obj.call=next;assert.deepEqual(o.dispose(),[false]);assert.equal(obj.call,next);
});
test('import adapters decode ordinal and args, keep original callbacks and restore',()=>{
  const f=fixture(), o=f.observer, bytes=new Uint8Array(f.memory);
  bytes.set(Buffer.from('<ord>'),500);f.put(804,1000);f.put(808,0);
  let calls=0;const imports={log(){calls++;return 41;},log_i32(){calls++;},log_api_exit(){calls++;return 42;}};
  const table=[{id:0,name:'IDirect3DDevice9_SetFVF',nargs:2}];
  o.installAPI(imports,table,()=>({get_esp:()=>800,get_eax:()=>0}));
  imports.log_i32(0xc0de0000);assert.equal(imports.log(500,5),41);assert.equal(imports.log_api_exit(),42);
  assert.equal(calls,3);const records=o.snapshot().records;
  assert.deepEqual(records[0].args,[1000,0]);assert.equal(records[1].result,0);
  o.dispose();
});
test('exact-read production hook uses captured locals, isolates callback errors',()=>{
  // Execute the exact production read/hook/validation prefix with synthetic words.
  const fs=require('node:fs');const source=fs.readFileSync(require.resolve('../lib/d3d9-host.js'),'utf8');
  const start=source.indexOf('        const declaration=u32(program+8), fvf = u32(program+12);');
  const end=source.indexOf('        const primitive = ',start);
  assert.ok(start>=0 && end>start);
  const run=new Function('u32','program','address',source.slice(start,end)+'return [declaration,fvf];');
  let reads=0;const u32=p=>{reads++;return p===2008?88:0;};
  const expected=run.call({options:{}},u32,2000,300);assert.deepEqual(expected,[88,0]);
  let captured;assert.deepEqual(run.call({options:{onLayoutRead:v=>{captured=v;throw Error('observer');}}},u32,2000,300),expected);
  assert.deepEqual(captured,{address:300,program:2000,declaration:88,fvf:0});assert.equal(reads,4);
  for(const options of [{},{onLayoutRead:()=>{throw Error('observer');}}])
    assert.throws(()=>run.call({options},()=>0,2000,300),/D3D9 FVF 0 is not implemented/);
});
test('metadata and arguments are detached before callers can mutate frozen evidence',()=>{
  const memory=new ArrayBuffer(100000), view=new DataView(memory);
  view.setUint32(300,1000,true);view.setUint32(304,2000,true);
  const identity={source:'original', nested:{module:'hash'}}, thread={slot:1, detail:{id:7}}, correlation={request:[9]};
  const o=create({getMemory:()=>memory,g2w:x=>x,resolveProgram:()=>2000,getThread:()=>thread,identity});
  identity.source='changed-before-record';identity.nested.module='changed';
  const token=o.apiEnter('IDirect3DDevice9_SetFVF',[1000,258]);
  token.args[1]=999;
  const host={call(){return -1;}};
  o.installGPU(host,'call','host-entry',()=>correlation);
  host.call(0x30001,300,0);
  const before=o.snapshot();
  assert.equal(before.identity.source,'original');assert.equal(before.identity.nested.module,'hash');
  assert.equal(before.records[0].args[1],258);assert.equal(before.pairingDisqualified,false);
  thread.detail.id=99;thread.slot=99;correlation.request[0]=99;identity.source='changed-after-freeze';
  assert.deepEqual(o.snapshot(),before);
  before.records[0].thread.slot=200;assert.equal(o.snapshot().records[0].thread.slot,1);
});
test('invalid or oversized metadata is bounded and explicitly disqualifies pairing',()=>{
  for(const metadata of [{text:'x'.repeat(4097)}, {list:Array(33).fill(1)}, {number:NaN}, {big:1n}]) {
    const o=create({getMemory:()=>new ArrayBuffer(256),g2w:x=>x,resolveProgram:()=>0,getThread:()=>null,identity:metadata});
    assert.equal(o.snapshot().identity,null);assert.equal(o.snapshot().pairingDisqualified,true);
  }
  const cycle={};cycle.self=cycle;
  const o=create({getMemory:()=>new ArrayBuffer(256),g2w:x=>x,resolveProgram:()=>0,getThread:()=>cycle});
  o.apiEnter('IDirect3DDevice9_SetFVF',[1000,0]);
  const snap=o.snapshot();assert.equal(snap.records[0].thread,null);assert.equal(snap.pairingDisqualified,true);
  let invoked=false;
  const metadata={get value(){invoked=true;return 5;}};
  const bad=create({getMemory:()=>new ArrayBuffer(256),g2w:x=>x,resolveProgram:()=>0,getThread:()=>null,identity:metadata});
  assert.equal(invoked,false);assert.equal(bad.snapshot().pairingDisqualified,true);
});

'use strict';
const assert=require('node:assert/strict'),{test}=require('node:test');const {installEmissionObserver}=require('../tools/hype-glide-emission-observer');
function fixture(options={}) { const memory={buffer:new ArrayBuffer(8192)}, records=[],calls=[]; const ex={get_current_thread_id:()=>17,get_eip:()=>512,get_esp:()=>768,get_image_base:()=>0x400000,guest_to_wasm:a=>a};const owner={ex,memory,slot:2,pureG2w:a=>a};const host={log(){return 71},glide_submit(...a){calls.push({receiver:this,args:a});if(options.throw)throw options.throw;return 1},get_key_down_state(){return 0x8000}};let t=10;const obs=installEmissionObserver(host,()=>{if(options.ownerThrow)throw Error('owner');return owner},x=>records.push(x),()=>t);const dv=new DataView(memory.buffer);dv.setUint32(2048,5,true);dv.setUint32(2052,436,true);return {host,obs,records,calls,owner,dv,tick:v=>t=v,arm:()=>host.get_key_down_state(32)}; }
test('actual emitting owner and buffered draw format; no pre-Space read',()=>{const f=fixture();f.host.glide_submit(0,2048,444);assert.equal(f.records.length,0);f.arm();f.host.glide_submit(0,2048,444);const r=f.records[1];assert.equal(r.slot,2);assert.equal(r.counts[5],1);assert.equal(r.flushStack.address,768);assert.match(r.attribution,/flush caller only/);assert.equal(f.calls[1].receiver,f.host);assert.deepEqual(f.calls[1].args,[0,2048,444]);});
test('original exception survives observer and report',()=>{const error=Error('real');const f=fixture({throw:error});f.arm();assert.throws(()=>f.host.glide_submit(4,2048,256),e=>e===error);assert.equal(f.records[1].originalError,'Error: real');});
test('malformed pointer/record cannot prevent real forwarding',()=>{for(const args of [[0,8190,8],[0,2048,12],[0,-1,0]]){const f=fixture();f.arm();assert.equal(f.host.glide_submit(...args),1);assert.equal(f.records[1].kind,'observer-error');assert.equal(f.calls.length,1);}});
test('owner capture failure preserves actual import result',()=>{const f=fixture({ownerThrow:true});f.arm();assert.equal(f.host.glide_submit(4,2048,256),1);assert.equal(f.records[1].kind,'observer-error');});
test('bounded imports and time do not alter forwarding',()=>{const f=fixture();f.arm();for(let i=0;i<100;i++)f.host.glide_submit(0,2048,444);assert.equal(f.obs.summary().events,40);assert.equal(f.records.filter(r=>r.kind==='cap').length,1);assert.equal(f.calls.length,100);f.tick(4000);f.host.glide_submit(4,2048,256);assert.equal(f.obs.summary().events,40);});
test('eight swaps bound captures, cleanup preserves foreign hooks',()=>{const f=fixture();f.arm();for(let i=0;i<10;i++)f.host.glide_submit(4,2048,256);assert.equal(f.obs.summary().events,8);const foreign=()=>3;f.host.glide_submit=foreign;f.obs.close();assert.equal(f.host.glide_submit,foreign);assert.equal(f.records.at(-1).kind,'cleanup-error');});

test('unmapped read never invokes potentially mutating WASM mapper',()=>{const f=fixture();f.owner.ex.guest_to_wasm=()=>{throw Error('must never call guest mapper')};f.owner.pureG2w=require('../lib/mem-utils').g2w;f.owner.ex.get_esp=()=>0xf0000000;f.arm();f.host.glide_submit(4,2048,256);assert.equal(f.records[1].flushStack.absent,'unmapped guest byte');assert.equal(f.calls.length,1);});
test('mapping changes during byte read are rejected',()=>{const f=fixture();let n=0;f.owner.pureG2w=a=>++n>192?a+1:a;f.arm();f.host.glide_submit(4,2048,256);assert.equal(f.records[1].flushStack.absent,'mapping changed during read');});

test('real log hook observes bounded draw entry after swap without toggling guest logging',()=>{const f=fixture();const name=Buffer.from('_grDrawVertexArrayContiguous@16');new Uint8Array(f.owner.memory.buffer).set(name,4096);f.arm();f.host.glide_submit(4,2048,256);for(let i=0;i<8;i++)assert.equal(f.host.log(4096,name.length),71);const rows=f.records.filter(r=>r.kind==='draw-entry');assert.equal(rows.length,4);assert.equal(rows[0].afterSwap,1);assert.equal(rows[0].api,'_grDrawVertexArrayContiguous@16');});
test('tiny full draw payload retained with exact length',()=>{const f=fixture();f.arm();f.host.glide_submit(0,2048,444);assert.equal(f.records[1].records[0].payloadHex.length,436*2);});

const {validateHypeMeasurement}=require('../tools/hype-glide-emission-observer');
// Independent arithmetic fixtures, NOT new Hype measurements. Distinct counters
// intentionally disprove an implicit swaps/2 conversion.
function measurementFixture() {
  return {
    source:'synthetic regression fixture; no guest executed',
    environment:'browser', moduleSha256:'a'.repeat(64),
    clock:{kind:'host-monotonic',api:'performance.now',unit:'ms',synthetic:false,
      origin:'page-1',source:'fixture paired performance.now samples'},
    counter:{kind:'logical-game-frame',address:0x43f610,exeSha256:'b'.repeat(64),
      liveCodeVerified:true,source:'fixture authenticated callback identity'},
    coverage:{continuous:true,resetFree:true,enabledThroughout:true,source:'fixture lifecycle log'},
    gameplay:{continuous:true,ordinaryInput:true,source:'fixture continuous scene review'},
    samples:[
      {hostMs:1250,count:100,swaps:200,enabled:true,generation:'epoch-1',
        owner:{instance:'worker-1',thread:1},clockOrigin:'page-1'},
      {hostMs:2250,count:115,swaps:231,enabled:true,generation:'epoch-1',
        owner:{instance:'worker-1',thread:1},clockOrigin:'page-1'},
      {hostMs:3250,count:130,swaps:262,enabled:true,generation:'epoch-1',
        owner:{instance:'worker-1',thread:1},clockOrigin:'page-1'}
    ]
  };
}
test('wall-clock examples use full actual interval and logical delta, never swaps/2',()=>{
  const w=measurementFixture(), before=structuredClone(w), r=validateHypeMeasurement(w);
  assert.equal(r.accepted,true); assert.equal(r.fps,15);
  assert.equal(r.durationMs,2000); assert.equal(r.logicalFrames,30);
  assert.equal(r.glideSwaps,62); assert.equal(r.glideSwapsPerSecond,31);
  assert.equal(r.displayedFps,null); assert.deepEqual(r.raw,before);
  assert.equal(r.source,w.source); assert.deepEqual(w,before);
  w.samples[0].count=0; assert.equal(r.raw.samples[0].count,100);
  const slow=measurementFixture();
  slow.samples=[slow.samples[0],{...slow.samples[2],hostMs:9250,count:120}];
  slow.requestedDurationMs=1000; // Requested duration is not a denominator.
  assert.equal(validateHypeMeasurement(slow).fps,2.5);
});
test('enabled zero frame delta is zero FPS; optional swaps never supply missing frames',()=>{
  const w=measurementFixture();
  for(const s of w.samples){s.count=100; delete s.swaps;}
  const r=validateHypeMeasurement(w);
  assert.equal(r.accepted,true); assert.equal(r.fps,0); assert.equal(r.glideSwapsPerSecond,null);
  delete w.samples[1].count;
  assert.equal(validateHypeMeasurement(w).fps,null);
});
test('historical artificial 200ms batch clock is rejected without changing raw evidence',()=>{
  const w=measurementFixture();
  w.source='docs/re-notes/hype.md 2026-10-10; historical counts reconstructed, raw run absent locally';
  w.environment='cli';
  w.clock={kind:'guest-batch',api:'batch * tickMsPerBatch',unit:'ms',synthetic:true,
    origin:'guest',source:'historical --tick-ms-per-batch=200'};
  w.tickMsPerBatch=200;
  w.samples=[{...w.samples[0],batch:6921,hostMs:6921*200,count:0,swaps:0,clockOrigin:'guest'},
    {...w.samples[2],batch:7421,hostMs:7421*200,count:99,swaps:196,clockOrigin:'guest'}];
  const r=validateHypeMeasurement(w);
  assert.equal(r.accepted,false); assert.equal(r.fps,null); assert.equal(r.glideSwapsPerSecond,null);
  assert.ok(r.reasons.includes('real monotonic host clock provenance missing'));
  assert.deepEqual(r.raw,w);
});
const invalidMeasurements = [
  ['guest clock kind',w=>w.clock.kind='guest'],
  ['guest clock API',w=>w.clock.api='GetTickCount'],
  ['CPU clock',w=>w.clock.api='process.cpuUsage'],
  ['epoch wall clock',w=>w.clock.api='Date.now'],
  ['synthetic clock',w=>w.clock.synthetic=true],
  ['unknown synthetic state',w=>delete w.clock.synthetic],
  ['wrong clock unit',w=>w.clock.unit='seconds'],
  ['clock source absent',w=>delete w.clock.source],
  ['clock domain changes',w=>w.samples[1].clockOrigin='other-page'],
  ['backwards interior clock',w=>w.samples[1].hostMs=1000],
  ['zero interior interval',w=>w.samples[1].hostMs=w.samples[0].hostMs],
  ['zero total duration',w=>w.samples.at(-1).hostMs=w.samples[0].hostMs],
  ['missing clock',w=>delete w.samples[1].hostMs],
  ['NaN clock',w=>w.samples[1].hostMs=NaN],
  ['infinite clock',w=>w.samples.at(-1).hostMs=Infinity],
  ['disabled counter at start',w=>w.samples[0].enabled=false],
  ['disabled counter inside interval',w=>w.samples[1].enabled=false],
  ['disabled counter at end',w=>w.samples.at(-1).enabled=false],
  ['unknown enable state',w=>delete w.samples[0].enabled],
  ['interior coverage absent',w=>delete w.coverage],
  ['interior enable gap',w=>w.coverage.enabledThroughout=false],
  ['reset even with increasing final count',w=>w.samples[1].generation='epoch-2'],
  ['missing reset epoch',w=>delete w.samples[0].generation],
  ['reset reported by coverage',w=>w.coverage.resetFree=false],
  ['count decrease',w=>w.samples[1].count=99],
  ['count wrap',w=>w.samples[0].count=0xffffffff],
  ['missing counter',w=>delete w.counter],
  ['missing count',w=>delete w.samples.at(-1).count],
  ['negative count',w=>w.samples[0].count=-1],
  ['fractional count',w=>w.samples[1].count=100.5],
  ['unsafe count',w=>w.samples.at(-1).count=Number.MAX_SAFE_INTEGER+1],
  ['swap as frame counter',w=>w.counter.kind='glide-swaps'],
  ['wrong callback',w=>w.counter.address=0x467180],
  ['unauthenticated callback',w=>w.counter.liveCodeVerified=false],
  ['unknown EXE',w=>delete w.counter.exeSha256],
  ['unknown module',w=>delete w.moduleSha256],
  ['unknown counter source',w=>delete w.counter.source],
  ['unknown receipt source',w=>delete w.source],
  ['unattributed owner',w=>delete w.samples[1].owner],
  ['different owner instance',w=>w.samples[1].owner.instance='worker-2'],
  ['different owner thread',w=>w.samples[1].owner.thread=2],
  ['negative owner thread',w=>w.samples[0].owner.thread=-1],
  ['not continuous gameplay',w=>w.gameplay.continuous=false],
  ['no normal input review',w=>w.gameplay.ordinaryInput=false],
  ['missing scene evidence',w=>delete w.gameplay.source],
  ['missing swap sample',w=>delete w.samples[1].swaps],
  ['swap reset',w=>w.samples[1].swaps=199],
  ['only one sample',w=>w.samples.pop() && w.samples.pop()],
  ['null interior sample',w=>w.samples[1]=null],
  ['missing samples',w=>delete w.samples]
];
for(const [name,mutate] of invalidMeasurements) test(`measurement rejects ${name}`,()=>{
  const w=measurementFixture(); mutate(w);
  const r=validateHypeMeasurement(w);
  assert.equal(r.accepted,false); assert.ok(r.reasons.length>0);
  assert.equal(r.fps,null); assert.equal(r.glideSwapsPerSecond,null);
  assert.deepEqual(r.raw,w);
});
test('absent receipt rejects without fabricating a rate',()=>{
  for(const value of [null,undefined,{},[],0,'']){
    const r=validateHypeMeasurement(value);
    assert.equal(r.accepted,false); assert.equal(r.fps,null);
  }
});
test('malformed JSON numeric objects reject without coercion or numeric rates',()=>{
  for(const field of ['hostMs','count','swaps']) for(const index of [0,1,2]){
    const w=measurementFixture();
    w.samples[index][field]=JSON.parse('{"valueOf":null,"toString":null}');
    const r=validateHypeMeasurement(w);
    assert.equal(r.accepted,false); assert.ok(r.reasons.length>0);
    assert.equal(r.fps,null); assert.equal(r.glideSwapsPerSecond,null);
    assert.equal(r.durationMs,null); assert.equal(r.logicalFrames,null);
    assert.deepEqual(r.raw,w);
  }
});
test('executable JSON validator emits raw evidence and meaningful exit status',()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
  const {spawnSync}=require('node:child_process');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hype-measurement-'));
  const script=path.resolve(__dirname,'../tools/hype-glide-emission-observer.js');
  const file=path.join(dir,'fixture.json');
  try {
    const w=measurementFixture();
    const run=()=>spawnSync(process.execPath,[script,file],{encoding:'utf8'});
    fs.writeFileSync(file,JSON.stringify(w));
    let r=run(); assert.equal(r.status,0); assert.equal(JSON.parse(r.stdout).fps,15);
    w.samples[1].enabled=false; fs.writeFileSync(file,JSON.stringify(w));
    r=run(); assert.equal(r.status,1); assert.deepEqual(JSON.parse(r.stdout).raw,w);
    w.samples[1].hostMs={valueOf:null,toString:null};
    fs.writeFileSync(file,JSON.stringify(w));
    r=run(); assert.equal(r.status,1); assert.equal(r.stderr,'');
    assert.equal(JSON.parse(r.stdout).fps,null); assert.deepEqual(JSON.parse(r.stdout).raw,w);
    fs.writeFileSync(file,'{'); r=run(); assert.equal(r.status,2); assert.equal(r.stdout,'');
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});

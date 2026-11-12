'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),cp=require('child_process'),path=require('path');
const root=path.resolve(process.argv[2]);
const {createBatchClock}=require(root+'/lib/batch-clock');
const {createGuestClockSource}=require(root+'/lib/guest-clock');
const {createStartupClock}=require(root+'/lib/startup-clock');
const {createInputConsumptionTrace}=require(root+'/test/input-consumption-trace');
const candidate=fs.readFileSync(root+'/test/run.js','utf8');
const baseline=cp.execFileSync('git',['-C',root,'show','adb2852f0ad9944625d809fd9b73c50dc3d4514e:test/run.js'],{maxBuffer:1048576}).toString();
function fixture(src,enabled,real,startup,benchActive){
 const start=src.indexOf('  const batchClock = createBatchClock('),end=src.indexOf('  // --- Override input for test injection ---',start);
 assert(start>=0&&end>start);
 let now=1000;
 const bench={active:benchActive,now:600};
 const c=vm.createContext({createBatchClock,createGuestClockSource:opts=>createGuestClockSource({...opts,now:()=>now}),createStartupClock,createInputConsumptionTrace,
  TICK_MS_PER_BATCH:200,tickCallStepMs:1,gameplayBench:bench,STARTUP_CLOCK_CFG:startup?{factor:0.01,maxMs:30000,endOn:'firstPresent:directdraw'}:null,
  REAL_TICKS:real,TIME_SCALE:2,CLOCK_ORIGIN:1000,TRACE_INPUT_DISPATCH:enabled,CALENDAR_ORIGIN_MS:10000,
  Date:{now:()=>now},console:{log(){}},ctx:{sharedAudio:{}},renderer:{},DX_LOCK_PAUSE:{},VBLANK:{},h:{},logs:[]});
 vm.runInContext(src.slice(start,end),c);
 const api=vm.runInContext('({batchClock,guestClock,startupClock,trace:typeof inputConsumptionTrace==="undefined"?null:inputConsumptionTrace})',c);
 return {...api,c,bench,setNow:n=>now=n};
}
function run(src,enabled,real,startup,bench){
 const f=fixture(src,enabled,real,startup,bench),out=[];
 for(let batch=1;batch<=12;batch++){
  f.batchClock.state.batch=batch; f.setNow(1000+batch*100);f.bench.now=600+batch*200;
  if(batch===5) f.bench.active=false;
  if(batch===9&&startup)f.c.ctx.startupClockEvent('firstPresent:directdraw');
  // Exercise the actual import, worker-local forwarding and renderer stamp.
  for(const read of [()=>f.c.h.get_ticks(),()=>f.c.ctx.guestNowMs(),()=>f.c.renderer._guestNowMs()]){
   const value=read();out.push(value);
   if(f.trace){
    const before=JSON.stringify(f.batchClock.state);
    f.trace.schedule({batch:0,action:'raw'});
    assert.strictEqual(JSON.stringify(f.batchClock.state),before);
    if(enabled)assert(f.c.logs.at(-1).endsWith('lastGuestTick='+value),'all wired reader returns observed');
   }
  }
  out.push(f.c.ctx.guestPeekMs(),f.c.renderer._inputNowMs(),f.c.ctx.sharedAudio.audioClockMs(),f.c.ctx.wallNowMs());
 }
 return JSON.stringify({out,state:f.batchClock.state,startup:f.startupClock.state,hold:f.c.renderer._buttonHoldFloorMs});
}
for(const real of [false,true])for(const startup of [false,true])for(const bench of [false,true]){
 const old=run(baseline,false,real,startup,bench);
 assert.strictEqual(run(candidate,false,real,startup,bench),old,'disabled reader/state differs from accepted main');
 assert.strictEqual(run(candidate,true,real,startup,bench),old,'enabled reader/state differs from accepted main');
}
console.log('PASS 8 clock/startup/bench combinations: exact production initialization through ctx/renderer/audio/calendar wiring; trace on/off returns/state equal accepted main');
// The wrapper must preserve receiver/arguments and only retain successful returns.
const logs=[];let probes=0;
const trace=createInputConsumptionTrace({enabled:true,logs,snapshot:()=>({batch:1,guestMs:0,clock:'batch',lastGuestTick:trace.lastGuestTick})});
const original=function(n){probes++;assert.strictEqual(this.tag,7);if(n<0)throw Error('sentinel');return this.tag+n;};
const wrapped=trace.observeTicks(original), receiver={tag:7,read:wrapped};
assert.strictEqual(trace.lastGuestTick,'unavailable');assert.strictEqual(receiver.read(5),12);
assert.throws(()=>receiver.read(-1),/sentinel/);assert.strictEqual(trace.lastGuestTick,12);assert.strictEqual(probes,2);
trace.schedule({batch:1});assert.strictEqual(probes,2);
const off=createInputConsumptionTrace({enabled:false});assert.strictEqual(off.observeTicks(original),original);
console.log('PASS observer receiver/arguments, exception preserves last successful return, disabled identity and zero snapshot probes');

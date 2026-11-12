'use strict';
// Controlled production pathways, one real instance. Never original-game evidence.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const hook=require('../tools/maelstrom-select-completion-hook.cjs');
const H=path.resolve(__dirname,'../../ops');
const ROOT='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const staticABI=JSON.parse(fs.readFileSync(H+'/static-abi.json'));assert.equal(staticABI.status,'PASS');
const binary=fs.readFileSync(H+'/select-hook.wasm');
assert.equal(sha(binary),staticABI.outputs[0].sha256);assert.equal(binary.length,1880716);
const inventory=Object.fromEntries(staticABI.inventory.map(r=>[r.name,r]));
const IMAGE=0x400000,THUNK=0x75040f8,STALE=0x5a170123;
const direct=a=>a-IMAGE+0x12000;
const sig=Object.fromEntries(staticABI.outputs[0].exports.map(e=>[e.name,e.signature]));
const expected={run:[1,0],init_thread:[8,0],set_count:[2,0],get_count:[1,1],set_eip:[1,0],set_eax:[1,0],set_esp:[1,0],
 set_edi:[1,0],set_yield_state:[2,0],test_vsock_alloc:[0,1],test_vsock_reset:[0,0],set_api_log:[1,0]};
for(const [n,[np,nr]]of Object.entries(expected))assert.deepEqual(sig[n],{params:Array(np).fill('i32'),results:Array(nr).fill('i32')},n);
for(const n of hook.FIELDS)assert.deepEqual(sig['msc_'+n],{params:[],results:['i32']});
assert.deepEqual(sig.msc_start,{params:[],results:[]});
const helpers=[
 ['/tmp/maelstrom-native-recovered-closeout-oct24/repo/test/maelstrom-head-yield-native.cjs','938458b147c43f72a0792a6fd1bf625a4fb8c67e472b3079dda00e7c3deb9a5b'],
 ['/tmp/maelstrom-event-observer-native-qualification-oct24/repo/test/maelstrom-event-boundary-native.cjs','2159e84c0960679855b330adf813f94351cb59f4a5cc09fc9ef27e91b7ce303c']
];helpers.forEach(([p,h])=>assert.equal(sha(fs.readFileSync(p)),h));
// One task's actual mount argv is empty. Reuse the unchanged parser receipt.
const mountReceipt='/tmp/maelstrom-event-observer-native-qualification-oct24/ops/mount-parser.json';
const mounts=JSON.parse(fs.readFileSync(mountReceipt));assert.equal(mounts.pass,true);assert.deepEqual(mounts.actualArgv,[]);assert.deepEqual(mounts.intendedFiles,[]);
assert.deepEqual(mounts.controlTreeFiles,['ordinary.dll','comma,bearing.dll']);
const exportsSource=fs.readFileSync(ROOT+'/src/13-exports.wat','utf8');
assert(exportsSource.includes('Arming the same address twice must not throw the count away.'));
const fixtureSpans=[];
for(const base of [0x480000,0x490000])for(let step=0;step<7;step++){
 const pc=base+step*0x100,fd=base+0x4000+step*0x100,tv=fd+0x40,esp=0x7402000+(base===0x480000?0:0x10000)+step*0x100;
 for(const [kind,a,n]of [['code',pc,16],['return-code',pc+0x20,16],['fdset',fd,32],['timeval',tv,8],['stack',esp-4,32]]){
  assert(direct(a)>=0x12000&&direct(a)+n<0x8000000);fixtureSpans.push({kind,a,n});
 }
}
for(let i=0;i<fixtureSpans.length;i++)for(let j=0;j<i;j++){
 const a=fixtureSpans[i],b=fixtureSpans[j];assert(a.a+a.n<=b.a||b.a+b.n<=a.a,'disjoint fixture spans');
}
const counterFixture=new Map();function arm(i,a){if(counterFixture.get(i)?.a!==a)counterFixture.set(i,{a,count:0});}
arm(0,0x480000);counterFixture.get(0).count=972;arm(0,0x480000);assert.equal(counterFixture.get(0).count,972);
assert.throws(()=>assert.equal(counterFixture.get(0).count,0));arm(0,0x490000);assert.equal(counterFixture.get(0).count,0);
const preflight={status:'PASS',moduleSHA256:sha(binary),moduleBytes:binary.length,fixtureSpans,signatures:expected,
 helperIdentities:helpers,mountReceipt,actualMountArgv:[],intendedMountFiles:[],counterContaminationRejected:true,
 nativeInstances:0,heapMiB:512,arenaMiB:512,limits:'Native CPU90/wall60; synchronous Module guarded at8MiB; one Memory/Instance'};
fs.writeFileSync(H+'/native-preflight.json',JSON.stringify(preflight,null,2));
if(process.argv.includes('--preflight')){console.log(JSON.stringify(preflight));return;}
assert(fs.existsSync(H+'/native-attempt.json'),'exclusive supervisor admission required');
const module_=new WebAssembly.Module(binary);
const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});assert.equal(memory.buffer.byteLength,512*1024*1024);
const imports={},hostCalls=[],unexpected=[];let ticks=1000;
for(const item of WebAssembly.Module.imports(module_)){
 const ns=imports[item.module]||={};
 if(item.kind==='memory'){assert.equal(item.module+'.'+item.name,'host.memory');ns[item.name]=memory;}
 else {assert.equal(item.kind,'function');ns[item.name]=(...args)=>{
  hostCalls.push({name:item.name,args});
  if(item.module==='host'&&['beep_process_begin','beep_thread_begin'].includes(item.name))return 0;
  if(item.module==='host'&&item.name==='get_ticks')return ticks;
  if(item.module==='host'&&item.name==='socket_event'&&args[0]===3)return 0; // Explicit native socket teardown notification only.
  unexpected.push(item.module+'.'+item.name);throw Error('unsupported actual behavioral import '+item.module+'.'+item.name);
 };}
}
const instance=new WebAssembly.Instance(module_,imports),e=instance.exports;
e.init_thread(0,IMAGE,0x480000,0x4a0000,0x7500000,0x7540000,0,1);e.set_api_log(0);e.set_bp(0);
assert.equal(e.get_current_thread_id(),1);assert.equal(e.get_image_base(),IMAGE);assert.equal(e.get_thunk_base(),0x7500000);
const dv=new DataView(memory.buffer),put=(a,bytes)=>new Uint8Array(memory.buffer,direct(a),bytes.length).set(bytes);
const words=(a,ws)=>ws.forEach((w,i)=>dv.setUint32(direct(a)+4*i,w,true));
const word=a=>dv.getUint32(direct(a),true);
words(THUNK,[0x80000001,934]);assert.deepEqual([e.thunk_word(THUNK,0)>>>0,e.thunk_word(THUNK,1)],[0x80000001,934]);
const oracle=hook.createOracle(instance,e),snapshots=[],controls=[],states=[],equivalence=[];
function capture(expectedKind,context){
 const first=hook.snapshot(e),second=hook.snapshot(e);
 if(!snapshots.length){
  const checks=[
   ['forged copy',hook.createOracle(instance,e),instance,{...second}],
   ['stale authentic snapshot',hook.createOracle(instance,e),instance,first],
   ['wrong instance',hook.createOracle(instance,e),{},second],
   ['wrong export source',hook.createOracle(instance,{}),instance,second]
  ];
  for(const [name,o,owner,s]of checks){assert.equal(o.accept(owner,s).kind,'rejected',name);controls.push(name);}
 }
 const s=hook.snapshot(e),accepted=oracle.accept(instance,s);assert.equal(accepted.kind,expectedKind);
 assert.equal(s.api,934);assert.equal(s.thunk,THUNK);assert.equal(s.thread,1);assert.equal(s.regs,inventory.REGFILE.base);
 assert.equal(s.pre,context.pre);assert.equal(s.ret,context.ret);
 assert.equal(s.post,context.pre+(expectedKind==='completion'?24:0));
 if(expectedKind==='park'){assert.equal(s.completions,0);assert.equal(s.result,0);assert.equal(e.get_eax()>>>0,STALE);}
 else {assert.equal(s.result,1);assert.equal(e.get_eax(),1);assert.notEqual(s.result,STALE);}
 snapshots.push({capture:s,accepted});
}
function lane(base,enabled){
 e.test_vsock_reset();e.set_yield_state(0,0);
 const idx=e.test_vsock_alloc();assert.equal(idx,0);
 // Native allocation plus a documented EOF fixture makes real read_ready true.
 const socket=0x53000000|idx,rec=inventory.VSOCK_TABLE.base+128*idx;
 const rows=[];
 const scenarios=[['null-park','thunk'],['finite-park','call'],['positive','jmp'],['zero-timeout','thunk'],['finite-park','call'],['expired','thunk'],['positive','thunk']];
 for(let step=0;step<scenarios.length;step++){
  const [kind,route]=scenarios[step],pc=base+step*0x100,fd=base+0x4000+step*0x100,tv=fd+0x40;
  const esp=0x7402000+(enabled?0x10000:0)+step*0x100,ret=route==='call'?pc+2:pc+0x20;
  const pre=route==='call'?esp-4:esp;
  put(pc,route==='call'?[0xff,0xd7]:route==='jmp'?[0xff,0xe7]:[0x90]);
  put(ret,[0xb8,0xad,0xde,0xad,0x7e,0xeb,0xfe]); // Must never execute in this one-block invocation.
  words(fd,[1,kind==='positive'?socket:0x5300007f]);words(tv,[0,kind==='zero-timeout'?0:5000]);
  dv.setUint32(rec+56,kind==='positive'?1:0,true);
  if(route==='call')words(esp,[0,fd,0,0,tv]);else words(esp,[ret,0,fd,0,0,kind==='null-park'?0:tv]);
  // Deadline expiry is actual handler clock behavior following step4's park.
  ticks=kind==='expired'?1010:1000;
  e.set_eip(route==='thunk'?THUNK:pc);e.set_esp(esp);e.set_edi(THUNK);e.set_eax(STALE);e.set_ebp(0x123456);
  e.set_yield_state(0,0); // Controlled fixture/scheduler resume; never diagnostic activity.
  e.set_count(0,pc);e.set_count(1,ret);
  const starting=[e.get_count(0),e.get_count(1)];assert.deepEqual(starting,[0,0],'reject actual counter contamination before run');
  const api=e.get_api_calls(),beforeHosts=hostCalls.length,cache=[e.get_cache_stores(),e.get_cache_clears(),e.get_cache_invals()];
  e.run(1);
  assert.equal(e.get_api_calls()-api,1,'real production API dispatch exactly once');
  const park=kind.endsWith('park');
  assert.equal(e.get_eax()>>>0,park?STALE:kind==='positive'?1:0);
  assert.equal(e.get_esp(),pre+(park?0:24));assert.equal(e.get_yield_reason(),park?8:0);
  assert.equal(e.get_eip(),park?THUNK:ret);assert.equal(word(pre),ret,'actual saved return');
  assert.equal(e.get_count(1),0,'no subsequent return-block execution');
  assert.equal(e.get_ebp(),0x123456);assert.equal(e.get_edi(),THUNK);
  assert.equal(word(fd),kind==='positive'||park?1:0,'real fdset filter rewrite or park preservation');
  if(enabled&&step<3)capture(park?'park':'completion',{pre,ret});
  const row={step,kind,route,starting,eax:e.get_eax()>>>0,esp:e.get_esp()-esp,eip:e.get_eip()===THUNK?'thunk':e.get_eip()-pc,
   reason:e.get_yield_reason(),flag:e.get_yield_flag(),halt:e.get_last_run_halt(),fdCount:word(fd),fdHandle:word(fd+4),
   ebp:e.get_ebp(),edi:e.get_edi(),counts:[e.get_count(0),e.get_count(1)],hosts:hostCalls.slice(beforeHosts),
   cache:[e.get_cache_stores()-cache[0],e.get_cache_clears()-cache[1],e.get_cache_invals()-cache[2]]};
  rows.push(row);states.push({enabled,pc,esp,pre,ret,fd,tv,row});
  console.log(JSON.stringify({nativeState:states[states.length-1]}));
  fs.writeFileSync(H+'/native-progress.json',JSON.stringify({states,snapshots,controls,hostCalls},null,2));
  if(park){
   const diag=hook.snapshot(e),hc=hostCalls.length,api2=e.get_api_calls(),reg=[e.get_eax(),e.get_esp(),e.get_eip()];
   e.run(1);assert.equal(e.get_api_calls(),api2);assert.equal(hostCalls.length,hc);
   assert.deepEqual([e.get_eax(),e.get_esp(),e.get_eip()],reg);assert.deepEqual(hook.snapshot(e),diag,'pending park cannot become stale-EAX completion');
  }
 }
 equivalence.push({enabled,rows});return rows;
}
const off=lane(0x480000,false);
assert(hook.FIELDS.every(n=>e['msc_'+n]()===0),'diagnostic OFF remains untouched');
e.msc_start();e.msc_start();assert.equal(e.msc_started(),1,'one-way idempotent start');
const on=lane(0x490000,true);
assert.deepEqual(on,off,'OFF/ON actual production state/import/cache behavior equivalent');
assert.equal(snapshots.length,3);assert.deepEqual(snapshots.map(x=>x.capture.token),[1,2,3]);
assert.equal(snapshots[2].capture.parks,2);assert.equal(snapshots[2].capture.completions,1);
assert.equal(oracle.accept(instance,snapshots[2].capture).kind,'rejected','single-use completion');controls.push('reused authentic completion');
assert.deepEqual(hook.snapshot(e),snapshots[2].capture,'first completion frozen through subsequent real calls');
assert.deepEqual(unexpected,[]);
const result={status:'PASS',qualification:'controlled native production pathways; no original-game evidence',
 compiledModules:2,nativeProcesses:1,nativeInstances:1,moduleSHA256:sha(binary),moduleBytes:binary.length,
 snapshots,controls,states,equivalence,hostCalls,preflight,
 unqualified:['zero-result diagnostic completion (first-completion latch retained positive result)','compat native instantiation','exception inside actual select','direct test_call_select after start','unobserved intra-invocation properties','original game','performance overhead'],
 noExtraClockPumpYieldclearOrGuestWrites:'OFF/ON normalized state/import/cache equivalence; accepted diagnostic code only private globals/getters; no hostile sandbox claim'};
fs.writeFileSync(H+'/native-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

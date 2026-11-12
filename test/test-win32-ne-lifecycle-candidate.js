'use strict';
// Explicit prebuilt full-module lifecycle proof. Runs actual NE guest bytes;
// this internal coordinator still exposes no Win32 guest bridge/QT exports.
const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto');
const { createHostImports } = require('../lib/host-imports');
const R = require('../lib/region-map.generated');
const { createNeLifecycle } = require('../lib/ne-lifecycle');
const { inspectNeDll } = require('../lib/ne-image');
const { neLifecycleImage } = require('./helpers/ne-lifecycle-image');
const { neFixedLifecycleImage } = require('./helpers/ne-fixed-lifecycle-image');
const SIZE = 944 * 65536, BASE = 0x400000;
const hostLogTail=[];
function fixture() {
  const b = Buffer.alloc(0x400), p = 0x80, o = p + 24, s = o + 0xe0;
  b.write('MZ'); b.writeUInt32LE(p, 0x3c); b.writeUInt32LE(0x4550, p);
  b.writeUInt16LE(0x14c, p + 4); b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(0x10e, p + 22); b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x1000, o + 16);
  b.writeUInt32LE(BASE, o + 28); b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x2000, o + 56); b.writeUInt32LE(0x200, o + 60); b.writeUInt16LE(3, o + 68);
  b.writeUInt32LE(0x100000, o + 72); b.writeUInt32LE(0x1000, o + 76); b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x1000, s + 8); b.writeUInt32LE(0x1000, s + 12);
  b.writeUInt32LE(0x200, s + 16); b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  b[0x200] = 0xc3; return b;
}
async function boot(module, memory, init) {
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  imports.host.memory = memory;
  const logI32=imports.host.log_i32;
  imports.host.log_i32=value=>{hostLogTail.push(value>>>0);if(hostLogTail.length>64)hostLogTail.shift();logI32(value);};
  for (const item of WebAssembly.Module.imports(module)) {
    assert.equal(item.module, 'host');
    if (item.kind === 'function' && !imports.host[item.name])
      imports.host[item.name] = () => { throw Error('Unexpected host import ' + item.name); };
  }
  const e = (await WebAssembly.instantiate(module, imports)).exports;
  if (init) e.init_thread(...init);
  return e;
}
async function main() {
  assert(process.env.WA_TEST_WASM,'explicit prebuilt module required');
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer),raw=await boot(module,memory),pe=fixture();
  bytes.set(pe,raw.get_staging());assert.equal(raw.load_pe(pe.length),BASE+0x1000);
  raw.set_eip(BASE+0x1000);raw.set_esp(0x7408000);
  const snapshot=()=>({registers:Buffer.from(bytes.slice(R.BASE.REGFILE,R.BASE.REGFILE+32)),
    eip:raw.get_eip(),fs:raw.get_fs_base(),ss:raw.get_sreg_ss(),ds:raw.get_sreg_ds(),cs:raw.get_sreg_cs(),depth:raw.get_sync_msg_depth(),thunkSelector:raw.win16_thunk_sel()});
  const caller=snapshot(),publishResults=new Map();let invocations=0,whileRunning;
  const e={...raw,win16_bridge_invoke_begin(...args){invocations++;return raw.win16_bridge_invoke_begin(...args);},
    win16_bridge_module_publish(id,result){publishResults.set(id,result);return raw.win16_bridge_module_publish(id,result);},
    run(blocks){whileRunning?.();try{return raw.run(blocks);}catch(error){
      console.error(JSON.stringify({guestTrap:{eip:raw.get_eip()>>>0,cs:raw.get_sreg_cs(),ds:raw.get_sreg_ds(),ss:raw.get_sreg_ss(),hostLogTail:[...hostLogTail]}}));throw error;
    }}};
  const helper=neLifecycleImage();
  // An additional named export with a different result, for colliding import
  // offsets in two simultaneously loaded importers.
  helper.set([5,69,78,84,82,89,1,0,0],0x80+0x7e); // ENTRY -> LibEntry
  const images=new Map([
    ['HELPER',helper],['PARENT',neLifecycleImage({dependencies:['HELPER']})],
    ['ZERO',neLifecycleImage({result:0,dependencies:['HELPER']})],
    ['TRAP',neLifecycleImage({trapInit:true,dependencies:['HELPER']})],
    ['BADWEP',neLifecycleImage({trapWep:true,dependencies:['HELPER']})],
    ['MISSING',neLifecycleImage({dependencies:['ABSENT']})],
    ['CYCLE',neLifecycleImage({dependencies:['CYCLE']})],
    ['IMPORT',neLifecycleImage({importLocalInit:true})],
    ['USAGE',neLifecycleImage({moduleUsage:true})],
    ['ORDIMPORT',neLifecycleImage({importEntry:{module:'HELPER',symbol:2}})],
    ['NAMEIMPORT',neLifecycleImage({importEntry:{module:'HELPER',symbol:'VALUE'}})],
    ['OTHERNAME',neLifecycleImage({importEntry:{module:'HELPER',symbol:'ENTRY'}})],
    ['MISSORD',neLifecycleImage({importEntry:{module:'HELPER',symbol:4}})],
    ['MISSNAME',neLifecycleImage({importEntry:{module:'HELPER',symbol:'ABSENT'}})],
    ['GUESTLOAD',neLifecycleImage({importEntry:{module:'KERNEL',symbol:95},importInValue:true})],
    ['GUESTFREE',neLifecycleImage({importEntry:{module:'KERNEL',symbol:96},importInValue:true})],
    ['BADDEP',neLifecycleImage({trapWep:true})],
    ['BADPARENT',neLifecycleImage({dependencies:['BADDEP']})],
    ['BADZERO',neLifecycleImage({result:0,dependencies:['BADDEP']})],
    ['BADTRAP',neLifecycleImage({trapInit:true,dependencies:['BADDEP']})],
  ]);
  let original;
  if(process.env.WA_NE_ORIGINAL) {
    original=fs.readFileSync(process.env.WA_NE_ORIGINAL);
    assert.equal(crypto.createHash('sha256').update(original).digest('hex'),'7e2b17e61e7e4808a50478ddcac06f65fcf9f3ffd741d747c8cb75e20cb05db9');
    images.set('PMPRO62',original);
  }
  const lifecycle=createNeLifecycle(e,memory,images,{maxBlocks:10000,sliceBlocks:256});
  assert.throws(()=>lifecycle.load('MISSING'),/Missing NE image/);
  assert.throws(()=>lifecycle.load('CYCLE'),/recursive NE dependency/);
  const id=lifecycle.load('parent.dll');assert.equal(invocations,2);
  const arena=view.getUint32(R.BASE.WIN16_PROCESS_ARENA,true),wa=e.guest_to_wasm(arena)>>>0,shared=wa+943*65536+0xf000;
  const clean=()=>{assert.deepEqual(snapshot(),caller);for(const off of [36,40,44])assert.equal(view.getUint32(shared+off,true),0,'frame/depth/lease released');};
  const foreign=await boot(module,memory,[1,e.get_image_base(),e.get_code_start(),e.get_code_end(),e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0]);
  const foreignLifecycle=createNeLifecycle(foreign,memory,images,{maxBlocks:10000,sliceBlocks:256});
  assert.equal(foreignLifecycle.load('PARENT'),id,'shared ready acquisition');foreignLifecycle.release(id);
  clean();assert.equal(lifecycle.load('PARENT'),id);assert.equal(invocations,2);
  assert(lifecycle.lookup(id,'VALUE'));assert.equal(lifecycle.lookup(id,'WEP'),lifecycle.lookup(id,3));
  assert.equal(lifecycle.lookup(id,'ABSENT'),0);assert.equal(lifecycle.lookup(id,4),0);
  whileRunning=()=>{whileRunning=undefined;assert.throws(()=>foreignLifecycle.load('PARENT'),/lifecycle frame/);lifecycle.release(id);assert.throws(()=>lifecycle.release(id),/release rejected/);};
  assert.equal(lifecycle.call(id,'VALUE'),0x1234,'actual named guest export');clean();
  assert.equal(lifecycle.load('PARENT'),id);const beforeFree=invocations;
  lifecycle.release(id);assert.equal(invocations,beforeFree);
  lifecycle.release(id);assert.equal(invocations,beforeFree+2,'actual parent/dependency WEP');clean();
  assert.equal(lifecycle.lookup(id,2),0);
  const usage=lifecycle.load('USAGE');clean();
  assert.equal(lifecycle.call(usage,'VALUE'),1);clean();
  assert.equal(lifecycle.load('USAGE'),usage);
  assert.equal(lifecycle.call(usage,'VALUE'),2);clean();
  lifecycle.release(usage);
  assert.equal(lifecycle.call(usage,'VALUE'),1);clean();
  // WEP itself calls the relocated import and rejects an answer other than 1.
  lifecycle.release(usage);clean();
  for(const name of ['ZERO','TRAP']) {
    let failure;try{lifecycle.load(name);}catch(error){failure=error;}
    assert(failure,'real failed initialization must throw');if(name==='ZERO')assert.match(failure.message,/AX zero/);
    console.log(JSON.stringify({case:name,failure:failure.message}));clean();
    const frame=e.win16_bridge_frame_begin();assert(frame);
    for(let n=13;n<37;n++)assert.equal(view.getUint32(wa+943*65536+0x8c00+(n-13)*32,true),0,'rollback clears all module records');
    assert.equal(e.win16_bridge_frame_end(frame),1);clean();
  }
  const bad=lifecycle.load('BADWEP');let failure;try{lifecycle.release(bad);}catch(error){failure=error;}
  assert(failure);console.log(JSON.stringify({case:'failed-WEP',failure:failure.message}));
  assert.deepEqual(snapshot(),caller);assert.equal(view.getUint32(shared+36,true),0);assert.equal(view.getUint32(shared+44,true),1);
  assert.equal(lifecycle.lookup(bad,'WEP'),0);assert.throws(()=>lifecycle.load('BADWEP'),/busy/);
  // Controlled repair is only for the retry conformance arm, after proving
  // original trap/retained ownership. No production or original image is patched.
  const repair=e.win16_bridge_frame_begin();assert(repair);
  const target=e.win16_bridge_module_termination(bad,0),base=e.win16_seg_base(target>>>19);
  bytes.set([0xb8,1,0,0xca,2,0],e.guest_to_wasm(base+(target&65535))>>>0);
  e.invalidate_code_range(base+(target&65535),6);
  assert.equal(e.win16_bridge_frame_end(repair),1);lifecycle.retryTermination(bad);clean();
  // Exercise the real staged KERNEL.4 relocation and far-call dispatcher.
  // LibEntry calls LocalInit(DS,0,16), whose visible effect grows the data
  // segment from 0x100 to 0x110, then returns its actual success result.
  assert.equal(raw.win16_thunk_sel(),0,'PE caller before import staging');
  const imported=lifecycle.load('IMPORT');clean();
  const importFrame=e.win16_bridge_frame_begin();assert(importFrame);
  assert.equal(e.win16_bridge_scope_begin(importFrame),1);
  const importedEntry=e.win16_bridge_module_entry(imported,1),importedData=e.win16_bridge_module_data(imported);
  const importedCode=e.guest_to_wasm(e.win16_seg_base(importedEntry>>>19))>>>0;
  assert.equal(view.getUint16(importedCode+8,true),15,'nonzero process-owned thunk selector');
  assert.equal(e.win16_seg_limit(importedData>>>3),0x110,'actual imported LocalInit grew data segment');
  assert.equal(e.win16_bridge_frame_end(importFrame),1);
  lifecycle.release(imported);clean();assert.equal(raw.win16_thunk_sel(),0,'caller thunk selector restored');
  const record=id=>wa+943*65536+0x8c00+(id-13)*32;
  const records=()=>Buffer.from(bytes.slice(record(13),record(37)));
  const onlyModule=(id,state)=>{for(let n=13;n<37;n++)assert.equal(view.getUint32(record(n),true),n===id?state:0);};
  for(const name of ['ORDIMPORT','NAMEIMPORT']) {
    const importedId=lifecycle.load(name);clean();
    assert.equal(publishResults.get(importedId)&65535,0x1234,'LibEntry returned actual imported HELPER.VALUE result');
    assert.equal(lifecycle.call(importedId,1)&65535,0x1234,'real imported far CALL and RETF through exported LibEntry');clean();
    lifecycle.release(importedId);clean();onlyModule(0,0);
    console.log(JSON.stringify({case:name,actualImportedCall:true}));
  }
  // Both import-name strings start at offset 7 in their own image. Keep both
  // importers alive and alternate calls: a current-importer global or a thunk
  // cache keyed only by offset would send at least one call to the wrong export.
  const named=lifecycle.load('NAMEIMPORT'),other=lifecycle.load('OTHERNAME');clean();
  for(let n=0;n<2;n++) {
    assert.equal(lifecycle.call(named,1)&65535,0x1234);clean();
    assert.equal(lifecycle.call(other,1)&65535,1);clean();
  }
  lifecycle.release(named);lifecycle.release(other);clean();onlyModule(0,0);
  console.log(JSON.stringify({case:'colliding-name-offsets',actualImportedCalls:true}));
  for(const name of ['MISSORD','MISSNAME']) {
    const before=records(),calls=invocations;
    assert.throws(()=>lifecycle.load(name),/Missing NE import HELPER/);
    assert.equal(invocations,calls);assert.deepEqual(records(),before);clean();
  }
  // Ready-module source mismatch must unwind the parent and acquired ref.
  const missingImage=neLifecycleImage();
  missingImage.set([1,1,1,0,0,1,0,1,1,1,32,0,0],0x80+0x60);
  missingImage[0x80+0x70+6]=0;
  const mismatch=createNeLifecycle(e,memory,new Map([['HELPER',missingImage]]),{maxBlocks:10000,sliceBlocks:256});
  const mismatchId=mismatch.load('HELPER');clean();
  for(const name of ['ORDIMPORT','NAMEIMPORT']) {
    const calls=invocations;
    assert.throws(()=>lifecycle.load(name),/Missing loaded NE import HELPER/);
    assert.equal(invocations,calls);clean();onlyModule(mismatchId,3);
    assert.equal(view.getUint32(record(mismatchId)+8,true),1,'original owner reference retained');
  }
  mismatch.release(mismatchId);clean();onlyModule(0,0);
  for(const [name,ordinal] of [['GUESTLOAD',95],['GUESTFREE',96]]) {
    const guarded=lifecycle.load(name);assert.equal(lifecycle.load(name),guarded);clean();
    const before=records();hostLogTail.length=0;
    whileRunning=()=>{whileRunning=undefined;assert.equal(view.getUint32(record(guarded)+24,true),1,'guest guard runs with active module pin');};
    assert.throws(()=>lifecycle.call(guarded,'VALUE'),WebAssembly.RuntimeError,'actual relocated KERNEL call traps');
    assert.equal(hostLogTail.at(-1),ordinal,'trap came from explicit KERNEL lifecycle guard');
    clean();assert.deepEqual(records(),before,'guest lifecycle preserves refs/segments/pins');
    assert(lifecycle.lookup(guarded,'WEP'));lifecycle.release(guarded);lifecycle.release(guarded);clean();onlyModule(0,0);
    console.log(JSON.stringify({case:name,actualGuardedGuestCall:true}));
  }
  for(const name of ['BADPARENT','BADZERO','BADTRAP']) {
    let failure;
    try {const parent=lifecycle.load(name);lifecycle.release(parent);} catch(error) {failure=error;}
    assert(failure instanceof AggregateError);assert.equal(failure.pendingTerminations.length,1);
    const [dependencyId]=failure.pendingTerminations,cause=failure.errors.find(error=>error.code==='NE_TERMINATION_PENDING');
    assert(cause);assert.equal(cause.moduleId,dependencyId);assert(cause.cause instanceof WebAssembly.RuntimeError);
    if(name==='BADZERO')assert.match(failure.errors[0].message,/AX zero/);
    if(name==='BADTRAP')assert(failure.errors[0] instanceof WebAssembly.RuntimeError);
    assert.deepEqual(snapshot(),caller);assert.equal(view.getUint32(shared+36,true),0);assert.equal(view.getUint32(shared+44,true),1);
    onlyModule(dependencyId,4);
    const frame=e.win16_bridge_frame_begin();assert(frame);
    const wep=e.win16_bridge_module_termination(dependencyId,0),base=e.win16_seg_base(wep>>>19),address=base+(wep&65535);
    bytes.set([0xb8,1,0,0xca,2,0],e.guest_to_wasm(address)>>>0); // Synthetic repair only.
    e.invalidate_code_range(address,6);assert.equal(e.win16_bridge_frame_end(frame),1);
    lifecycle.retryTermination(dependencyId);clean();onlyModule(0,0);
    console.log(JSON.stringify({case:name,actualIndirectWepRetry:true}));
  }
  // Fileless imports execute the same real dispatcher as standalone Win16.
  // Fixed import edges and explicit acquisitions share an identity, but a
  // guest FreeLibrary must never consume an importer's owned edge.
  const fixedScratchCanaries=[R.BASE.GUEST_STACK+512,e.guest_to_wasm(R.BASE.GUEST_STACK+512)>>>0]
    .map(at=>({at,bytes:bytes.slice(at,at+64)}));
  const checkFixedScratch=()=>{
    for(const saved of fixedScratchCanaries)assert.deepEqual(bytes.slice(saved.at,saved.at+64),saved.bytes,
      'nested loads and name queries preserve suspended PE fixed-stack bytes');
  };
  const fixedImages=new Map([
    ['FIXEDA',neFixedLifecycleImage()],
    ['FIXEDB',neLifecycleImage({dependencies:['WIN87EM']})],
    ['FIXEDZERO',neFixedLifecycleImage({loads:0,result:0})],
    ['FIXEDKEEP',neFixedLifecycleImage({loads:1,result:0})],
    ['FIXEDDYNAMIC',neFixedLifecycleImage({loads:1,name:'TOOLHELP'})],
    ['FIXEDCARDS',neFixedLifecycleImage({loads:1,name:'CARDS'})],
    ['FIXEDUNKNOWN',neFixedLifecycleImage({loads:1,name:'ABSENT'})],
    ['FIXEDWEP',neLifecycleImage({dependencies:['WIN87EM'],trapWep:true})],
    ['FIXEDKERNEL',neFixedLifecycleImage({loads:1,name:'KERNEL'})],
  ]);
  const fixedQuery=neFixedLifecycleImage({loads:0});fixedQuery.writeUInt16LE(1,0x80+0x1e);
  fixedImages.set('FIXEDQUERY',fixedQuery);
  const badName=neFixedLifecycleImage({loads:1});badName.fill(65,0x520,0x600);
  fixedImages.set('FIXEDBADNAME',badName);
  const badSelector=neFixedLifecycleImage({loads:1});badSelector[0x246]=0x06; // push ES (NULL), not DS
  fixedImages.set('FIXEDBADSEL',badSelector);
  const fixedLoop=neFixedLifecycleImage({loads:0});fixedLoop.set([0xeb,0xfe],0x240);
  fixedImages.set('FIXEDLOOP',fixedLoop);
  for(const image of fixedImages.values())inspectNeDll(image);
  const fixed=createNeLifecycle(e,memory,fixedImages,{maxBlocks:10000,sliceBlocks:256});
  const fixedOther=createNeLifecycle(foreign,memory,fixedImages,{maxBlocks:10000,sliceBlocks:256});
  const inScope=fn=>{const t=e.win16_bridge_frame_begin();assert(t);try {
    assert.equal(e.win16_bridge_scope_begin(t),1);return fn();
  }finally{assert.equal(e.win16_bridge_frame_end(t),1);}};
  assert.equal(e.win16_bridge_fixed_acquire(12),0,'no unowned acquisition');
  assert.equal(e.win16_bridge_fixed_usage(12),0);
  const queryId=fixed.load('FIXEDQUERY');assert.equal(fixed.call(queryId,7),0,'absent fixed GetModuleHandle');
  const fixedA=fixed.load('FIXEDA');assert.equal(e.win16_bridge_fixed_usage(12),3);
  const fixedData=inScope(()=>e.win16_bridge_module_data(fixedA));
  const fixedDataAt=e.guest_to_wasm(e.win16_seg_base(fixedData>>>3))>>>0;
  assert.equal(view.getUint32(fixedDataAt+12,true)>>>16,0xaabb,'LoadLibrary preserves high EAX');
  assert.equal(view.getUint16(fixedDataAt,true),view.getUint16(fixedDataAt+2,true),'duplicate loads return one identity');
  assert.equal(fixed.call(queryId,7),view.getUint16(fixedDataAt,true),'imported identity GetModuleHandle');
  assert.equal(fixed.call(fixedA,8),0,'unknown named WIN87EM export stays absent');
  checkFixedScratch();
  const fixedB=fixedOther.load('FIXEDB');assert.equal(e.win16_bridge_fixed_usage(12),4);
  assert.equal(fixed.call(fixedA,'VALUE'),4,'real GetModuleUsage includes both importers and both loads');
  const far=fixed.call(fixedA,5);assert(far,'real ordinal lookup');
  assert.equal(fixed.call(fixedA,6),0,'resolved WIN87EM.1 executes');
  assert.equal(fixed.call(fixedA,4)&65535,0x5a5a,'void FreeLibrary preserves AX');
  assert.equal(fixed.call(fixedA,'VALUE'),3);
  assert.equal(fixed.call(fixedA,4)&65535,0x5a5a);
  assert.equal(fixed.call(fixedA,'VALUE'),2);
  assert.throws(()=>fixed.call(fixedA,4),WebAssembly.RuntimeError,'extra free cannot steal import ref');clean();
  assert.throws(()=>fixed.load('FIXEDZERO'),/AX zero/);
  assert.equal(e.win16_bridge_fixed_usage(12),2,'failed initializer unwinds fixed imports');
  for(const name of ['FIXEDDYNAMIC','FIXEDCARDS','FIXEDUNKNOWN','FIXEDBADNAME','FIXEDBADSEL']) {
    assert.throws(()=>fixed.load(name),WebAssembly.RuntimeError);clean();
    assert.equal(e.win16_bridge_fixed_usage(12),2,'unsupported nested name does not leak refs');
  }
  assert.throws(()=>fixed.load('FIXEDKEEP'),/AX zero/);
  assert.equal(e.win16_bridge_fixed_usage(12),3,'completed explicit acquisition survives caller rejection');
  const fixedHandle=inScope(()=>{
    const h=e.win16_bridge_fixed_acquire(12);assert(h>=32);
    assert.equal(e.win16_bridge_fixed_release(h),1);return h;
  });
  inScope(()=>assert.equal(e.win16_bridge_fixed_release(fixedHandle),1));
  fixed.release(fixedA);assert.equal(e.win16_bridge_fixed_usage(12),1);
  fixedOther.release(fixedB);assert.equal(e.win16_bridge_fixed_usage(12),0);clean();
  assert.equal(fixed.call(queryId,7),0,'final alias retired');fixed.release(queryId);
  const kernelId=fixed.load('FIXEDKERNEL');assert(fixed.call(kernelId,8),'known named KERNEL.GetModuleHandle resolves');
  checkFixedScratch();
  fixed.call(kernelId,4);fixed.release(kernelId);clean();
  const fixedWep=fixed.load('FIXEDWEP');
  assert.throws(()=>fixed.release(fixedWep),/termination retained/);
  assert.equal(e.win16_bridge_fixed_usage(12),1,'failed WEP retains imports');
  inScope(()=>{
    const wep=e.win16_bridge_module_termination(fixedWep,0);
    const address=e.win16_seg_base(wep>>>19)+(wep&65535);
    bytes.set([0xb8,1,0,0xca,2,0],e.guest_to_wasm(address)>>>0);
    e.invalidate_code_range(address,6);
  });
  fixed.retryTermination(fixedWep);assert.equal(e.win16_bridge_fixed_usage(12),0);clean();
  inScope(()=>{
    assert.equal(e.win16_bridge_fixed_release(fixedHandle),0,'retired alias');
    for(const id of [0,9,13,37,65535])assert.equal(e.win16_bridge_fixed_acquire(id),0);
    const h=e.win16_bridge_fixed_acquire(12);assert(h>=32);
    assert.equal(e.win16_bridge_fixed_release(h),1);
  });clean();
  const fixedRegion=R.BASE.WIN16_PROCESS_ARENA;
  inScope(()=>{
    const packed=Buffer.alloc(16);packed[0]=8;packed.write('FIXEDRAW',1,'ascii');
    const parent=e.win16_bridge_module_claim(packed.readBigUInt64LE(0),packed.readBigUInt64LE(8));assert(parent>0);
    assert.equal(e.win16_bridge_fixed_link(parent,12),1);
    assert.equal(e.win16_bridge_fixed_link(parent,12),0,'duplicate link');
    assert.equal(e.win16_bridge_fixed_link(parent,9),0,'CARDS is not fileless');
    assert.equal(e.win16_bridge_fixed_usage(12),1);
    assert.equal(foreign.win16_bridge_fixed_acquire(12),0,'foreign owner cannot borrow lease');
    assert.equal(e.win16_bridge_module_rollback(parent),1);
    assert.equal(e.win16_bridge_fixed_usage(12),0);
    const count=fixedRegion+104+12*8+4;
    view.setUint32(count,65535,true);
    try {assert.equal(e.win16_bridge_fixed_acquire(12),0,'WORD count overflow rejected');}
    finally {view.setUint32(count,0,true);}
  });clean();
  const cancelled=new AbortController();cancelled.abort(new Error('fixed cancelled'));
  assert.throws(()=>createNeLifecycle(e,memory,fixedImages,{signal:cancelled.signal}).load('FIXEDA'),/fixed cancelled/);
  assert.equal(e.win16_bridge_fixed_usage(12),0);clean();
  assert.throws(()=>createNeLifecycle(e,memory,fixedImages,{maxBlocks:32,sliceBlocks:16}).load('FIXEDLOOP'),/budget exhausted/);
  assert.equal(e.win16_bridge_fixed_usage(12),0);clean();
  console.log(JSON.stringify({case:'counted-fixed-builtin',imports:2,explicit:2,actualNestedWin16Apis:true}));

  // Dynamic builtins retain native records, so two coordinators/importers can
  // share the identity without an orphan slot or a synthetic guest module.
  const builtinImage=(module,symbol,pushWord=false)=>{
    const image=neLifecycleImage({importEntry:{module,symbol},importInValue:true});
    if(pushWord)image.set([0x6a,0,0x90,0x90,0x90],0x210);
    return image;
  };
  const builtinImages=new Map([
    ['USERCALL',builtinImage('USER',60)],['GDICALL',builtinImage('GDI',87,true)],
    ['FPUCALL',builtinImage('WIN87EM',1)],
    ['TOOLA',builtinImage('TOOLHELP',76,true)],['TOOLB',builtinImage('TOOLHELP',76,true)],
    ['TOOLBAD',builtinImage('TOOLHELP',80)],
    ['USERBAD',builtinImage('USER',65535)],
    ['SHELLNAME',builtinImage('SHELL','ShellAbout')],
    ['TOOLNAME',builtinImage('TOOLHELP','UNKNOWN_EXPORT')],
    ['TOOLZERO',neLifecycleImage({dependencies:['TOOLHELP'],result:0})],
    ['TOOLTRAP',neLifecycleImage({dependencies:['TOOLHELP'],trapInit:true})],
    ['ALLBUILTIN',neLifecycleImage({dependencies:['TOOLHELP','VER','AVIFILE','MSVIDEO','DISPLAY','LZEXPAND']})],
  ]);
  const builtins=createNeLifecycle(e,memory,builtinImages,{maxBlocks:10000,sliceBlocks:256});
  const foreignBuiltins=createNeLifecycle(foreign,memory,builtinImages,{maxBlocks:10000,sliceBlocks:256});
  for(const name of ['SHELLNAME','TOOLNAME']) {
    const before=records(),calls=invocations;
    assert.throws(()=>builtins.load(name),/importer-owned name resolution/);
    assert.equal(invocations,calls);assert.deepEqual(records(),before);clean();
  }
  const claimName=name=>{const b=Buffer.alloc(16);b[0]=name.length;b.write(name,1,'ascii');return e.win16_bridge_module_claim(b.readBigUInt64LE(0),b.readBigUInt64LE(8));};
  const publishFrame=e.win16_bridge_frame_begin();assert(publishFrame);
  assert.equal(e.win16_bridge_scope_begin(publishFrame),1);
  const rejectedId=claimName('UNSUPPORTED');assert(rejectedId>0);
  assert.equal(e.win16_bridge_module_publish_emulated(rejectedId),0,'unknown names cannot fabricate ready identities');
  assert.equal(e.win16_bridge_module_rollback(rejectedId),1);
  assert.equal(e.win16_bridge_frame_end(publishFrame),1);clean();onlyModule(0,0);
  const namedSlot=name=>{
    for(let id=13;id<37;id++) {
      const at=e.win16_dynamic_module_slot(id-13),n=bytes[at];
      if(Buffer.from(bytes.slice(at+1,at+1+n)).toString('ascii')===name)return id;
    }
    return 0;
  };
  for(const name of ['USERCALL','GDICALL','FPUCALL']) {
    const id=builtins.load(name),value=builtins.call(id,'VALUE');
    if(name==='GDICALL')assert(value,'real GetStockObject result');else assert.equal(value,0);
    builtins.release(id);clean();onlyModule(0,0);
  }
  const toolA=builtins.load('TOOLA'),toolSlot=namedSlot('TOOLHELP');assert(toolSlot);
  assert.equal(view.getUint32(record(toolSlot)+8,true),1);
  const toolB=foreignBuiltins.load('TOOLB');assert.equal(namedSlot('TOOLHELP'),toolSlot);
  assert.equal(view.getUint32(record(toolSlot)+8,true),2,'two imported references');
  assert.equal(builtins.call(toolA,'VALUE'),0);
  assert.equal(foreignBuiltins.call(toolB,'VALUE'),0);
  assert.equal(builtins.lookup(toolSlot,76),0,'dependency identity is not a fabricated export table');
  for(const name of ['TOOLZERO','TOOLTRAP']) {
    assert.throws(()=>builtins.load(name));clean();
    assert.equal(view.getUint32(record(toolSlot)+8,true),2,'failed parent releases only its acquired ref');
  }
  builtins.release(toolA);assert.equal(namedSlot('TOOLHELP'),toolSlot);
  assert.equal(foreignBuiltins.call(toolB,'VALUE'),0,'remaining importer retains callable identity');
  foreignBuiltins.release(toolB);clean();onlyModule(0,0);assert.equal(namedSlot('TOOLHELP'),0);
  for(const name of ['TOOLZERO','TOOLTRAP']) {
    assert.throws(()=>builtins.load(name));clean();onlyModule(0,0);
    assert.equal(namedSlot('TOOLHELP'),0,'sole failed parent leaves no builtin slot');
  }
  for(const name of ['TOOLBAD','USERBAD']) {
    const id=builtins.load(name);hostLogTail.length=0;
    assert.throws(()=>builtins.call(id,'VALUE'),WebAssembly.RuntimeError);
    assert(hostLogTail.includes(name==='TOOLBAD'?(namedSlot('TOOLHELP')<<16)|80:(2<<16)|65535),
      'trap reaches the original unsupported dispatcher entry');
    clean();builtins.release(id);clean();onlyModule(0,0);
  }
  for(let iteration=0;iteration<30;iteration++) {
    const id=builtins.load('ALLBUILTIN');
    for(const name of ['TOOLHELP','VER','AVIFILE','MSVIDEO','DISPLAY','LZEXPAND'])assert(namedSlot(name));
    builtins.release(id);clean();onlyModule(0,0);
    for(const name of ['TOOLHELP','VER','AVIFILE','MSVIDEO','DISPLAY','LZEXPAND'])assert.equal(namedSlot(name),0);
  }
  console.log(JSON.stringify({case:'builtin-dependencies',actualFixedCalls:3,dynamicLifetime:true,unknownOrdinalTraps:true,reloadCycles:30}));
  let originalResult=null;
  if(original) {
    const inspected=inspectNeDll(original),moduleId=lifecycle.load('PMPRO62');clean();
    let lookedUp=0;
    for(const [name,ordinal] of inspected.names) {
      const ptr=lifecycle.lookup(moduleId,name);assert(ptr,name);assert.equal(ptr,lifecycle.lookup(moduleId,ordinal),name);lookedUp++;
    }
    assert.equal(lifecycle.load('PMPRO62'),moduleId);lifecycle.release(moduleId);lifecycle.release(moduleId);clean();
    originalResult={sha256:crypto.createHash('sha256').update(original).digest('hex'),lookedUp,loadInitLookupUnload:true};
  }
  // Run replacement last: no stale arena-address assertions after release.
  const resetHandle=inScope(()=>e.win16_bridge_fixed_acquire(12));assert(resetHandle);
  assert.equal(e.win16_bridge_fixed_usage(12),1);
  assert.equal(e.win16_process_arena_release(),1);
  assert.equal(e.win16_bridge_fixed_usage(12),0,'unpublished arena has no identities');
  inScope(()=>assert.equal(e.win16_bridge_fixed_usage(12),0,'new arena clears lifetime state'));
  assert.equal(e.is_win16(),0);assert.equal(e.get_image_base(),BASE);assert.equal(e.win16_process_arena_release(),1);
  console.log(JSON.stringify({passed:true,actualGuestExecution:true,moduleLifecycle:true,qtThunk:false,original:originalResult}));
}
main().catch(error=>{console.error(error.stack);process.exitCode=1;});

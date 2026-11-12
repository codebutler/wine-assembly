'use strict';
// Actual PE GetProcAddress -> QT_Thunk -> real NE RETF, prebuilt module only.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {createHostImports}=require('../lib/host-imports');
const {serviceNeGuestYieldSync}=require('../lib/ne-guest-bridge');
const {neQtFixture}=require('./helpers/ne-qt-fixture');
const {createNeLifecycle}=require('../lib/ne-lifecycle');
const {ThreadManager}=require('../lib/thread-manager');
const {observeNeQtRun}=require('./helpers/ne-qt-run-observer');
async function main(){
  assert(process.env.WA_TEST_WASM,'explicit prebuilt module required');
  const module=await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM));
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const imports=createHostImports({getMemory:()=>memory.buffer,renderer:null,resourceJson:{}});imports.host.memory=memory;
  const raw=(await WebAssembly.instantiate(module,imports)).exports;
  let e=raw,secondary,manager,thread;
  if(process.argv.includes('--cooperative')) {
    secondary=await WebAssembly.instantiate(module,imports);
    manager=new ThreadManager(module,memory,{exports:raw},()=>imports,{});
    thread={instance:secondary,state:'active',tid:1};manager.threads=new Map([[123,thread]]);manager._runningThreadHandle=0;
  }
  const bytes=new Uint8Array(memory.buffer),view=new DataView(memory.buffer);
  const wa=p=>e.guest_to_wasm(p)>>>0,read=p=>view.getUint32(wa(p),true),write=(p,v)=>view.setUint32(wa(p),v,true);
  let f,stack,seenQt=0;
  function context(){
    const token=e.win16_bridge_frame_begin();assert(token);const at=Number(token&0xffffffffn);
    const result=[...bytes.slice(at+32,at+256),...bytes.slice(at+512,at+896)];
    assert(e.win16_bridge_frame_end(token));return result;
  }
  function boot(options={}) {
    e.win16_guest_request_cancel();e=raw;
    f=neQtFixture(options);bytes.set(f.pe,e.get_staging());assert.equal(e.load_pe(f.pe.length)>>>0,f.entry);
    e.invalidate_code_range(f.entry,0x1000);stack=0x7408000;
    if(process.argv.includes('--sparse')||secondary){const base=e.guest_stack_alloc(65536)>>>0;assert(base);stack=base+65520;}
    if(secondary) {
      secondary.exports.init_thread(1,e.get_image_base(),e.get_code_start(),e.get_code_end(),e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),0);
      e=manager.cooperativeCallbackExports(thread);
    }
    e.clear_yield();e.set_esp(stack);e.set_eip(f.entry);write(stack,0);
  }
  function service(){return serviceNeGuestYieldSync({exports:e,memoryBuffer:memory.buffer,
    findDllSync:()=>f.ne,neInvokeOptions:{maxBlocks:4096,sliceBlocks:64}});}
  function untilQt(){
    for(let i=0;i<100;i++){
      e.run(1000);
      if(!e.get_yield_reason()) {assert(e.get_eip(),'PE exited before QT request '+JSON.stringify({i,eax:e.get_eax()>>>0,esp:e.get_esp()>>>0,qt:read(f.qtSlot),handle:read(0x402700),target:read(0x402704)}));continue;}
      assert.equal(e.get_yield_reason(),18,'unexpected yield at '+(e.get_eip()>>>0).toString(16));
      const token=e.win16_guest_request_token();
      if(e.win16_guest_request_field(token,0)===4)return token;
      assert(service());
    }
    throw new Error('No QT request');
  }
  for(const words of [[],[1000,0],[0x9876,0x1234,0xabcd,0x5555,0xaaaa],Array.from({length:32},(_,i)=>i*1973)]) {
    boot({words});const request=untilQt(),s=e.get_esp()>>>0,b=e.get_ebp()>>>0,ret=read(s);
    const segments=Array.from({length:6},(_,i)=>e.win16_sreg(i)),fsBase=e.get_fs_base();
    f.scratch[13]=(f.scratch[13]&0xffff0000|segments[4])>>>0;
    f.scratch[14]=(f.scratch[14]&0xffff0000|segments[2])>>>0;
    assert(read(f.qtSlot),'ordinary GetProcAddress resolved QT');
    assert(service());seenQt++;
    assert.equal(e.get_esp()>>>0,s+4+f.cleanup);assert.equal(e.get_ebp()>>>0,b);
    assert.equal(e.get_eax()>>>0,f.expected.eax);assert.equal(e.get_edx()>>>0,f.expected.edx);
    assert.equal(e.get_ecx()>>>0,f.expected.ecx);assert.equal(e.get_eip()>>>0,f.afterQt);
    assert.equal(read(s),ret,'PE return slot restored');
    assert.deepEqual(Array.from({length:6},(_,i)=>e.win16_sreg(i)),segments);assert.equal(e.get_fs_base(),fsBase);
    assert.equal(read(b-4),0xfacebeef,'original BP scratch write visible');
    assert.equal(e.win16_guest_request_settle(request,0),0,'duplicate settlement rejected');
    for(let i=0;i<100&&e.get_eip();i++){e.run(1000);if(e.get_yield_reason()===18)assert(service());else assert.equal(e.get_yield_reason(),0);}
    assert.equal(e.get_eip(),0);assert.equal(e.get_esp()>>>0,stack+4);
    if(manager)assert.equal(manager._runningThreadHandle,0,'cooperative facade restores scheduler ownership');
    assert.equal(read(f.result+28),0x13579bdf);assert.equal(read(f.result+32),0x2468ace0);assert.equal(read(f.result+36),0x3579bdf1);
    assert.deepEqual(Array.from({length:16},(_,i)=>read(f.result+48+i*4)),f.scratch);
  }
  for(const options of [{cleanup:0},{cleanup:2}]) {
    boot(options);untilQt();const s=e.get_esp()>>>0;assert(service());assert.equal(e.get_esp()>>>0,s+4+options.cleanup,'actual under-cleanup retained');
    // These deliberately stop before the wrapper's FreeLibrary16. Retire the
    // image normally before reusing its arena for a different machine body.
    createNeLifecycle(e,memory,[]).releaseGuest(read(0x402700));
  }
  boot();let request=untilQt(),s=e.get_esp()>>>0,ret=read(s);
  if(!manager) {
  const frame=e.win16_bridge_frame_begin();assert(frame);
  const target=e.win16_guest_request_field(request,1)>>>0,owner=e.get_current_thread_id();
  e.set_current_thread_id(owner+9);
  assert.equal(e.win16_bridge_qt_begin(frame,target),0);assert.equal(read(s),ret,'foreign owner cannot overwrite return');
  assert.equal(e.win16_guest_qt_settle(request,frame),0);assert.equal(e.win16_bridge_frame_end(frame),0);
  e.set_current_thread_id(owner);assert(e.win16_bridge_frame_end(frame));
  }
  // Abort raised during a synchronous guest slice is observed before merging.
  let aborted=false;const facade=observeNeQtRun(e,()=>{aborted=true;});
  assert.throws(()=>serviceNeGuestYieldSync({exports:facade,memoryBuffer:memory.buffer,
    neInvokeOptions:{maxBlocks:4096,sliceBlocks:64,signal:{get aborted(){return aborted;}}}}),/cancelled/);
  assert.equal(read(s),ret);assert.equal(e.get_esp()>>>0,s);assert(e.win16_guest_request_valid(request));
  createNeLifecycle(e,memory,[]).releaseGuest(read(0x402700));e.win16_guest_request_cancel();
  for(const options of [{failure:'trap'},{failure:'loop'},{failure:'bad-return'},{cleanup:1},{cleanup:128},{cleanup:65534}]) {
    boot(options);const request=untilQt(),s=e.get_esp()>>>0,ret=read(s),b=e.get_ebp()>>>0;
    const regs=[e.get_eax(),e.get_ecx(),e.get_edx(),e.get_ebx(),e.get_esi(),e.get_edi()];
    const segments=Array.from({length:6},(_,i)=>e.win16_sreg(i)),fsBase=e.get_fs_base();
    const before=context();
    assert.throws(service);assert.equal(e.get_yield_reason(),18,'failure remains parked');
    assert(e.win16_guest_request_valid(request));assert.equal(e.get_esp()>>>0,s);assert.equal(e.get_ebp()>>>0,b);assert.equal(read(s),ret);
    assert.deepEqual([e.get_eax(),e.get_ecx(),e.get_edx(),e.get_ebx(),e.get_esi(),e.get_edi()],regs);
    assert.deepEqual(Array.from({length:6},(_,i)=>e.win16_sreg(i)),segments);assert.equal(e.get_fs_base(),fsBase);
    assert.deepEqual(context(),before,'complete captured CPU/lazy flags/segments/FP restored');
    // Pin and mapping lease were released even on trap or budget cancellation.
    const handle=read(0x402700);createNeLifecycle(e,memory,[]).releaseGuest(handle);
    e.win16_guest_request_cancel();
  }
  console.log('PASS real PE/NE QT alias scratch, independent registers, RETF cleanup, failures and restoration ('+seenQt+' success cases)');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

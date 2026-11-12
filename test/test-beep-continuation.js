#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const {audioContext}=require('./test-beep-output');
const {ThreadManager}=require('../lib/thread-manager');
const tailCalls=!process.argv.includes('--no-tail-calls');
const STACK=0x700000, CALLBACK=0x402000, COUNT=0x403000;
const extraWat=`
 (func (export "beep_test_clear_yield") (global.set $yield_flag (i32.const 0)))
 (func (export "beep_test_library") (param i32) (result i32)
  (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
  (call $handle_LoadLibraryA (local.get 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "beep_test_lookup") (param i32 i32) (result i32)
  (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
  (call $handle_GetProcAddress (local.get 0) (local.get 1) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load (global.get $reg_base)))
 (func (export "beep_test_init")
  (global.set $image_base (i32.const 0x400000))
  (global.set $thunk_guest_base (i32.add (global.get $image_base) (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (call $invocation_thread_begin (i32.sub (global.get $current_thread_id) (i32.const 1))))
 (func (export "beep_test_begin") (param i32 i32)
  (global.set $yield_flag (i32.const 0))
  (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
  (call $gs32 (i32.const ${STACK}) (i32.const 0))
  (call $gs32 (i32.const ${STACK+4}) (local.get 0))
  (call $gs32 (i32.const ${STACK+8}) (local.get 1))
  (call $beep_begin (local.get 0) (local.get 1)))
 (func (export "beep_test_root_lo") (result i32) (i32.wrap_i64 (global.get $invocation_root)))
 (func (export "beep_test_root_hi") (result i32) (i32.wrap_i64 (i64.shr_u (global.get $invocation_root) (i64.const 32))))
 (func (export "beep_test_epoch_lo") (result i32) (i32.wrap_i64 (global.get $invocation_epoch)))
 (func (export "beep_test_epoch_hi") (result i32) (i32.wrap_i64 (i64.shr_u (global.get $invocation_epoch) (i64.const 32))))
 (func (export "beep_test_process_reset") (call $invocation_process_begin))
 (func (export "beep_test_outer_token") (result i32) (i32.load offset=12 (i32.load (global.get $beep_frames))))
 (func (export "beep_test_error") (param i32) (global.set $last_error (local.get 0)))
 (func (export "beep_test_get_error") (result i32) (global.get $last_error))
 (func (export "beep_test_depth") (result i32) (global.get $invocation_depth))
 (func (export "beep_test_frames") (result i32) (global.get $beep_frames))
 (func (export "beep_test_token") (result i32) (i32.load offset=12 (global.get $beep_frames)))
 (func (export "beep_test_queue") (param $callback i32)
  (local $p i32) (local $wa i32)
  (local.set $p (call $heap_alloc (i32.const 24)))
  (local.set $wa (call $g2w (local.get $p)))
  (i32.store offset=4 (local.get $wa) (i32.const 123))
  (i32.store offset=16 (local.get $wa) (local.get $callback))
  (i32.store offset=20 (local.get $wa) (i32.const 1))
  (call $io_apc_enqueue (local.get $p)))
 (func (export "beep_test_thunk") (param $api i32) (result i32)
  (local $wa i32)
  (global.set $num_thunks (call $thunk_reserve))
  (local.set $wa (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
  (i32.store (local.get $wa) (i32.const 0x80000009))
  (i32.store offset=4 (local.get $wa) (local.get $api))
  (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
  (call $update_thunk_end)
  (i32.add (global.get $image_base) (i32.sub (local.get $wa) (global.get $GUEST_BASE))))
`;
(async()=>{
 const h=await bootRenderHarness({extraWat,fonts:'none',tailCalls}),e=h.exports,ac=audioContext();
 h.hostCtx._voices._ensureCtx=()=>ac;
 e.beep_test_init();
 const bytes=(address,data)=>data.forEach((b,i)=>e.guest_write8(address+i,b));
 const imm=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
 // Actual guest APC calls SetLastError, increments memory and clobbers EAX.
 const setErrorId=require('../src/api_table.json').find(a=>a.name==='SetLastError').id;
 const setErrorThunk=e.beep_test_thunk(setErrorId);
 bytes(CALLBACK,[0x68,...imm(9999),0xb8,...imm(setErrorThunk),0xff,0xd0,0xff,0x05,...imm(COUNT),0xb8,...imm(0xdeadbeef),0xc2,4,0]);
 const run=()=>{e.beep_test_clear_yield();e.run(1000);};
 const done=(expected,error)=>{assert.equal(e.get_eip(),0);assert.equal(e.get_esp(),STACK+12);assert.equal(e.get_eax(),expected);assert.equal(e.beep_test_get_error(),error);assert.equal(e.beep_test_frames(),0);assert.equal(e.beep_test_depth(),0);};
 e.beep_test_error(1234);e.beep_test_queue(CALLBACK);e.beep_test_begin(750,100);
 assert.equal(e.get_eip(),CALLBACK);run();assert.equal(e.guest_read32(COUNT),1);
 assert.notEqual(e.get_eip(),0);assert.equal(e.get_esp(),STACK);assert.equal(e.apc_alertable_sleeping(),1);
 // Arbitrarily many resumed slices do not finish while the output clock is frozen.
 for(let i=0;i<5;i++)run();assert.notEqual(e.get_eip(),0);
 const sleepManager=new ThreadManager(h.module,h.memory,h.instance,()=>({host:h.host,gdi:h.gdi}),{now:()=>10,waitNow:()=>10,log:()=>{}});
 sleepManager.noteMainSleep();assert(sleepManager._mainSleepUntil>10);
 assert.equal(sleepManager.checkMainYield(),true);
 e.beep_test_queue(CALLBACK);sleepManager.alertThread(1);
 assert.equal(sleepManager._mainSleepUntil,0,'actual scheduler alert removes sleep deadline');
 run();assert.equal(e.guest_read32(COUNT),2);
 assert.notEqual(e.get_eip(),0,'APC wake cannot return BOOL early');
 ac.currentTime+=0.101;run();done(1,1234);
 e.beep_test_begin(750,100);const cancel=e.beep_test_token();
 assert.equal(h.host.beep_cancel(cancel),-995);run();done(0,995);
 e.beep_test_error(3456);e.beep_test_begin(750,100);ac.state='suspended';run();done(0,995);
 e.beep_test_begin(750,100);done(0,50);ac.state='running';
 e.beep_test_begin(1,100);done(0,87);
 e.beep_test_begin(750,100);const cleanup=e.beep_test_token();e.beep_cleanup();
 assert.equal(e.beep_test_frames(),0);assert.equal(e.beep_test_depth(),0);
 assert.equal(h.host.beep_status(cleanup,0),-6);assert.equal(e.apc_alertable_sleeping(),0);

 // Unmodified production handler and dispatch, with observation exports only.
 const nested=new WebAssembly.Instance(h.module,{host:h.host,gdi:h.gdi}).exports;
 nested.beep_test_init();h.hostCtx.exports=nested;
 const thunk=nested.beep_test_thunk(9);
 // APC: push duration/frequency, CALL production Beep, record BOOL, ret4.
 const body=[0x68,...imm(20),0x68,...imm(900),0xb8,...imm(thunk),0xff,0xd0,0xa3,...imm(COUNT+4),0xc2,4,0];
 body.forEach((b,i)=>nested.guest_write8(CALLBACK+i,b));
 nested.invalidate_code_range(CALLBACK,body.length);
 nested.beep_test_error(789);nested.beep_test_queue(CALLBACK);nested.beep_test_begin(750,100);
 nested.run(1000);assert.equal(nested.beep_test_depth(),2);
 ac.currentTime+=0.021;nested.run(1000);assert.equal(nested.guest_read32(COUNT+4),1);
 assert.equal(nested.beep_test_depth(),1);assert.notEqual(nested.get_eip(),0);
 ac.currentTime+=0.081;nested.run(1000);assert.equal(nested.get_eip(),0);
 assert.equal(nested.get_eax(),1);assert.equal(nested.get_esp(),STACK+12);
 assert.equal(nested.beep_test_depth(),0);assert.equal(nested.beep_test_get_error(),789);
 // Production KERNEL32 image exports are separate from the API catalog.
 for(const [address,text] of [[COUNT+32,'KERNEL32.DLL'],[COUNT+64,'Beep']])
  Buffer.from(text+'\0').forEach((b,i)=>nested.guest_write8(address+i,b));
 const library=nested.beep_test_library(COUNT+32);assert(library!==0);
 const dynamic=nested.beep_test_lookup(library,COUNT+64);assert.notEqual(dynamic,0);
 const dynamicBody=[0x68,...imm(20),0x68,...imm(900),0xb8,...imm(dynamic),0xff,0xd0,0xa3,...imm(COUNT+4),0xc2,4,0];
 dynamicBody.forEach((b,i)=>nested.guest_write8(CALLBACK+i,b));
 nested.invalidate_code_range(CALLBACK,dynamicBody.length);
 nested.beep_test_error(789);nested.beep_test_queue(CALLBACK);nested.beep_test_begin(750,100);
 nested.run(1000);assert.equal(nested.beep_test_depth(),2);
 ac.currentTime+=0.021;nested.run(1000);assert.equal(nested.guest_read32(COUNT+4),1);
 assert.equal(nested.beep_test_depth(),1);
 ac.currentTime+=0.081;nested.run(1000);assert.equal(nested.get_eip(),0);
 assert.equal(nested.get_eax(),1);assert.equal(nested.get_esp(),STACK+12);
 assert.equal(nested.beep_test_get_error(),789);
 // Forced Worker-style retirement must cancel both nested output tokens
 // without calling the dead instance's private continuation/cleanup exports.
 nested.init_thread(1);nested.beep_test_init();
 const oldRoot=[nested.beep_test_root_lo(),nested.beep_test_root_hi()];
 const oldEpoch=[nested.beep_test_epoch_lo(),nested.beep_test_epoch_hi()];
 const nestedThunk=nested.beep_test_thunk(9);
 const nestedBody=[0x68,...imm(20),0x68,...imm(900),0xb8,...imm(nestedThunk),0xff,0xd0,0xa3,...imm(COUNT+4),0xc2,4,0];
 nestedBody.forEach((b,i)=>nested.guest_write8(CALLBACK+i,b));
 nested.invalidate_code_range(CALLBACK,nestedBody.length);
 nested.beep_test_queue(CALLBACK);nested.beep_test_begin(750,100);nested.run(1000);
 assert.equal(nested.beep_test_depth(),2);
 const retired=[nested.beep_test_token(),nested.beep_test_outer_token()];
 const manager=new ThreadManager(h.module,h.memory,h.instance,()=>({host:h.host,gdi:h.gdi}),{log:()=>{}});
 const thread={tid:1,state:'active',instance:null,link:{_retirementComplete:false},startAddr:CALLBACK,param:0};
 manager.threads.set(0xe1001,thread);manager.terminateThread(0xe1001,99);
 assert.equal(thread.state,'exited');
 for(const token of retired)assert.equal(h.host.beep_status(token,0),-6);
 assert.equal(h.host.beep_start(750,100,2,...oldRoot),-995,'delayed old broker start is fenced');
 assert.equal(h.host.beep_thread_begin(2,...oldRoot,...oldEpoch),-995,'same retired root cannot reopen');
 // Existing slot-retirement barrier permits a later init_thread; the new root
 // can own output while delayed old retire/start messages cannot touch it.
 nested.init_thread(1);nested.beep_test_init();nested.beep_test_begin(750,100);
 const fresh=nested.beep_test_token();assert(fresh>retired[0]);
 assert.equal(h.host.beep_retire_thread(2,...oldRoot),0);
 assert.equal(h.host.beep_start(750,100,2,...oldRoot),-995);
 assert.equal(h.host.beep_status(fresh,0),0);
 // A new process epoch retires every old generation, including other threads.
 e.beep_test_process_reset();assert.equal(h.host.beep_status(fresh,0),-6);
 assert.equal(h.host.beep_thread_begin(2,...oldRoot,...oldEpoch),-995);
 assert.equal(h.host.beep_process_begin(...oldEpoch),-995);
 h.hostCtx.stopAudio();
 console.log('Production Beep alertable continuation, actual guest APC/nesting and cancellation: PASS; tailCalls='+tailCalls);
})().catch(e=>{console.error(e);process.exitCode=1});

#!/usr/bin/env node
'use strict';
// Real simultaneous WASM instances: the former plain head/tail/count updates
// duplicated packets and underflowed count on the first two-consumer round.
const assert=require('assert');
const {Worker,isMainThread,parentPort,workerData}=require('worker_threads');
const Region=require('../lib/region-map.generated');
const extra=String.raw`
  (global $q_output_probe (mut i32) (i32.const 0))
  (func (export "q_arm_output_probe") (global.set $q_output_probe (i32.const 1)))
  (func (export "q_create") (param i32 i32 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    (call $handle_CreateIoCompletionPort (local.get 0) (local.get 1) (local.get 2)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "q_post") (param i32 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    (call $handle_PostQueuedCompletionStatus (local.get 0) (local.get 1)
      (local.get 1) (local.get 1) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "q_get") (param i32 i32 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
    (global.set $yield_reason (i32.const 0))
    (call $handle_GetQueuedCompletionStatus (local.get 0) (local.get 1)
      (i32.add (local.get 1) (i32.const 4)) (i32.add (local.get 1) (i32.const 8))
      (local.get 2) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "q_close") (param i32) (result i32) (call $iocp_close (local.get 0)))
  (func (export "q_bound") (param i32) (result i32) (call $iocp_assoc_find (local.get 0)))
  (func (export "q_complete") (param i32 i32) (result i32)
    (call $iocp_complete_overlapped (local.get 0) (local.get 1) (i32.const 17) (i32.const 0)))
  (func (export "q_error") (result i32) (global.get $last_error))
`;
function instantiate(module,memory,tid,hooks={}){
  const host={memory};let clock=100;
  for(const item of WebAssembly.Module.imports(module))
    if(item.kind==='function')host[item.name]=()=>0;
  host.get_ticks=()=>{
    assert.strictEqual(new Int32Array(memory.buffer,Region.BASE.IOCP_TABLE+0x6400,1)[0],0,
      'guest clock callback runs outside IOCP lock');
    clock+=20;return clock;
  };
  host.log_i32=value=>{
    if(value!==0x1C0C) return;
    assert.strictEqual(new Int32Array(memory.buffer,Region.BASE.IOCP_TABLE+0x6400,1)[0],0,
      'guest output translation/callback runs outside IOCP lock');
    hooks.onOutput?.();
  };
  const e=new WebAssembly.Instance(module,{host}).exports;
  e.init_thread(tid,0x400000,0,0,0,0,0);return e;
}
function get(e,port,out){
  if(!e.q_get(port,out,0))return null;
  return [0,4,8].map(offset=>e.guest_read32(out+offset)>>>0);
}
if(!isMainThread){
  const e=instantiate(workerData.module,workerData.memory,workerData.tid);
  const gate=new Int32Array(workerData.gate),out=0x420000+workerData.tid*64;
  parentPort.on('message',({mode,port,start=1,count=256})=>{
    Atomics.add(gate,1,1);Atomics.notify(gate,1);
    while(Atomics.load(gate,0)===0)Atomics.wait(gate,0,0);
    const result=[],limit=Date.now()+5000;
    if(mode==='create'){
      for(let i=0;i<count;i++)result.push(e.q_create(-1,0,0)>>>0);
    }else if(mode==='close'){
      result.push(e.q_close(port));
    }else if(mode==='post'){
      for(let i=0;i<count;i++){
        while(!e.q_post(port,start+i))if(Date.now()>limit)throw new Error('producer timeout');
      }
    }else{
      for(let i=0;i<count;i++){
        let packet=get(e,port,out);
        if(mode==='drain'&&!packet)break;
        while(!packet){if(Date.now()>limit)throw new Error('consumer timeout');packet=get(e,port,out);}
        result.push(packet);
      }
    }
    parentPort.postMessage(result);
  });
  parentPort.postMessage('ready');
}else{
  (async()=>{
    const {compileSrcWasm}=require('./compile-src');
    const wasm=compileSrcWasm((file,source)=>{
      if(file==='13-exports.wat')return source+'\n'+extra;
      if(file==='03-registers.wat'){
        const start=source.indexOf('(func $gs32 ');
        const insertion=source.indexOf('(local.set $wa ',start);
        assert(start>=0&&insertion>start);
        // A one-shot hook models a translating store entering host/fault
        // handling, without modifying the IOCP implementation under test.
        return source.slice(0,insertion)+`(if (global.get $q_output_probe)
          (then (global.set $q_output_probe (i32.const 0))
            (call $host_log_i32 (i32.const 0x1C0C))))\n    `+source.slice(insertion);
      }
      return source;
    });
    const module=new WebAssembly.Module(wasm),memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
    const hooks={},e=instantiate(module,memory,1,hooks),gate=new SharedArrayBuffer(8),words=new Int32Array(gate);
    const workers=[2,3].map(tid=>new Worker(__filename,{workerData:{module,memory,gate,tid}}));
    const message=w=>new Promise((resolve,reject)=>{
      const done=value=>{w.removeListener('error',failed);resolve(value);};
      const failed=error=>{w.removeListener('message',done);reject(error);};
      w.once('message',done);w.once('error',failed);
    });
    const deadline=setTimeout(()=>{workers.forEach(w=>w.terminate());throw new Error('IOCP concurrency deadline');},30000);
    const lock=new Int32Array(memory.buffer,Region.BASE.IOCP_TABLE+0x6400,2);
    const unlocked=()=>assert.deepStrictEqual(Array.from(lock),[0,0],'all IOCP exit paths release lock');
    const together=async jobs=>{
      Atomics.store(words,0,0);Atomics.store(words,1,0);
      const replies=workers.map(message);workers.forEach((w,i)=>w.postMessage(jobs[i]));
      const readyDeadline=Date.now()+5000;
      while(Atomics.load(words,1)!==2){
        if(Date.now()>readyDeadline)throw new Error('Worker start barrier timeout');
        Atomics.wait(words,1,Atomics.load(words,1),100);
      }
      Atomics.store(words,0,1);Atomics.notify(words,0);
      return Promise.all(replies);
    };
    const verify=(packets,count)=>{
      assert.strictEqual(packets.length,count,'exact completion count');
      for(const packet of packets)assert(packet.every(v=>v===packet[0]),'completion tuple cannot tear');
      assert.deepStrictEqual(packets.map(p=>p[0]).sort((a,b)=>a-b),Array.from({length:count},(_,i)=>i+1),
        'each posted completion is delivered exactly once');
      unlocked();
    };
    try{
      await Promise.all(workers.map(message));
      // Concurrent creation must reserve distinct slots.
      const ports=(await together([{mode:'create',count:4},{mode:'create',count:4}])).flat();
      assert.strictEqual(new Set(ports).size,8);assert(ports.every(Boolean));
      assert.strictEqual(e.q_create(-1,0,0),0);assert.strictEqual(e.q_error(),8);unlocked();
      ports.forEach(port=>assert.strictEqual(e.q_close(port),1));unlocked();
      const port=e.q_create(-1,0,0)>>>0;
      for(let round=0;round<30;round++){
        for(let id=1;id<=256;id++)assert.strictEqual(e.q_post(port,id),1);
        assert.strictEqual(e.q_post(port,257),0);assert.strictEqual(e.q_error(),298);unlocked();
        verify((await together([{mode:'drain',port},{mode:'drain',port}])).flat(),256);
        assert.strictEqual(e.q_get(port,0x420000,0),0);unlocked();
      }
      // Two producers must reserve distinct tail entries.
      await together([{mode:'post',port,start:1,count:128},{mode:'post',port,start:129,count:128}]);
      verify(Array.from({length:256},()=>get(e,port,0x420000)),256);
      // Producer and consumer wrap the ring repeatedly at the same time.
      const mixed=await together([{mode:'post',port,count:4096},{mode:'consume',port,count:4096}]);
      verify(mixed[1],4096);
      assert.strictEqual(e.q_get(port,0x420000,0),0);assert.strictEqual(e.q_error(),258);unlocked();
      e.q_get(port,0x420000,10);assert.strictEqual(e.get_yield_reason(),9);unlocked();
      e.q_get(port,0x420000,10);assert.strictEqual(e.q_error(),258);unlocked();
      e.q_get(port,0x420000,-1);assert.strictEqual(e.get_yield_reason(),9);unlocked();
      assert.strictEqual(e.q_create(-1,port,0),0);assert.strictEqual(e.q_error(),87);unlocked();
      assert.strictEqual(e.q_create(44,0x1234,0),0);assert.strictEqual(e.q_error(),6);unlocked();
      assert.strictEqual(e.q_post(0x1234,1),0);assert.strictEqual(e.q_error(),6);unlocked();
      assert.strictEqual(e.q_get(0x1234,0x420000,0),0);assert.strictEqual(e.q_error(),6);unlocked();
      assert.strictEqual(e.q_close(0x1234),0);unlocked();
      for(let i=0;i<64;i++)assert.strictEqual(e.q_create(100+i,port,i)>>>0,port);
      assert.strictEqual(e.q_create(999,port,0),0);assert.strictEqual(e.q_error(),8);unlocked();
      assert.deepStrictEqual((await together([{mode:'close',port},{mode:'close',port}])).flat().sort(),[0,1],
        'concurrent closes retire a live port exactly once');
      assert.strictEqual(e.q_create(-1,0,0)>>>0,port);
      for(let i=0;i<64;i++)assert.strictEqual(e.q_bound(100+i),0);
      assert.strictEqual(e.q_create(44,port,123)>>>0,port);
      assert(e.q_bound(44));assert.strictEqual(e.q_close(port),1);assert.strictEqual(e.q_bound(44),0);
      assert.strictEqual(e.q_post(port,1),0);assert.strictEqual(e.q_error(),6);unlocked();
      const reused=e.q_create(-1,0,0)>>>0;
      assert.strictEqual(reused,port);
      assert.strictEqual(e.q_complete(44,0x420100),0,'closed port associations cannot target reused slot');
      assert.strictEqual(e.q_get(reused,0x420000,0),0);unlocked();
      // Pop owns a local tuple before guest stores can reenter the process.
      e.q_post(reused,123);
      let probes=0;hooks.onOutput=()=>{probes++;};
      e.q_arm_output_probe();assert.deepStrictEqual(get(e,reused,0x420000),[123,123,123]);
      assert.strictEqual(probes,1);
      // Replacing a port from an output-store callback must not publish the
      // old in-flight file completion into the new slot generation.
      e.q_create(45,reused,456);
      hooks.onOutput=()=>{
        probes++;assert.strictEqual(e.q_close(reused),1);
        assert.strictEqual(e.q_create(-1,0,0)>>>0,reused);
      };
      e.q_arm_output_probe();assert.strictEqual(e.q_complete(45,0x420100),1);
      assert.strictEqual(probes,2);assert.strictEqual(e.q_get(reused,0x420000,0),0);unlocked();
      e.q_close(reused);
      console.log('PASS real Worker IOCP create, producers, consumers, wraparound, timeout, failure and close/reuse');
    }finally{clearTimeout(deadline);await Promise.all(workers.map(w=>w.terminate()));}
  })().catch(error=>{console.error(error);process.exitCode=1;});
}

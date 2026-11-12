#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {createAudioHost}=require('../lib/host-audio');
const {GuestThreadHost}=require('../lib/guest-thread-host');
const {audioContext}=require('./test-beep-output');
(async()=>{
 const ac=audioContext(),ctx={getMemory:()=>new ArrayBuffer(4096)},h=createAudioHost(ctx,{}).imports;
 ctx._voices._ensureCtx=()=>ac;
 assert.equal(h.beep_process_begin(10,1),1);
 assert.equal(h.beep_thread_begin(2,11,1,10,1),1);
 const start=()=>h.beep_start(750,100,2,11,1),first=start(),late=ac.nodes.at(-1).onended;
 assert(first>0);assert.equal(h.beep_retire_thread(2,11,1),1);
 assert.equal(start(),-995);assert.equal(h.beep_status(first,1),-6);
 assert.equal(h.beep_thread_begin(2,11,1,10,1),-995);
 assert.equal(h.beep_thread_begin(2,12,1,10,1),1);
 const second=h.beep_start(750,100,2,12,1);assert(second>first);
 late();assert.equal(h.beep_status(second,0),0,'late completion cannot touch new owner');
 assert.equal(h.beep_retire_thread(2,11,1),0);assert.equal(start(),-995);
 assert.equal(h.beep_status(second,0),0);
 // Exercise the production backend stop ordering with a pending retirement
 // promise: output fences synchronously, before a Worker termination resolves.
 let complete;
 const pending=new Promise(r=>{complete=r;});
 const backend=new GuestThreadHost({hostImports:h,log:()=>{}});
 backend.threadLinks.set(1,{stop:()=>pending});
 const stop=backend.stop();
 assert.equal(h.beep_status(second,0),-6);assert.equal(h.beep_start(750,100,2,12,1),-995);
 assert.equal(h.beep_thread_begin(2,13,1,10,1),-995);
 complete();await stop;
 assert.equal(h.beep_process_begin(10,1),-995,'old epoch cannot undo shutdown');
 assert.equal(h.beep_process_begin(20,1),1);
 assert.equal(h.beep_thread_begin(2,21,1,20,1),1);
 const third=h.beep_start(750,100,2,21,1);assert(third>second);
 assert.equal(h.beep_thread_begin(2,12,1,10,1),-995,'stale generation after process reset');
 assert.equal(h.beep_retire_thread(2,12,1),0);
 assert.equal(h.beep_status(third,0),0);
 ctx.stopAudio();assert.equal(h.beep_status(third,0),-6);
 console.log('Beep process/thread generations, stale requests and production backend stop ordering: PASS');
})().catch(e=>{console.error(e);process.exitCode=1});

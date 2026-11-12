#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const { createAudioHost } = require('../lib/host-audio');

// A controlled Web Audio boundary lets us prove the real host graph's
// scheduling/cleanup without claiming audible browser or OS-device evidence.
function audioContext() {
 const ac = { state:'running', sampleRate:96000, currentTime:2, destination:{}, nodes:[] };
 ac.createGain=()=>({gain:{value:1},connect(to){this.to=to;},disconnect(){this.disconnected=true;}});
 ac.createOscillator=()=>{
  const n={frequency:{value:0},connect(to){this.to=to;},disconnect(){this.disconnected=true;},
   start(t){this.startAt=t;},stop(t){this.stops??=[];this.stops.push(t);}};
  ac.nodes.push(n); return n;
 };
 return ac;
}
function fixture(ac=audioContext(), sharedAudio={}) {
 const ctx={getMemory:()=>new ArrayBuffer(4096),sharedAudio};
 const host=createAudioHost(ctx,{}).imports;
 host.beep_process_begin(1,0);host.beep_thread_begin(1,2,0,1,0);
 const start=host.beep_start;
 host.beep_start=(f,d,tid=1,lo=2,hi=0)=>start(f,d,tid,lo,hi);
 ctx._voices._ensureCtx=()=>ac;
 return {ctx,host,ac,sharedAudio};
}
function cases() {
 const {ctx,host:h,ac,sharedAudio}=fixture();
 const id=h.beep_start(750,300),n=ac.nodes[0];assert(id>0);
 assert.equal(n.frequency.value,750);assert.equal(n.type,'sine');
 assert.equal(n.startAt,2);assert.equal(n.stops[0],2.3);
 assert(n.to.to,'oscillator connects through gain to actual output bus');
 assert.equal(h.beep_status(id,1),0,'release cannot orphan pending tone');
 ac.currentTime=2.299;assert.equal(h.beep_status(id,0),0);
 ac.currentTime=2.3;n.onended();assert.equal(h.beep_status(id,0),1);
 assert(n.disconnected&&n.to.disconnected);assert.equal(n.onended,null);
 assert.equal(h.beep_status(id,1),1);assert.equal(h.beep_status(id,0),-6);
 const next=h.beep_start(1000,10);assert(next>id);ac.currentTime+=0.01;
 assert.equal(h.beep_status(next,1),1,'clock completion does not depend on JS event delivery');
 const cancel=h.beep_start(500,100),late=ac.nodes.at(-1).onended;
 assert.equal(h.beep_cancel(cancel),-995);late();assert.equal(h.beep_status(cancel,1),-995);
 assert.equal(h.beep_cancel(cancel),-6);
 const interrupted=h.beep_start(500,100);ac.nodes.at(-1).onended();
 assert.equal(h.beep_status(interrupted,1),-995,'early ended is aborted, never success');
 const suspended=h.beep_start(500,100);ac.state='suspended';
 assert.equal(h.beep_status(suspended,1),-995);assert.equal(h.beep_start(500,100),-50);
 ac.state='running';const closed=h.beep_start(500,100);ac.state='closed';
 assert.equal(h.beep_status(closed,1),-995);ac.state='running';
 for(const f of [37,32767]){const bound=h.beep_start(f,60000);assert(bound>0);h.beep_cancel(bound);assert.equal(h.beep_status(bound,1),-995);}
 const before=ac.nodes.length;
 for(const f of [0,36,32768,-1])assert.equal(h.beep_start(f,100),-87);
 assert.equal(h.beep_start(500,0),-87);assert.equal(h.beep_start(500,60001),-50);
 assert.equal(h.beep_start(500,-1),-50);assert.equal(ac.nodes.length,before);
 ac.sampleRate=44100;assert.equal(h.beep_start(32767,100),-50);ac.sampleRate=96000;
 const sibling=fixture(ac,sharedAudio).host;
 const shared=h.beep_start(500,100);assert.equal(sibling.beep_status(shared,0),0);
 assert.equal(sibling.beep_cancel(shared),-995);assert.equal(h.beep_status(shared,1),-995);
 const ids=Array.from({length:64},()=>h.beep_start(500,100));assert(ids.every(x=>x>0));
 assert.equal(h.beep_start(500,100),-8);
 for(const token of ids){h.beep_cancel(token);assert.equal(h.beep_status(token,1),-995);}
 const stop=h.beep_start(500,100);ctx.stopAudio();assert.equal(h.beep_status(stop,1),-6);
 assert.equal(h.beep_start(500,100),-995);
 const unavailable=fixture(null);assert.equal(unavailable.host.beep_start(500,100),-50);
 unavailable.ctx.audioTap=()=>({active:true,pcm(){throw Error('recorder must not become output');}});
 assert.equal(unavailable.host.beep_start(500,100),-50,'recording never changes availability');
 const failed=fixture();failed.ac.createOscillator=()=>{throw Error('device failure');};
 assert.equal(failed.host.beep_start(500,100),-31);assert.equal(failed.sharedAudio.beepTones.size,0);
 const partial=fixture();partial.ac.createGain=()=>{throw Error('gain failure');};
 assert.equal(partial.host.beep_start(500,100),-31);assert(partial.ac.nodes[0].disconnected);
 assert.equal(partial.sharedAudio.beepTones.size,0);
 const exhausted=fixture();exhausted.sharedAudio.beepNext=0x80000000;
 assert.equal(exhausted.host.beep_start(500,100),-8);assert.equal(exhausted.ac.nodes.length,0);
}
if(require.main===module){cases();console.log('Beep output token scheduling, completion, cancellation and failure: PASS');}
module.exports={audioContext,cases};

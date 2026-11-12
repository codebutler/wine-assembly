'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm');
const {fixture}=require('./fixture.cjs');
const parts=require('../enigma-uncertainty-independent-publication-oct26/tracked-runner-slices.json');
(async()=>{
 const normal=fixture('lazy');normal.context.schedule.push({batch:99999,action:'click',x:1,y:1},{batch:100001,action:'click',x:9,y:9});
 const result=await normal.run();assert.equal(result.enqueueOutcome,'acknowledged');assert(!('delivered' in result));
 assert.deepEqual(JSON.parse(JSON.stringify(normal.context.schedule)).map(e=>e.batch),[99999,100000,100001]);
 const trace=[],mouse=[];normal.context.inputConsumptionTrace={schedule:e=>trace.push({...e})};normal.context.logs=[];normal.context.batch=100000;
 normal.renderer.handleMouseDown=(x,y,b)=>mouse.push(['down',x,y,b]);normal.renderer.handleMouseUp=(x,y,b)=>mouse.push(['up',x,y,b]);
 vm.runInContext(`{let injectedInputThisBatch=false;${parts.drainPrefix}
 if(false) {${parts.clickBody}
 }
 }globalThis.injected=injectedInputThisBatch;}`,normal.context);
 assert.equal(normal.context.injected,true);assert.equal(trace.length,2);assert.equal(mouse.length,4);assert.equal(trace[1].x,344);assert.equal(trace[1].y,212);
 assert.equal(normal.context.schedule.length,1);assert.equal(normal.context.schedule[0].batch,100001);
 await assert.rejects(normal.run(),/consumed/);assert.equal(normal.context.schedule.length,1);
 const lost=fixture('lostReplyEnvelope');await assert.rejects(lost.run(),e=>e.code==='ENIGMA_ENQUEUE_OUTCOME_UNKNOWN'&&e.enqueueOutcome==='unknown'&&!/no click/i.test(e.message));
 assert.equal(lost.context.schedule.length,1);assert.equal(lost.renderer.repaint,lost.original);await assert.rejects(lost.run(),/consumed/);assert.throws(()=>lost.context.command(lost.atomicRequests[0]));assert.equal(lost.context.schedule.length,1);
 const pre=fixture('cleanupError');await assert.rejects(pre.run(),e=>e.code==='ENIGMA_NOT_DISPATCHED');assert.equal(pre.context.schedule.length,0);assert.equal(pre.atomicRequests.length,0);
 console.log(JSON.stringify({groups:3,results:['production-wired-normal-canonical-parser-drain-preserves-prior-and-future','production-wired-lost-envelope-unknown-consumed-no-replay','production-wired-known-predispatch-refusal'],trace,mouse,limits:'mock renderer sinks, trusted ordinary objects; no guest delivery or gameplay; malicious getter diagnostic remains outside contract',guestExecutions:0}));
})().catch(e=>{console.error(e);process.exitCode=1});

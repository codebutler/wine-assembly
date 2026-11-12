'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const {fixture}=require('./fixture.cjs');
const {fixture:unchangedFixture}=require('../enigma-atomic-click-independent-accept-oct26/fixture.cjs');
const {createController,ATOMIC_ACTION,wireRunner}=require('../../../tools/enigma-presented-menu-controller.cjs');
const parts=require('./tracked-runner-slices.json');
const rows=[];
async function examine(name,f,expected){
 let error=null,result;try{result=await f.run()}catch(e){error=e}
 const clicks=f.context.schedule.filter(e=>e.action==='click');assert.equal(clicks.length,expected.clicks,name);
 if(expected.outcome==='unknown'){
  assert(error,name);assert.equal(error.code,'ENIGMA_ENQUEUE_OUTCOME_UNKNOWN');assert.equal(error.enqueueOutcome,'unknown');assert.doesNotMatch(error.message,/no click/i);
 }else if(expected.outcome==='not-dispatched'){
  assert(error,name);assert.equal(error.code,'ENIGMA_NOT_DISPATCHED');assert.equal(error.enqueueOutcome,'not-dispatched');assert.equal(f.atomicRequests.length,0);
 }else {assert.equal(error,null);assert.equal(result.enqueueOutcome,'acknowledged');assert.equal(result.click.queued,true);assert(!('delivered' in result));}
 assert.equal(f.renderer.repaint,f.original,name);
 const before=f.context.schedule.length;await assert.rejects(f.run(),/consumed/);assert.equal(f.context.schedule.length,before);
 if(f.atomicRequests.length){assert.throws(()=>f.context.command(f.atomicRequests[0]));assert.equal(f.context.schedule.length,before)}
 rows.push({name,result:expected.outcome,error:error?{message:error.message,code:error.code,enqueueOutcome:error.enqueueOutcome}:null,queuedClicks:clicks.length,atomicRequests:f.atomicRequests.length,replay:'consumed/no second click',wrapperRestored:true});fs.writeFileSync(__dirname+'/case-progress.json',JSON.stringify(rows,null,2)+'\n');
}
(async()=>{
 // Exact original lost-reply fixture unchanged, with stronger truthful oracle.
 if(!process.argv.includes('--remaining')) await examine('unchanged-original-lost-reply-envelope',unchangedFixture('lostReplyEnvelope'),{clicks:1,outcome:'unknown'});
 for(const fault of (process.argv.includes('--remaining')?[]:['lostReplyThrow','lostReplyEnvelope','missingValue','missingEnvelope','nullAck','malformedAck','wrongBatch','badOk']))
  await examine('actual-tracked-handler-'+fault,fixture(fault),{clicks:1,outcome:'unknown'});
 for(const fault of (process.argv.includes('--remaining')?[]:['cleanupError','lostWitness']))
  await examine('actual-tracked-handler-known-predispatch-'+fault,fixture(fault),{clicks:0,outcome:'not-dispatched'});
 await examine('actual-tracked-handler-lateBatch-after-dispatch',fixture('lateBatch'),{clicks:0,outcome:'unknown'});
 await examine('actual-tracked-handler-normal-ack',fixture('lazy'),{clicks:1,outcome:'acknowledged'});
 // Trace exact parser/drain/click branch, with mocked renderer sinks only.
 const f=fixture('lazy');f.context.schedule.push({batch:99999,action:'click',x:1,y:1},{batch:100001,action:'click',x:9,y:9});
 await f.run();assert.deepEqual(JSON.parse(JSON.stringify(f.context.schedule)).map(e=>e.batch),[99999,100000,100001]);
 const trace=[],mouse=[];f.context.inputConsumptionTrace={schedule:e=>trace.push({...e})};f.context.logs=[];f.context.batch=100000;
 f.renderer.handleMouseDown=(x,y,b)=>mouse.push(['down',x,y,b]);f.renderer.handleMouseUp=(x,y,b)=>mouse.push(['up',x,y,b]);
 // Execute byte-exact prefix and click body; absent unrelated 2600-line action chain is explicit.
 vm.runInContext(`{let injectedInputThisBatch=false;${parts.drainPrefix}
 if(false) {${parts.clickBody}
 }
 }globalThis.injected=injectedInputThisBatch;}`,f.context);
 assert.equal(f.context.injected,true);assert.equal(trace.length,2);assert.equal(mouse.length,4);
 assert.equal(trace[1].x,344);assert.equal(trace[1].y,212);assert.equal(f.context.schedule.length,1);assert.equal(f.context.schedule[0].batch,100001);
 rows.push({name:'actual-tracked-parser-drain-click-branch',result:'PASS',trace,mouse,remainingFutureEvents:1,limit:'mock renderer sinks, no guest delivery'});
 const source=fs.readFileSync(process.argv[2],'utf8');let wiringError=null;try{wireRunner(source)}catch(e){wiringError=e.message}
 assert.match(wiringError,/runner source identity mismatch/);
 rows.push({name:'production-wireRunner-actual-tracked-runner',result:'BLOCKED_EXPECTED_MISMATCH',actualSHA256:crypto.createHash('sha256').update(source).digest('hex'),error:wiringError});
 console.log(JSON.stringify({candidate:'5093c90b5ea7e501a8f77c78cec937f6bcf486f3',protocol:'ACCEPT',publication:'BLOCKED_TRACKED_RUNNER_IDENTITY',guestExecutions:0,results:rows}));
})().catch(e=>{console.error(e);process.exitCode=1});

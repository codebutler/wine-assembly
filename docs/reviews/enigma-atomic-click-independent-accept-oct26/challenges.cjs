'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const {fixture}=require('./fixture.cjs');
const {wireRunner,ATOMIC_BRANCH}=require('../../../tools/enigma-presented-menu-controller.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(process.argv[2],'utf8');
assert.equal(sha(source),'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809');
const wired=wireRunner(source);
assert.equal(sha(wired),'572bb3ef26cd5d7e2d118f25c9faa2991a1226b6e7beb7342cae3cb1d3f88646');
assert.equal(wired.replace(ATOMIC_BRANCH,''),source);assert.equal(Buffer.byteLength(wired),687334);
const witness='for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))';
const cases=[
 {name:'ordinary-lazy',fault:'lazy',clicks:1},
 {name:'ordinary-eager',fault:'eager',clicks:1},
 {name:'unchanged-lostWitness-injection',fault:'lostWitness',clicks:0,error:true},
 {name:'unchanged-lateBatch-injection',fault:'lateBatch',clicks:0,error:true},
 ...Object.entries({batch:'state.tickState.batch++',frozen:'freezeFault()',credits:'creditsFault()',recording:'recordFault()',count:witness+'globalThis[k].count++',identity:witness+'globalThis[k]={...globalThis[k]}',missing:witness+'delete globalThis[k]',wrapper:'renderer.repaint=()=>{}',prepared:witness+'globalThis[k].prepared=false',extraPaint:'renderer.repaint()'}).map(([name,code])=>({name:'final-'+name,fault:{at:6,code},clicks:0,error:true,foreign:name==='wrapper'})),
 {name:'transport-before-dispatch',fault:'beforeTransportLoss',clicks:0,error:true},
 {name:'atomic-success-reply-lost-envelope',fault:'lostReplyEnvelope',clicks:1,error:true,truthful:true},
 {name:'atomic-success-reply-lost-throw',fault:'lostReplyThrow',clicks:1,error:true,truthful:true},
 {name:'atomic-success-malformed-ack',fault:'malformedAck',clicks:1,error:true,truthful:true},
 {name:'duplicate-atomic-request',fault:'duplicateRequest',clicks:1},
 {name:'preexisting-due-and-future-queue',fault:'lazy',clicks:2,prequeue:true},
 // A malicious synchronous getter is outside the documented trusted runner
 // contract. Keep it visible: synchronous does not itself imply non-reentrancy.
 {name:'getter-invalidates-after-final-batch-read',fault:{at:6,code:witness+'{const s=globalThis[k],original=s.original;Object.defineProperty(s,"original",{get(){state.tickState.batch++;return original}})}'},diagnostic:true},
];
(async()=>{
 const rows=[];
 for(const c of cases){
  const f=fixture(c.fault);
  if(c.diagnostic){for(const k of Object.getOwnPropertySymbols(f.context))void k;}
  if(c.prequeue)f.context.schedule.push({batch:99999,action:'click',x:1,y:1},{batch:100001,action:'keypress',key:13});
  let error=null;try{await f.run()}catch(e){error=e.message}
  const clicks=f.context.schedule.filter(e=>e.action==='click');
  const row={name:c.name,error,queuedClicks:clicks.length,wrapperRestored:f.renderer.repaint===f.original,atomicRequests:f.atomicRequests.length,queue:JSON.parse(JSON.stringify(f.context.schedule))};
  if(!c.diagnostic){
   assert.equal(clicks.length,c.clicks,c.name);assert.equal(!!error,!!c.error,c.name);
   if(!c.foreign)assert.equal(row.wrapperRestored,true,c.name);
   if(c.prequeue)assert.deepEqual(row.queue.map(x=>x.batch),[99999,100000,100001]);
   if(c.fault==='duplicateRequest')assert.equal(f.duplicateReply.ok,false);
   if(c.truthful)row.truthfulness= /no click/i.test(error)?'FAIL_FALSE_NO_CLICK':'PASS_NO_FALSE_NO_CLICK';
  }
  const before=f.context.schedule.length;
  await assert.rejects(f.run(),/consumed/);assert.equal(f.context.schedule.length,before);
  if(f.atomicRequests.length){assert.throws(()=>f.context.command(f.atomicRequests[0]));assert.equal(f.context.schedule.length,before);}
  row.replay='no second enqueue';rows.push(row);
 }
 console.log(JSON.stringify({candidate:'a42e321f7a0d604503ad6f5ae6d76174130e525b',verdict:rows.some(x=>x.truthfulness==='FAIL_FALSE_NO_CLICK')?'REJECT':'REVIEW',wiredSHA256:sha(wired),guestExecutions:0,results:rows}));
})().catch(e=>{console.error(e);process.exitCode=1});

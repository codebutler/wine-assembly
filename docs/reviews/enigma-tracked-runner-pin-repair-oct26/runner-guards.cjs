'use strict';
const assert=require('node:assert/strict');
const {fixture}=require('./fixture.cjs'),{fixture:stock}=require('../enigma-uncertainty-independent-publication-oct26/stock-fixture.cjs');
const witness='for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))';
(async()=>{
 const rows=[];
 for(const [name,code] of Object.entries({batch:'state.tickState.batch++',frozen:'freezeFault()',credits:'creditsFault()',recording:'recordFault()',count:witness+'globalThis[k].count++',identity:witness+'globalThis[k]={...globalThis[k]}',missing:witness+'delete globalThis[k]',wrapper:'renderer.repaint=()=>{}',prepared:witness+'globalThis[k].prepared=false',extraPaint:'renderer.repaint()'})){
  const f=fixture({at:6,code});let error;try{await f.run()}catch(e){error=e}
  assert(error,name);assert.equal(error.code,'ENIGMA_ENQUEUE_OUTCOME_UNKNOWN');assert.equal(error.enqueueOutcome,'unknown');assert.equal(f.context.schedule.length,0);assert.equal(f.atomicRequests.length,1);
  if(name!=='wrapper')assert.equal(f.renderer.repaint,f.original);
  await assert.rejects(f.run(),/consumed/);assert.equal(f.context.schedule.length,0);
  assert.throws(()=>f.context.command(f.atomicRequests[0]));assert.equal(f.context.schedule.length,0);
  rows.push({name,result:'PASS',queued:0,classification:'unknown after dispatch; no replay'});
 }
 const f=stock('lazy');await assert.rejects(f.run(),e=>e.code==='ENIGMA_ENQUEUE_OUTCOME_UNKNOWN');assert.equal(f.context.schedule.length,0);assert.equal(f.renderer.repaint,f.original);await assert.rejects(f.run(),/consumed/);
 rows.push({name:'actual-unmodified-stock-handler',result:'PASS_FAIL_CLOSED',queued:0,limit:'no atomic command support; not compatible with controller'});
 console.log(JSON.stringify({candidate:'5093c90b5ea7e501a8f77c78cec937f6bcf486f3',cases:rows.length,results:rows,guestExecutions:0}));
})().catch(e=>{console.error(e);process.exitCode=1});

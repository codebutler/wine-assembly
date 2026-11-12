'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MENU,createController,ATOMIC_ACTION,ATOMIC_BRANCH,wireRunner}=require('../../../tools/enigma-presented-menu-controller.cjs');
const parts=require('./runner-slices.json');
const png=fs.readFileSync(path.join(__dirname,'../../re-notes/enigma-start-game-menu-click-api-oct26/predecessor-menu.png'));
function fixture(fault) {
 const files=new Map(),events=[];let paints=0;
 const canvas={width:640,height:480,ready:fault==='eager',toBufferSync(){assert(this.ready);events.push('serialize');return Buffer.from(png)}};
 const renderer={canvas,windows:{main:{hwnd:1,title:MENU.title,visible:true}},repaint(){paints++;canvas.ready=true}};
 const original=renderer.repaint;
 const fakeFS={existsSync:p=>files.has(p),writeFileSync:(p,b)=>files.set(p,b),statSync:p=>({isFile:()=>true,size:files.get(p).length}),readFileSync:p=>files.get(p)};
 const context=vm.createContext({Buffer,renderer,fs:fakeFS,process:{getBuiltinModule:n=>n==='fs'?fakeFS:require('node:'+n)}});
 vm.runInContext(`
 const tickState={batch:100000},instance={exports:{get_eip:()=>0}},memory={},g2w=()=>0,ctx={},resolveAddr=()=>0,moduleBases={};
 let controlFrozen=true,controlRunCredits=0,videoRecorder=null;
 const batchClock={getTickMsPerBatch:()=>1},scheduledInput=[],liveOutstanding=new Map();
 let dxPresentHook=null;const presentDxIfDirty=()=>{};
 ${parts.presentForRead}
 ${parts.dxPresentHook}
 ${parts.parseInputEntries}
 ${parts.snapshotAndSafeValue}
 ${parts.controlEval}
 ${parts.controlPng}
 ${parts.handleControlCommand.replace("    if (cmd.action === 'eval') return controlEval(cmd.code || '');",ATOMIC_BRANCH+"    if (cmd.action === 'eval') return controlEval(cmd.code || '');")}
 globalThis.command=handleControlCommand;
 globalThis.schedule=scheduledInput;
 globalThis.state={tickState};
 globalThis.freezeFault=()=>{controlFrozen=false};
 globalThis.recordFault=()=>{videoRecorder={}};
 globalThis.creditsFault=()=>{controlRunCredits=1};
 globalThis.noHook=()=>{dxPresentHook=null};
 `,context);
 let evals=0,requests=0;
 const boundary=typeof fault==='object'?fault:null;
 const ask=async cmd=>{
  events.push(cmd.action||cmd.cmd);requests++;
  if(boundary&&requests===boundary.at)vm.runInContext(boundary.code,context);
  try {
   if(cmd.action==='snapshot') {
    if(fault==='live')context.freezeFault();if(fault==='credits')context.creditsFault();if(fault==='recording')context.recordFault();
   }
   if(cmd.action==='png'&&fault==='noHook')context.noHook();
   if(cmd.action===ATOMIC_ACTION&&fault==='atomicLostReply'){await context.command(cmd);return {ok:false,error:'lost reply after enqueue'}}
   if(cmd.action==='eval') {
    evals++;
    if(evals===3) {
     // Faults at the cleanup request boundary; retain real runner handler.
     if(fault==='lostWitness')vm.runInContext('for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))delete globalThis[k]',context);
     if(fault==='lateBatch')context.state.tickState.batch++;
     if(fault==='replacedWrapper')renderer.repaint=()=>{};
     if(fault==='replacedState')vm.runInContext('for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))globalThis[k]={...globalThis[k]}',context);
     if(fault==='cleanupError')return {ok:false,error:'injected cleanup transport error'};
    }
   }
   let value=await context.command(cmd);
   if(cmd.action==='png'&&fault==='badPath')value.path='/wrong.png';
   if(cmd.action==='png'&&fault==='changedFrame'){let b=Buffer.from(files.get(cmd.path));b[b.length-20]^=1;files.set(cmd.path,b)}
   if(cmd.action==='eval'&&evals===2&&fault==='badEnvelope')return {ok:false,error:'injected read error'};
   return {ok:true,value};
  }catch(e){return {ok:false,error:e.message}}
 };
 return {run:createController(ask,'/owned/fresh.png'),context,renderer,original,events,get paints(){return paints}};
}
(async()=>{
 const results=[];
 const cases=['lazy','eager','live','credits','recording','noHook','badPath','changedFrame','badEnvelope','replacedWrapper','cleanupError','lostWitness','lateBatch','replacedState','atomicLostReply'];
 for(const at of [2,3,4,5,6])for(const [kind,code] of Object.entries({batch:'state.tickState.batch++',live:'freezeFault()',credits:'creditsFault()',recording:'recordFault()'}))cases.push({at,kind,code});
 // Changes after readback and after cleanup must also invalidate ownership/count.
 for(const at of [5,6])for(const [kind,code] of Object.entries({repaint:'renderer.repaint()',count:'for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))globalThis[k].count++',state:'for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))globalThis[k]={...globalThis[k]}',missing:'for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))delete globalThis[k]',wrapper:'renderer.repaint=()=>{}'}))cases.push({at,kind,code});
 for(const name of cases) {
  const f=fixture(name);let error=null;
  try{await f.run()}catch(e){error=e.message}
  const clicks=f.context.schedule.filter(e=>e.action==='click');
  const positive=['lazy','eager'].includes(name),lostReply=name==='atomicLostReply';
  if(positive){assert.equal(error,null);assert.equal(clicks.length,1);assert.equal(clicks[0].x,344);assert.equal(clicks[0].y,212)}
  else {assert(error,JSON.stringify(name));assert.equal(clicks.length,lostReply?1:0,JSON.stringify(name))}
  if(!['replacedWrapper'].includes(name)&&!(name&&name.kind==='wrapper'))assert.equal(f.renderer.repaint,f.original,JSON.stringify(name));
  await assert.rejects(f.run(),/consumed/);assert.equal(f.context.schedule.filter(e=>e.action==='click').length,clicks.length);
  // Replay the actual atomic request, independent of controller's local latch.
  assert.throws(()=>f.context.command({action:ATOMIC_ACTION,key:'wine.enigma.presented-menu.invalid',batch:100000}));assert.equal(f.context.schedule.filter(e=>e.action==='click').length,clicks.length);
  results.push({name,error,queuedClicks:clicks.length,wrapperRestored:f.renderer.repaint===f.original,paints:f.paints});
 }
 console.log(JSON.stringify({pass:results.length,guestExecutions:0,results}));
})().catch(e=>{console.error(e);process.exitCode=1});

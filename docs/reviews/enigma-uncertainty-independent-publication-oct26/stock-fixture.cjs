'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {MENU,createController}=require('../../../tools/enigma-presented-menu-controller.cjs');
const parts=require('./tracked-runner-slices.json');
const {ATOMIC_ACTION,ATOMIC_BRANCH,wireRunner}=require('../../../tools/enigma-presented-menu-controller.cjs');
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
 ${parts.handleControlCommand}
 globalThis.command=handleControlCommand;
 globalThis.schedule=scheduledInput;
 globalThis.state={tickState};
 globalThis.freezeFault=()=>{controlFrozen=false};
 globalThis.recordFault=()=>{videoRecorder={}};
 globalThis.creditsFault=()=>{controlRunCredits=1};
 globalThis.noHook=()=>{dxPresentHook=null};
 `,context);
 let evals=0;
 const innerAsk=async cmd=>{
  events.push(cmd.action||cmd.cmd);
  try {
   if(cmd.action==='snapshot') {
    if(fault==='live')context.freezeFault();if(fault==='credits')context.creditsFault();if(fault==='recording')context.recordFault();
   }
   if(cmd.action==='png'&&fault==='noHook')context.noHook();
   if(cmd.action==='eval') {
    evals++;
    if(evals===3) {
     // Faults at the cleanup request boundary; retain real runner handler.
     if(fault==='lostWitness')vm.runInContext('for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))delete globalThis[k]',context);
     if(fault==='lateBatch')context.state.tickState.batch++;
     if(fault==='replacedWrapper')renderer.repaint=()=>{};
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
 const atomicRequests=[];let requests=0,duplicateReply=null;
 const ask=async cmd=>{
  requests++;
  if(typeof fault==='object' && requests===fault.at)vm.runInContext(fault.code,context);
  if(cmd.action===ATOMIC_ACTION){
   atomicRequests.push({...cmd});
   if(fault==='beforeTransportLoss')throw Error('transport lost before dispatch');
   const reply=await innerAsk(cmd);
   if(fault==='lostReplyEnvelope')return {ok:false,error:'transport lost AFTER enqueue'};
   if(fault==='lostReplyThrow')throw Error('transport lost AFTER enqueue');
   if(fault==='missingValue')return {ok:true};
   if(fault==='missingEnvelope')return undefined;
   if(fault==='nullAck')return {ok:true,value:null};
   if(fault==='wrongBatch')return {ok:true,value:{queued:true,batch:100001}};
   if(fault==='badOk')return {ok:1,value:{queued:true,batch:100000}};
   if(fault==='malformedAck')return {ok:true,value:{queued:false,batch:100000}};
   if(fault==='duplicateRequest')duplicateReply=await innerAsk(cmd);
   return reply;
  }
  return innerAsk(cmd);
 };
 return {atomicRequests,get duplicateReply(){return duplicateReply},run:createController(ask,'/owned/fresh.png'),context,renderer,original,events,get paints(){return paints}};
}

module.exports={fixture};

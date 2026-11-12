'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../../..'),read=p=>fs.readFileSync(path.join(root,p));
const {wireRunner,ATOMIC_BRANCH,ATOMIC_ACTION,MENU,createController}=require(path.join(root,'tools/enigma-presented-menu-controller.cjs'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const original=read('docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-run.js');
const source=original.toString('utf8'),wired=wireRunner(source),encoded=Buffer.from(wired);
const pin='87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7';assert.equal(sha(original),pin);
const marker="    if (cmd.action === 'eval') return controlEval(cmd.code || '');";
const parts=JSON.parse(read('docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-runner-slices.json'));
const png=read('docs/re-notes/enigma-start-game-menu-click-api-oct26/predecessor-menu.png');assert.equal(sha(png),MENU.pngSHA256);
let checks=[];function check(name,f){f();checks.push(name)}
function transformation(){
 check('UTF8 whole-file byte conservation and unique exact atomic insertion',()=>{
  assert.equal(Buffer.from(source).compare(original),0);const offset=original.indexOf(Buffer.from(marker));assert.equal(offset,394820);
  assert.equal(encoded.subarray(0,offset).compare(original.subarray(0,offset)),0);
  assert.equal(encoded.subarray(offset+Buffer.byteLength(ATOMIC_BRANCH)).compare(original.subarray(offset)),0);
  assert.equal(encoded.length-original.length,1374);assert.equal(wired.split(ATOMIC_BRANCH).length,2);
  assert.equal(sha(encoded),'a9625e1d102883c27b1bd2de0bab560a44ab3bc7eb589b18e7a736100eb2a0da');
 });
 for(const [name,mutation] of Object.entries({sameLength:source.replace('const getArg','const setArg'),wrongUnicode:source.replace('→','←'),missing:source.replace(marker,''),duplicate:source.replace(marker,marker+marker),parserRename:source.replace('const parseInputEntries','const invalidInputEntries'),brokenSyntax:source.slice(0,-4),alreadyTransformed:wired})){
  check('reject '+name,()=>{assert.notEqual(mutation,source);assert.throws(()=>wireRunner(mutation),/runner source identity mismatch/)});
 }
 for(const missing of [undefined,null,{},17])check('reject source type '+typeof missing,()=>assert.throws(()=>wireRunner(missing)));
 check('original immutable after every rejection',()=>assert.equal(sha(original),pin));
}
// All executable snippets below are exact unique ranges from actual tracked
// source, except the production-generated handler. No full runner initialization.
for(const [name,body] of Object.entries(parts)){assert.equal(source.split(body).length,2,name+' exact unique slice')}
const handlerStart=wired.indexOf('  const handleControlCommand = (cmdIn) => {');
const handlerEnd=wired.indexOf('  const control = (CONTROL || CONTROL_STDIN)',handlerStart);
assert(handlerStart>0&&handlerEnd>handlerStart);
const handler=wired.slice(handlerStart,handlerEnd);
assert.equal(handler,parts.handleControlCommand.replace(marker,ATOMIC_BRANCH+marker));
function harness(fault){
 const files=new Map(),queueSeed=[{batch:99999,action:'click',x:1,y:2},{batch:100001,action:'click',x:9,y:10}],atomic=[],requests=[];let paint=0;
 const renderer={canvas:{width:640,height:480,toBufferSync:()=>Buffer.from(png)},windows:{main:{hwnd:1,title:MENU.title,visible:true}},repaint(){paint++}};const saved=renderer.repaint;
 const fakeFS={existsSync:p=>files.has(p),writeFileSync:(p,b)=>files.set(p,Buffer.from(b)),readFileSync:p=>files.get(p),statSync:p=>({isFile:()=>true,size:files.get(p).length})};
 const c=vm.createContext({Buffer,renderer,fs:fakeFS,process:{getBuiltinModule:n=>n==='fs'?fakeFS:require('node:'+n)}});
 vm.runInContext(`const tickState={batch:100000}, instance={exports:{get_eip:()=>0}},memory={},g2w=()=>0,ctx={},resolveAddr=()=>0,moduleBases={};
 let controlFrozen=true,controlRunCredits=0,videoRecorder=null;const batchClock={getTickMsPerBatch:()=>1},scheduledInput=[],liveOutstanding=new Map();
 let dxPresentHook=null;const presentDxIfDirty=()=>{};
 ${parts.presentForRead}\n${parts.dxPresentHook}\n${parts.parseInputEntries}\n${parts.snapshotAndSafeValue}\n${parts.controlEval}\n${parts.controlPng}\n${handler}
 globalThis.command=handleControlCommand;globalThis.queue=scheduledInput;
 globalThis.corrupt=code=>eval(code);`,c);
 c.queue.push(...queueSeed.map(e=>({...e})));
 const ask=async cmd=>{
  requests.push(cmd.action);
  if(cmd.action===ATOMIC_ACTION){atomic.push({...cmd});if(fault?.before)c.corrupt(fault.before)}
  if(fault?.predispatch && cmd.action==='snapshot')return {ok:false,error:'known snapshot refusal'};
  let value;try{value=c.command(cmd)}catch(e){return {ok:false,error:e.message}}
  if(cmd.action===ATOMIC_ACTION&&fault?.reply){if(fault.reply==='throw')throw Error('lost after handler');return fault.reply(value)}
  return {ok:true,value};
 };
 return {c,renderer,saved,atomic,requests,queueSeed,get paint(){return paint},run:createController(ask,'/owned/independent.png')};
}
async function protocol(){
 const h=harness();const result=await h.run();assert.equal(result.enqueueOutcome,'acknowledged');assert.equal(result.click.queued,true);assert(!Object.hasOwn(result,'delivered'));assert.equal(h.paint,1);assert.equal(h.renderer.repaint,h.saved);
 const q=JSON.parse(JSON.stringify(h.c.queue));assert.deepEqual(q.map(e=>e.batch),[99999,100000,100001]);assert.deepEqual(q[0],h.queueSeed[0]);assert.deepEqual(q[2],h.queueSeed[1]);assert.equal(q[1].action,'click');assert.equal(q[1].x,344);assert.equal(q[1].y,212);assert.equal(h.atomic.length,1);
 const trace=[],sinks=[];h.c.batch=100000;h.c.inputConsumptionTrace={schedule:e=>trace.push({...e})};h.c.logs=[];h.renderer.handleMouseDown=(...a)=>sinks.push(['down',...a]);h.renderer.handleMouseUp=(...a)=>sinks.push(['up',...a]);
 vm.runInContext(`{let injectedInputThisBatch=false;${parts.drainPrefix}\nif(false){${parts.clickBody}}\n}}`,h.c);
 assert.equal(trace.length,2);assert.deepEqual(sinks,[['down',1,2,1],['up',1,2,1],['down',344,212,1],['up',344,212,1]]);assert.equal(h.c.queue.length,1);assert.equal(h.c.queue[0].batch,100001);
 await assert.rejects(h.run(),/consumed/);assert.throws(()=>h.c.command(h.atomic[0]));assert.equal(h.c.queue.length,1);checks.push('production wired parser/handler/drain preserve existing due/future events; mock sinks only; one enqueue and no replay');
 const guards={batch:'tickState.batch++',credits:'controlRunCredits=1',frozen:'controlFrozen=false',recording:'videoRecorder={}',prepared:'for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))globalThis[k].prepared=false',paint:'renderer.repaint()',witness:'for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))delete globalThis[k]',count:'for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith("wine.enigma.presented-menu."))globalThis[k].count=0'};
 for(const [name,before] of Object.entries(guards)){
  const t=harness({before});await assert.rejects(t.run(),e=>e.code==='ENIGMA_ENQUEUE_OUTCOME_UNKNOWN');assert.equal(t.c.queue.length,2);assert.deepEqual(JSON.parse(JSON.stringify(t.c.queue)),t.queueSeed);assert.equal(t.renderer.repaint,t.saved);assert.equal(t.atomic.length,1);await assert.rejects(t.run(),/consumed/);checks.push('final-boundary '+name+' preserves preexisting queue and consumes controller');
 }
}
async function ambiguity(){
 const cases={throw:'throw',negative:()=>({ok:false,error:'lost envelope'}),absent:()=>undefined,missingValue:()=>({ok:true}),wrongBatch:v=>({ok:true,value:{...v,batch:v.batch+1}}),malformed:()=>({ok:true,value:{queued:false,batch:100000}})};
 for(const [name,reply] of Object.entries(cases)){
  const h=harness({reply});await assert.rejects(h.run(),e=>e.code==='ENIGMA_ENQUEUE_OUTCOME_UNKNOWN'&&e.enqueueOutcome==='unknown'&&!/no click/i.test(e.message));assert.equal(h.c.queue.length,3);assert.equal(h.renderer.repaint,h.saved);await assert.rejects(h.run(),/consumed/);assert.throws(()=>h.c.command(h.atomic[0]));assert.equal(h.atomic.length,1);assert.equal(h.c.queue.length,3);checks.push('post-enqueue '+name+' truthful unknown + consumed + no replay');
 }
 const p=harness({predispatch:true});await assert.rejects(p.run(),e=>e.code==='ENIGMA_NOT_DISPATCHED'&&e.enqueueOutcome==='not-dispatched');assert.equal(p.atomic.length,0);assert.equal(p.c.queue.length,2);checks.push('known predispatch snapshot refusal never invokes atomic handler');
}
(async()=>{const group=process.argv[2];if(group==='transform')transformation();else if(group==='protocol')await protocol();else if(group==='ambiguity')await ambiguity();else throw Error('group required');console.log(JSON.stringify({group,checks:checks.length,results:checks,controllerSHA256:sha(read('tools/enigma-presented-menu-controller.cjs')),runnerSHA256:sha(original),derivativeSHA256:sha(encoded),fixtureSHA256:sha(fs.readFileSync(__filename)),guestExecutions:0,contract:'trusted ordinary objects; excluded getter diagnostic unchanged; enqueue and mock drain do not prove delivery/gameplay'}))})().catch(e=>{console.error(e);process.exitCode=1});

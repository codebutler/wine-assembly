from common import *
import shutil
P=R/'docs/reviews'/H.name;P.mkdir(parents=True,exist_ok=True)
I=D/'docs/reviews/enigma-presented-controller-independent-accept-oct26'
for n in ['independent.cjs','runner-slices.json','source-checkpoint.json']:shutil.copyfile(I/n,P/('unchanged-'+n if n=='independent.cjs' else n))
gate('before')
b=run([NODE,'--max-old-space-size=192',str(I/'independent.cjs')]);(P/'before.jsonl').write_bytes(b)
save('before-checkpoint.json',dict(candidate=REV,source=json.load(open(O/'pins.json')),resultSHA256=sha(b),results=json.loads(b.splitlines()[-1]),remaining='repaired acceptance'))
# Full unchanged protocol, extended rejecting expectations and request-boundary faults.
s=(I/'independent.cjs').read_text().replace("const {MENU,createController}","const {MENU,createController,ATOMIC_ACTION,ATOMIC_BRANCH,wireRunner}")
s=s.replace('${parts.handleControlCommand}',"${parts.handleControlCommand.replace(\"    if (cmd.action === 'eval') return controlEval(cmd.code || '');\",ATOMIC_BRANCH+\"    if (cmd.action === 'eval') return controlEval(cmd.code || '');\")}")
s=s.replace("let evals=0;","let evals=0,requests=0;\n const boundary=typeof fault==='object'?fault:null;")
s=s.replace("events.push(cmd.action||cmd.cmd);","events.push(cmd.action||cmd.cmd);requests++;\n  if(boundary&&requests===boundary.at)vm.runInContext(boundary.code,context);")
s=s.replace("if(fault==='cleanupError')return", "if(fault==='replacedState')vm.runInContext('for(const k of Object.getOwnPropertySymbols(globalThis))if(Symbol.keyFor(k)?.startsWith(\"wine.enigma.presented-menu.\"))globalThis[k]={...globalThis[k]}',context);\n     if(fault==='cleanupError')return")
s=s.replace("if(cmd.action==='eval') {","if(cmd.action===ATOMIC_ACTION&&fault==='atomicLostReply'){await context.command(cmd);return {ok:false,error:'lost reply after enqueue'}}\n   if(cmd.action==='eval') {")
a=s.index('(async()=>{')
s=s[:a]+'''(async()=>{
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
  const replay=await f.context.command({action:ATOMIC_ACTION,key:'wine.enigma.presented-menu.invalid',batch:100000}).then?.(()=>{}).catch?.(()=>{});
  results.push({name,error,queuedClicks:clicks.length,wrapperRestored:f.renderer.repaint===f.original,paints:f.paints});
 }
 console.log(JSON.stringify({pass:results.length,guestExecutions:0,results}));
})().catch(e=>{console.error(e);process.exitCode=1});
'''
# command throws synchronously; real replay must reject without changing queue.
s=s.replace("const replay=await f.context.command({action:ATOMIC_ACTION,key:'wine.enigma.presented-menu.invalid',batch:100000}).then?.(()=>{}).catch?.(()=>{});","assert.throws(()=>f.context.command({action:ATOMIC_ACTION,key:'wine.enigma.presented-menu.invalid',batch:100000}));assert.equal(f.context.schedule.filter(e=>e.action==='click').length,clicks.length);")
(P/'repaired.cjs').write_text(s)
gate('repaired')
b=run([NODE,'--max-old-space-size=192',str(P/'repaired.cjs')]);(P/'repaired-results.json').write_bytes(b)
save('test-checkpoint.json',dict(candidate=REV,sourceSHA256=sha((R/'tools/enigma-presented-menu-controller.cjs').read_bytes()),fixtureSHA256=sha((P/'repaired.cjs').read_bytes()),slicesSHA256=sha((P/'runner-slices.json').read_bytes()),resultSHA256=sha(b),results=json.loads(b),remaining='combined prior focused regressions and wiring identity checks; publication; independent acceptance/runtime remain'))
print(b.decode()[:8192])

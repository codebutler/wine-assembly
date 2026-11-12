'use strict';
// Independent offline extraction of exact production argv/parser/init/hooks/output.
// This does not initialize the whole CLI or execute a guest.
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const root=require('path').resolve(__dirname,'../repo');
const original=fs.readFileSync(root+'/test/run.js','utf8');
const {createRenderWaitAttribution}=require(root+'/lib/render-wait-attribution');
const baseline=JSON.parse(fs.readFileSync(root+'/test/fixtures/render-park-control.json'));
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function cut(s,a,b){assert.equal(s.split(a).length,2,a);let i=s.indexOf(a),j=s.indexOf(b,i);assert(j>i);return s.slice(i,j);}
function extracts(s){return {
 argv:cut(s,'const args = process.argv.slice(2);','\n'),
 parser:cut(s,'const hasFlag = name =>','\n'),
 body:cut(s,"  const renderWaitAttribution = hasFlag('trace-render-wait')",'  let lastSchedSig = null;'),
 terminal:cut(s,'  renderWaitAttribution?.close(deadlineMs','  if (PRESENT_CAP &&')};}
const exact=extracts(original);
async function run(parts,flags,mode,legacy=false){
 let now=0,reason=16,resolve,reject;const effects=[],calls=[],logs=[],timers=[];
 const pending=new Promise((a,b)=>{resolve=a;reject=b;});
 const enabled=!legacy&&flags.includes('--trace-render-wait');
 const ctx={d3d9Bridge:{requests:new Map([[-2,{renderWaitOperation:'DRAW',renderWaitReadyAt:20}]])},waitD3DRender:t=>{effects.push(['wait',t]);return pending;}};
 const sandbox={process:{argv:['node','test/run.js',...flags]},ctx,
 createRenderWaitAttribution(){calls.push('factory');const helper=createRenderWaitAttribution({now:()=>now});return new Proxy(helper,{get(t,k){const v=t[k];return typeof v==='function'?function(...a){calls.push(k);return v.apply(t,a);}:v;}});},
 instance:{exports:{get_yield_reason:()=>reason,get_d3d_render_token:()=>-2,clear_yield:()=>{reason=0;effects.push('clear');}}},
 threadManager:{isMainNamedEventWaiting:()=>false,_renderSendTargets:new Set(),noteMainSleep:()=>effects.push('sleep'),isMainSleeping:()=>false,isMainThreadSuspended:()=>false},
 tickState:{batch:1},REAL_TICK_SLEEPS:true,Date:{now:()=>now},Promise,
 setTimeout:(f,ms)=>{effects.push(['timer',ms]);timers.push(f);},console:{log:x=>logs.push(x),error:(s,e)=>effects.push(['error',e.message])}};
 vm.createContext(sandbox);
 vm.runInContext(parts.argv+'\n'+parts.parser+'\nlet stopped=false,deadlineMs=0;\n'+(legacy?baseline.hooks:parts.body)+`\nglobalThis.api={check:mainExecutionSuspended,park:awaitMainRenderPark,stop:()=>{stopped=true},deadline:()=>{deadlineMs=99},finish:()=>{${legacy?'':parts.terminal}}};`,sandbox);
 const a=sandbox.api;
 assert.equal(calls.filter(x=>x==='factory').length,enabled?1:0);
 assert.equal(Object.hasOwn(ctx,'renderWaitAttribution'),enabled);
 assert.equal(a.check(),true);assert.equal(a.check(),true);
 let parkedDone=false;const parking=a.park().then(()=>{parkedDone=true;});for(let i=0;i<12;i++)await Promise.resolve();
 if(mode==='stop'||mode==='deadline'){
  a[mode]();now=100;
  if(!flags.includes('--no-render-park-wait')){assert.equal(timers.length,1);timers.shift()();}
  for(let i=0;i<24;i++)await Promise.resolve();assert.equal(parkedDone,true,'stop/deadline releases park');
  await parking;a.finish();resolve(7);
 }else{
  now=25;if(mode==='reject')reject(new Error('exact-error'));else resolve(7);
  await parking;for(let i=0;i<12;i++)await Promise.resolve();
  assert.equal(a.check(),false);a.finish();
 }
 for(let i=0;i<12;i++)await Promise.resolve();
 if(!enabled){assert.deepEqual(calls,[]);assert.deepEqual(logs,[]);}
 else{
  const wanted=['factory','begin',...(mode==='reject'?['reject']:[]),'settle','close'];
  if(!flags.includes('--no-render-park-wait'))wanted.push('parkStart','parkEnd');
  wanted.push('summary');
  assert.deepEqual([...calls].sort(),wanted.sort(),'every production diagnostic hook exactly once');
  assert.equal(logs.length,1);assert.match(logs[0],/^render attribution:/);
  assert.equal(ctx.renderWaitAttribution.requests,1);
 }
 return {effects,stats:JSON.stringify(ctx.renderParkStats)};
}
const mutations=[
 ['factory-gate',p=>p.body=p.body.replace("hasFlag('trace-render-wait') ? createRenderWaitAttribution() : null",'createRenderWaitAttribution()'),[], 'success'],
 ['factory-enable',p=>p.body=p.body.replace("hasFlag('trace-render-wait') ? createRenderWaitAttribution() : null",'null'),['--trace-render-wait'],'success'],
 ['ctx',p=>p.body=p.body.replace('if (renderWaitAttribution) ctx.renderWaitAttribution = renderWaitAttribution.stats;',''),['--trace-render-wait'],'success'],
 ...['begin','reject','settle','parkStart'].map(n=>[n,p=>p.body=p.body.replace(new RegExp('renderWaitAttribution\\?\\.'+n+'\\([^;]+;'),''),['--trace-render-wait'],n==='reject'?'reject':'success']),
 ['parkEnd',p=>p.body=p.body.replace(/renderWaitAttribution\?\.parkEnd\([\s\S]*?'pending'\)\);/,''),['--trace-render-wait'],'success'],
 ['close',p=>p.terminal=p.terminal.replace(/renderWaitAttribution\?\.close\([^;]+;/,''),['--trace-render-wait'],'deadline'],
 ['summary',p=>p.terminal=p.terminal.replace('console.log(renderWaitAttribution.summary());',''),['--trace-render-wait'],'success'],
 ['summary-guard',p=>p.terminal=p.terminal.replace('renderWaitAttribution?.stats','renderWaitAttribution.stats'),[],'success'],
 ['exact-parser',p=>p.parser=p.parser.replace('args.includes(`--${name}`)','args.some(x=>x.startsWith(`--${name}`))'),['--trace-render-wait=1'],'success'],
 ['legacy-disable',p=>p.body=p.body.replace("!hasFlag('no-render-park-wait')",'true'),['--no-render-park-wait'],'success'],
 ['timer100',p=>p.body=p.body.replace('setTimeout(r, 100)','setTimeout(r, 99)'),[],'success'],
 ['legacy-counter',p=>p.body=p.body.replace('renderParkStats.waits++;',''),[],'success'],
 ['deadline',p=>p.body=p.body.replace('if (deadlineMs && Date.now() > deadlineMs)','if (false)'),[],'deadline'],
];
async function checked(p,f,k){const got=await run(p,f,k),old=await run(exact,f,k,true);assert.deepEqual(got,old,'legacy effects/order/errors/counters/timer/deadline');}
(async()=>{
 let count=0;
 const flags=[[],['--trace'],['--trace-render-wait=1'],['--trace-render-wait-extra'],['--trace-render-wait','--no-render-park-wait'],['--no-render-park-wait'],['--trace-render-wait'],['--trace-render-wait=false']];
 for(const f of flags)for(const k of ['success','reject','stop','deadline']){await checked(exact,f,k);count++;}
 const killed=[];
 for(const [name,mutate,f,k] of mutations){const p={...exact};mutate(p);assert.notDeepEqual(p,exact,name+' mutation applies');await assert.rejects(()=>checked(p,f,k),undefined,name+' omitted control must reject');killed.push(name);}
 console.log(JSON.stringify({PASS:true,cases:count,killed,runnerSHA256:hash(original),excerpts:Object.fromEntries(Object.entries(exact).map(([k,v])=>[k,{bytes:Buffer.byteLength(v),sha256:hash(v)}])),scope:'actual argv/parser/init/hooks/output excerpts; no complete CLI startup'}));
})().catch(e=>{console.error(e);process.exitCode=1;});

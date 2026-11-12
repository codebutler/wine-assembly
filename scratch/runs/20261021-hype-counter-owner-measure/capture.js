'use strict';
// Capture-only driver. Reuses immutable staged emulator/build/originals.
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert/strict');
const puppeteer=require('/home/user/hype-browser-fps/deps/node_modules/puppeteer-core');
const root='/home/user/hype-browser-fps/repo',out='/home/user/hype-browser-fps/counter-owner/session1';
fs.mkdirSync(out,{recursive:true});
const pause=ms=>new Promise(r=>setTimeout(r,ms)),save=(n,v)=>fs.writeFileSync(out+'/'+n,JSON.stringify(v,null,2));
const code='6804cd7100e856f9020066a102cd7100668b0d00cd710083c4045051e84f7b020083c40885c07540683805000068b4685b0050e8d85c140083c40c8a15d0265b';
let browser,page,server,closing=false;const logs=[],errors=[],inputs=[],costs=[],workers=[],start=Date.now();
async function state(){return page.evaluate(()=>{const w=runningApps.find(a=>a.name==='hype_glide_demo')?.wine;return {at:performance.now(),origin:performance.timeOrigin,running:w?.running,backend:w?.threadManager?.backend,threads:[...(w?.threadManager?.threads||[])].map(([id,t])=>({id,tid:t.tid,state:t.state})),endpoints:[...(w?._renderWorkerManager?.ports?.values()||[])].map(p=>({id:p.id,api:p.options.api,backend:p.options.backend,closed:p.closed})),log:document.getElementById('log')?.textContent?.slice(-10000)};});}
async function shot(name){const begin=performance.now();await page.screenshot({path:out+'/'+name+'.png'});costs.push({kind:'screenshot',name,ms:performance.now()-begin});save(name+'.json',await state());console.log('shot',name);}
async function key(key,ms,settle=0){const begin=performance.now();inputs.push({key,ms,at:new Date().toISOString()});await page.keyboard.down(key);await pause(ms);await page.keyboard.up(key);costs.push({kind:'ordinary-input-including-hold',key,ms:performance.now()-begin});if(settle)await pause(settle);}
async function close(reason){if(closing)return;closing=true;
 for(const w of workers){try{save('restore-slot'+w.slot+'.json',await w.worker.evaluate(()=>{const h=__hype;clearInterval(h.timer);h.ex.set_logical_frame(h.prior.addr,h.prior.pace);removeEventListener('message',h.listener);return {prior:h.prior,restored:{addr:h.ex.get_logical_frame_addr(),pace:h.ex.get_logical_frame_pace()},at:performance.now()};}));}catch(e){errors.push('restore '+e);}}
 if(page&&!page.isClosed())try{save('worker-lifecycle.json',await page.evaluate(()=>__captureWorkers));}catch(e){errors.push(String(e));}
 await browser?.close();if(server){server.kill('SIGTERM');await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));}
 save('console.json',logs);save('errors.json',errors);save('inputs.json',inputs);save('instrumentation-costs.json',costs);save('cleanup.json',{reason,at:new Date().toISOString(),elapsedMs:Date.now()-start});
}
process.on('SIGTERM',()=>close('SIGTERM').then(()=>process.exit(1)));
const deadline=setTimeout(()=>close('180-second deadline').then(()=>process.exit(1)),180000);
(async()=>{
 server=cp.spawn('node',['tools/dev-server.js','--port=8080','--host=127.0.0.1','--isolate'],{cwd:root,stdio:['ignore',fs.openSync(out+'/server.log','a'),fs.openSync(out+'/server.log','a')]});await pause(700);
 browser=await puppeteer.launch({headless:false,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding'],env:{...process.env,DISPLAY:':0'},protocolTimeout:15000,timeout:20000});
 page=await browser.newPage();await page.setViewport({width:1000,height:760});
 await page.evaluateOnNewDocument(()=>{
   const NativeWorker=Worker,records=[],ids=new WeakMap();globalThis.__captureWorkers=records;
   // Preserve native calls and payloads, recording only lifecycle/counter mutations.
   globalThis.Worker=class extends NativeWorker {constructor(url,options){super(url,options);ids.set(this,records.length);records.push({kind:'create',id:ids.get(this),url:String(url),at:performance.now()});}};
   const send=NativeWorker.prototype.postMessage,terminate=NativeWorker.prototype.terminate;
   NativeWorker.prototype.postMessage=function(m,...rest){if(m&&(['init','initGuestThread','loadPE','shutdown'].includes(m.t)||(m.t==='callExport'&&/logical|init|reset/.test(m.name))))records.push({kind:'message',id:ids.get(this),at:performance.now(),t:m.t,tid:m.tid,slot:m.slot,name:m.name,args:m.args});return Reflect.apply(send,this,[m,...rest]);};
   NativeWorker.prototype.terminate=function(...args){records.push({kind:'terminate',id:ids.get(this),at:performance.now()});return Reflect.apply(terminate,this,args);};
 });
 page.on('console',m=>{if(logs.length<3000)logs.push({at:Date.now(),type:m.type(),text:m.text().slice(0,2500)});});page.on('pageerror',e=>errors.push(String(e)));
 await page.goto('http://127.0.0.1:8080/index.html?app=hype_glide_demo&debug&glide-renderer=webgl',{waitUntil:'load',timeout:45000});
 save('identity.json',{source:'b88c818ba3a071877e889e7cc779975a193591ce',moduleSha256:crypto.createHash('sha256').update(fs.readFileSync(root+'/build/wine-assembly.wasm')).digest('hex'),browser:await browser.version(),node:process.version,route:page.url(),startedAt:new Date(start).toISOString(),pid:process.pid,chromePid:browser.process().pid,viewport:page.viewport()});
 save('gpu.json',await (await browser.target().createCDPSession()).send('SystemInfo.getInfo'));
 await pause(15000);await shot('menu');await key('Enter',200,2000);await shot('instructions');await key('Space',600,4000);await shot('world-before-probe');
 const lifecycle=await page.evaluate(()=>__captureWorkers);save('worker-lifecycle-start.json',lifecycle);
 for(const worker of page.workers()){
  if(!new URL(worker.url()).pathname.endsWith('/lib/guest-worker.js'))continue;
  const identity=await worker.evaluate(expected=>{
   if(!instance)throw Error('missing guest instance');const ex=instance.exports;
   const read=()=>Array.from(new Uint8Array(memory.buffer,0x43f610-ex.get_image_base()+0x12000,64),x=>x.toString(16).padStart(2,'0')).join('');
   if(read()!==expected)throw Error('live callback code mismatch');
   const h=globalThis.__hype={ex,original:instance,read,expected,rows:[],events:[],timer:null,prior:{addr:ex.get_logical_frame_addr(),pace:ex.get_logical_frame_pace()}};
   h.listener=ev=>{const m=ev.data;if(m&&(['init','initGuestThread','loadPE','shutdown'].includes(m.t)||(m.t==='callExport'&&!/^get_|^read_/.test(m.name))))h.events.push({at:performance.now(),t:m.t,name:m.name,args:m.args,tid:m.tid});};
   addEventListener('message',h.listener);ex.set_logical_frame(0x43f610,0);
   h.sample=()=>{const begin=performance.now(),count=ex.get_logical_frame_count()>>>0,hostMs=performance.now();const row={hostMs,count,enabled:ex.get_logical_frame_addr()===0x43f610&&ex.get_logical_frame_pace()===0,generation:'session1-slot'+workerSlot,owner:{instance:'session1-slot'+workerSlot,thread:ex.get_current_thread_id()},clockOrigin:String(performance.timeOrigin),sameInstance:instance===h.original,codeMatches:read()===expected,pairReadMs:hostMs-begin};h.rows.push(row);row.sampleCostMs=performance.now()-begin;return row;};
   return {url:location.href,slot:workerSlot,exportedID:ex.get_current_thread_id(),code:read(),prior:h.prior,initial:h.sample()};
  },code);
  workers.push({worker,...identity});
 }
 assert(workers.length>=2,'need actual owner plus wrong-owner control');
 await pause(2500);
 const probes=[];for(const w of workers){const end=await w.worker.evaluate(()=>__hype.sample());probes.push({...w,worker:undefined,end,delta:end.count-w.initial.count});}
 save('owner-probes.json',probes);
 const emitting=probes.filter(p=>p.delta>0);assert.equal(emitting.length,1,'unique live callback-emitting owner required');
 const selected=emitting[0],owner=workers.find(w=>w.slot===selected.slot);
 const init=lifecycle.filter(e=>e.kind==='message'&&e.t==='initGuestThread'&&e.tid+1===selected.exportedID);
 assert.equal(init.length,1,'actual internal tid initialization required');
 const creation=lifecycle.find(e=>e.kind==='create'&&e.id===init[0].id),slotInit=lifecycle.find(e=>e.kind==='message'&&e.t==='init'&&e.id===init[0].id);
 assert(creation&&new URL(creation.url,page.url()).href===selected.url,'worker URL mapping');assert.equal(slotInit.slot,selected.slot,'live slot initialization mapping');
 save('authenticated-owner.json',{...selected,internalTid:init[0].tid,initialization:init[0],creation,slotInitialization:slotInit,selection:'unique positive callback counter delta among all live guest workers; no hard-coded slot or exported ID'});
 await shot('world-before-measure');
 for(const w of workers)await w.worker.evaluate(()=>{const h=__hype;h.rows=[];h.sample();h.timer=setInterval(h.sample,100);});
 await pause(3000);await key('ArrowUp',600);await shot('during-up');await pause(3000);await key('ArrowDown',600);await shot('during-down');await pause(3000);
 for(const w of workers){const raw=await w.worker.evaluate(()=>{const h=__hype;clearInterval(h.timer);h.sample();return {samples:h.rows,events:h.events,origin:performance.timeOrigin,end:performance.now(),code:h.read(),sameInstance:instance===h.original};});save('logical-slot'+w.slot+'.json',raw);}
 await shot('world-after-measure');
 save('served-module.json',await page.evaluate(()=>{const w=runningApps.find(a=>a.name==='hype_glide_demo').wine;return {resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('wine-assembly')&&r.name.includes('.wasm')).map(r=>({url:r.name,size:r.decodedBodySize,start:r.startTime,duration:r.duration})),tailCalls:WineAssembly.supportsWasmTailCalls(),liveModule:!!w._wasmModule};}));
 // Same session: sparse-sampling stationary interval contextualizes sampling cost;
 // this is not a causal counter-off performance benchmark.
 await owner.worker.evaluate(()=>{const h=__hype;h.rows=[];h.sample();h.timer=setInterval(h.sample,1000);});await pause(10000);
 save('sparse-overhead-interval.json',await owner.worker.evaluate(()=>{const h=__hype;clearInterval(h.timer);h.sample();return {samples:h.rows,events:h.events,origin:performance.timeOrigin};}));
 await close('bounded completion');clearTimeout(deadline);console.log('complete');
})().catch(async e=>{errors.push(e.stack||String(e));save('failure.json',{error:e.stack||String(e)});console.error(e);await close('capture failure');clearTimeout(deadline);process.exitCode=1;});

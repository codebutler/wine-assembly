'use strict';
const fs=require('fs'),cp=require('child_process'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto');
const r=__dirname,read=n=>JSON.parse(fs.readFileSync(r+'/'+n)),save=(n,v)=>fs.writeFileSync(r+'/'+n,JSON.stringify(v,null,2)+'\n');
const base='b88c818ba3a071877e889e7cc779975a193591ce';
fs.mkdirSync(r+'/source',{recursive:true});
const validator=cp.execFileSync('git',['show',base+':tools/hype-glide-emission-observer.js']);fs.writeFileSync(r+'/source/hype-glide-emission-observer.js',validator);
const {validateHypeMeasurement}=require('./source/hype-glide-emission-observer');
const prefix='evidence/session1/',owner=read(prefix+'authenticated-owner.json'),probes=read(prefix+'owner-probes.json'),lifecycle=read(prefix+'worker-lifecycle.json');
const raw=read(prefix+'logical-slot'+owner.slot+'.json');
function authenticate(candidate){
 assert.equal(probes.filter(p=>p.delta>0).length,1,'unique emitting owner');
 assert(candidate.delta>0,'candidate did not emit callback');
 assert.equal(candidate.slot,owner.slot,'wrong emitting instance');
 assert.equal(candidate.exportedID,owner.internalTid+1,'internal/exported identity mismatch');
 assert.equal(owner.slotInitialization.slot,candidate.slot,'slot mismatch');
 assert.equal(owner.initialization.id,owner.creation.id,'creation mismatch');
 assert.equal(new URL(owner.creation.url,'http://127.0.0.1:8080/').href,candidate.url,'URL mismatch');
 assert.equal(candidate.code,owner.code,'code mismatch');
 const events=lifecycle.filter(e=>e.id===owner.creation.id);assert.equal(events.filter(e=>e.t==='initGuestThread').length,1);assert(!events.some(e=>e.kind==='terminate'||e.t==='callExport'));
 return true;
}
authenticate(owner);assert.deepEqual(raw.events,[]);assert(raw.sameInstance);assert(raw.samples.every(s=>s.enabled&&s.sameInstance&&s.codeMatches));
for(const p of probes){const restore=read(prefix+'restore-slot'+p.slot+'.json');assert.deepEqual(restore.prior,restore.restored);}
assert.deepEqual(read(prefix+'errors.json'),[]);assert.equal(read('session1-status.json').exitCode,0);
const receipt={source:prefix+'logical-slot'+owner.slot+'.json',environment:'browser',moduleSha256:read(prefix+'identity.json').moduleSha256,
 clock:{kind:'host-monotonic',api:'performance.now',unit:'ms',synthetic:false,origin:String(raw.origin),source:prefix+'logical-slot'+owner.slot+'.json'},
 counter:{kind:'logical-game-frame',address:0x43f610,source:prefix+'authenticated-owner.json',exeSha256:'635f394121e50001227b97741dbf304f0a88f819c6f2ba2378cf61d9fa2a6344',liveCodeVerified:true,emittingOwnerAuthenticated:true},
 coverage:{continuous:true,resetFree:true,enabledThroughout:true,source:prefix+'logical-slot'+owner.slot+'.json',lifecycleSource:prefix+'worker-lifecycle.json',basis:'Exact source has one count increment and no count reset writer; instance identity, live code and enable state checked per sample; inbound mutations and worker initialization/termination covered continuously. No mutation events during interval. Counter settings restored after capture.'},
 gameplay:{continuous:true,ordinaryInput:true,source:'report.md'},samples:raw.samples};
save('measurement.json',receipt);
const validation=validateHypeMeasurement(receipt);assert(validation.accepted);save('validation.json',validation);
const controls=[];
for(const p of probes.filter(p=>p.slot!==owner.slot)){
 let reason;try{authenticate(p);}catch(e){reason=e.message;}assert(reason,'wrong owner accepted');
 const wrong=structuredClone(receipt),wraw=read(prefix+'logical-slot'+p.slot+'.json');wrong.source=prefix+'logical-slot'+p.slot+'.json';wrong.samples=wraw.samples;wrong.clock.origin=String(wraw.origin);wrong.clock.source=wrong.source;wrong.counter.kind='unqualified-instance-counter';wrong.counter.emittingOwnerAuthenticated=false;wrong.counter.source=prefix+'owner-probes.json';wrong.coverage.continuous=false;
 const result=validateHypeMeasurement(wrong);assert(!result.accepted&&result.fps===null);save('wrong-owner-slot'+p.slot+'.json',result);controls.push({name:'live wrong owner slot '+p.slot,rejected:true,authenticationReason:reason,reasons:result.reasons});
}
for(const [name,mutate] of [
 ['disabled',m=>m.samples[1].enabled=false],['reset-epoch',m=>m.samples[1].generation='different'],['count-reset',m=>m.samples[1].count=0],['owner-change',m=>m.samples[1].owner.thread+=1],['clock-domain',m=>m.samples[1].clockOrigin='wrong'],['missing-coverage',m=>m.coverage.continuous=false]]){
 const m=structuredClone(receipt);mutate(m);const result=validateHypeMeasurement(m);assert(!result.accepted&&result.fps===null);controls.push({name,rejected:true,reasons:result.reasons});
}
const prior=path.resolve(r,'../20261021-hype-browser-fps-authorized');fs.mkdirSync(r+'/rejected-prior',{recursive:true});for(const name of ['measurement.json','logical-raw.json','validation.json'])fs.copyFileSync(prior+'/'+name,r+'/rejected-prior/'+name);
const old=validateHypeMeasurement(read('rejected-prior/measurement.json'));assert(!old.accepted&&old.raw.samples.length===106);controls.push({name:'prior 106 wrong-owner samples',rejected:true,reasons:old.reasons});save('controls.json',controls);
function stats(samples){const costs=samples.map(s=>s.sampleCostMs).sort((a,b)=>a-b),durationMs=samples.at(-1).hostMs-samples[0].hostMs,logicalFrames=samples.at(-1).count-samples[0].count;return {samples:samples.length,durationMs,counterDelta:logicalFrames,counterRatePerSecond:logicalFrames*1000/durationMs,sampleCostTotalMs:costs.reduce((a,b)=>a+b,0),sampleCostMedianMs:costs[Math.floor(costs.length/2)],sampleCostMaxMs:costs.at(-1),sampleCostPercent:costs.reduce((a,b)=>a+b,0)*100/durationMs,maxPairReadMs:Math.max(...samples.map(s=>s.pairReadMs))};}
save('overhead.json',{ownerDense100ms:stats(raw.samples),allDenseWorkers:probes.map(p=>({slot:p.slot,...stats(read(prefix+'logical-slot'+p.slot+'.json').samples)})),ownerSparse1000ms:stats(read(prefix+'sparse-overhead-interval.json').samples),operations:read(prefix+'instrumentation-costs.json'),limitation:'Measures sample callback execution and driver operation elapsed time. Sparse interval is stationary and sequential, not a controlled counter-off/on benchmark. Logical marker/cache effects, timer scheduling, lifecycle hook cost, CDP and screenshot CPU contention are not isolated; no overhead subtraction or uninstrumented-rate claim.'});
save('source-receipt.json',{source:base,validatorSha256:crypto.createHash('sha256').update(validator).digest('hex'),priorEvidenceCommit:'56c92dc2abad4c2cbf1ca26ab0b85a5dfbde388f',priorBuildAnd66Tests:'reused, not rerun',preflight:'evidence/preflight.json',postflight:'evidence/postflight.json',productionChanges:[],captureChanges:['capture.js','finalize.js'],moduleSha256:receipt.moduleSha256});
console.log(JSON.stringify({accepted:validation.accepted,frames:validation.logicalFrames,ms:validation.durationMs,fps:validation.fps,controls:controls.length,overhead:read('overhead.json').ownerDense100ms},null,2));

#!/usr/bin/env node
'use strict';
// Source assembly and result-classification checks only. No GL implementation.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const vm=require('node:vm'),crypto=require('node:crypto');
const {assemble,classify}=require('./d3d9-clear-real-cdp');
const root=path.resolve(__dirname,'..');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const identities=JSON.parse(fs.readFileSync(path.join(root,
  'docs/re-notes/evidence/d3d9-clear-real-webgl-20261024/source-identities.json')));
const base='36ca14d2806bd839a7918f99f1d844d5cb9fc8c3';
const original=require('node:child_process').execFileSync('git',['show',
  'a518fdba38985cafc52beddf76e7d6845fa97019:tools/d3d9-clear-real-cdp.js'],
  {cwd:root,stdio:['ignore','pipe','ignore']}).toString();
const oldRule=original.slice(original.indexOf('  const [candidate,producerResult'),original.indexOf('  const summary='));
const names=['wrapper-default-one-after-quarter','named-80-fresh-quarter-rejects-half',
  'clipped-top-left-red-channel',...Array.from({length:53},(_,i)=>'other-'+i)];
function results(){
  return Array.from({length:4},(_,variant)=>({checks:[...names.map((name,i)=>({name,kind:'pixels',
    pass:variant===0||i!==variant-1,pixels:64,mismatch:variant>0&&i===variant-1?64:0})),
    {name:'named-80-actual-renderbuffer',kind:'capability',pass:true},
    {name:'invalid-origin-rejected',kind:'validation',pass:true}],
    errors:[],identities:[{}],failed:variant?1:0}));
}
const clean=results();assert(classify(clean));
const baseline=results();baseline[1].checks.at(-2).pass=false;
assert.equal(vm.runInNewContext(oldRule+'\naccepted',{results:baseline}),true);
assert.equal(classify(baseline),false);
const rejections={
  capability:r=>{r[1].checks.at(-2).pass=false;},
  validation:r=>{r[2].checks.at(-1).pass=false;},
  allocationError:r=>{r[1].errors.push('Framebuffer allocation failed');},
  candidateError:r=>{r[0].errors.push('Context unavailable');},
  spoofedCandidateTotal:r=>{r[0].checks[0].pass=false;r[0].checks[0].mismatch=64;},
  inconsistentPixels:r=>{r[1].checks[0].mismatch=0;},
  absentPixelCount:r=>{delete r[1].checks[0].pixels;},
  missingChecks:r=>{r[1].checks=[];},
  duplicateCheck:r=>{r[2].checks[5]=r[2].checks[4];},
  unrelatedFailure:r=>{r[1].checks[0].pass=true;r[1].checks[0].mismatch=0;
    r[1].checks[9].pass=false;r[1].checks[9].mismatch=64;},
  missingIdentity:r=>{r[3].identities=[];},
  missingVariant:r=>{r.pop();}
};
for(const [name,change] of Object.entries(rejections)){const r=results();change(r);assert.equal(classify(r),false,name);}
const first=assemble(),second=assemble();assert.deepEqual(first,second);
const [candidate,producer,intermediate,mutation]=first.variants;
for(const [actual,key] of [[candidate.gpu,base+':lib/gpu-backend.js'],
  [candidate.device,base+':lib/d3d9-backend.js'],
  [producer.device,'ffe822a9d50ad79439330609915eb84475acd2bc:lib/d3d9-backend.js'],
  [intermediate.gpu,'77180c76b312efe465ad91e60286d40330d77d0d:lib/gpu-backend.js']]){
  assert.equal(hash(actual),identities[key].sha256,key);assert.equal(Buffer.byteLength(actual),identities[key].bytes,key);
}
assert.equal(producer.gpu,candidate.gpu);assert.equal(intermediate.device,candidate.device);
assert.equal(mutation.gpu,candidate.gpu);
const needle='for(const [left,top,right,bottom]of regions)';
assert.equal(candidate.device.split(needle).length,2);
assert.equal(mutation.device,candidate.device.replace(needle,
  'for(const [left,top,right,bottom]of [[0,0,g.canvas.width,g.canvas.height]])'));
for(const d of first.dependencies){assert.equal(d.source,fs.readFileSync(path.join(root,d.file),'utf8'));
  assert.equal(hash(d.source),identities[base+':'+d.file].sha256);}
assert.equal(first.fixture,fs.readFileSync(path.join(root,'test/fixtures/d3d9-clear-real-pixels.js'),'utf8'));
// Evaluate real factories without constructing a Device or GL context. Repeat
// candidate after controls, in the same realm, matching CDP evaluation semantics.
const realm=vm.createContext({});const constructors=[];
for(const v of [...first.variants,candidate]){
  for(const d of first.dependencies)vm.runInContext(d.source,realm);
  vm.runInContext(v.gpu,realm);vm.runInContext(v.device,realm);
  constructors.push(realm.D3D9Backend.Device);
  assert.equal(typeof realm.GpuBackend.WebGLBackend,'function');
}
assert.equal(new Set(constructors).size,5,'every browser evaluation replaces Device factory');
console.log(JSON.stringify({passed:true,scope:'No GL; source assembly/classification only',
  baselineCapabilityFalseAcceptance:true,rejectingControls:Object.keys(rejections),
  variants:first.variants.map(v=>({name:v.name,gpu:hash(v.gpu),device:hash(v.device)})),
  repeatedFactories:constructors.length,fixture:hash(first.fixture)}));

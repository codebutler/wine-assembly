'use strict';
// Static regression and adaptation controls; zero native Module constructions.
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const q=require('./qualify.cjs'),contract=process.argv[2],{c,expected,statics}=q.load(contract),results=[];
function reject(name,fn,pattern){assert.throws(fn,pattern,name);results.push({name,rejected:true});}
for(const row of c.allowed){
 const b=fs.readFileSync(row.path),prior=statics.outputs.find(x=>x.file===row.path),actual=q.parse(b);
 q.byteHash(b,row);q.metadata(actual,expected,prior);results.push({binary:path.basename(row.path),repairStaticPass:true,baseline:q.baseline(c,prior,row.path)});
 const mutate=(name,edit,pattern)=>{const a=structuredClone(actual);edit(a);reject(path.basename(row.path)+':'+name,()=>q.metadata(a,expected,prior),pattern);};
 mutate('missing-export',a=>{a.exports=a.exports.filter(e=>e.name!=='get_eax');},/complete source function exports/);
 mutate('wrong-export-signature',a=>{a.exports.find(e=>e.name==='get_eax').signature={params:[],results:['i64']};},/complete source function exports/);
 mutate('wrong-export-kind',a=>{a.exports.find(e=>e.name==='get_eax').kind=2;},/complete source function exports/);
 mutate('extra-diagnostic-export',a=>a.exports.push({name:'set_null_diag',kind:0,signature:{params:['i32'],results:[]}}),/complete source function exports/);
 mutate('duplicate-export',a=>a.exports.push(a.exports[0]),/duplicate export/);
 mutate('missing-import',a=>a.imports.pop(),/complete imports and signatures/);
 mutate('wrong-import-signature',a=>{a.imports.find(i=>i.kind===0).signature={params:['i64'],results:[]};},/complete imports and signatures/);
 mutate('wrong-memory-import',a=>{a.imports.find(i=>i.kind===2).limits.max++;},/complete imports and signatures/);
 mutate('wrong-types',a=>{a.types[0].results=['i64'];},/complete binary type inventory/);
 mutate('wrong-layout',a=>{a.customSections[0].payloadHex='00'.repeat(16);},/complete layout\/custom contract/);
 mutate('duplicate-layout',a=>a.customSections.push(a.customSections[0]),/complete layout\/custom contract/);
 mutate('missing-layout',a=>{a.customSections=[];},/complete layout\/custom contract/);
 mutate('start-metadata',a=>{a.noStart=false;},/noStart/);
 reject(path.basename(row.path)+':hash',()=>q.byteHash(b,{...row,sha256:'0'.repeat(64)}),/binary hash/);
 reject(path.basename(row.path)+':expected-hash',()=>q.select(c,row.path,'0'.repeat(64)),/expected hash not allowed/);
}
reject('start-section-parser',()=>q.parse(Buffer.from([0,97,115,109,1,0,0,0,8,1,0])),/start section forbidden/);
reject('section-overrun',()=>q.parse(Buffer.from([0,97,115,109,1,0,0,0,1,10,0])),/section overrun/);
reject('unallowed-path',()=>q.select(c,__filename,c.allowed[0].sha256),/path not allowed/);
reject('pinned-source-binding-hash',()=>q.pinned({...c.sourceBinding,sha256:'0'.repeat(64)}),/pinned hash/);
// The accepted guard review and boundary receipts are reused. Target only this
// adaptation's exact fixed Buffer call and preserved byte-limit rejection.
const {guardConstructor,LIMIT}=require(c.guard.path);let calls=0,seen;
class FakeModule{constructor(...args){calls++;seen=args;}}
const Guard=guardConstructor(FakeModule),tiny=Buffer.from([0,97,115,109,1,0,0,0]);
new Guard(tiny);assert.equal(calls,1);assert.equal(seen.length,1);assert.equal(seen[0],tiny);
reject('guard-oversize-before-constructor',()=>new Guard(Buffer.alloc(LIMIT+1)),/exceeds 8388608/);assert.equal(calls,1);
results.push({guardSynchronousBufferIdentity:true,optionsAdded:false,guardSHA256:c.guard.sha256,nativeModuleCalls:0});
const out={state:'REGRESSION_CONTROLS_PASS',results,nativeModuleCalls:0,Memory:false,Instance:false,guest:false};
fs.writeFileSync(process.argv[3],JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify({state:out.state,results:results.length,nativeModuleCalls:0}));

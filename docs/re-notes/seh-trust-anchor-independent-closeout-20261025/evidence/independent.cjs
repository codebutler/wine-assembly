'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),Module=require('node:module');
const out=process.argv[2];fs.mkdirSync(out,{recursive:true});
const Q='../repo/docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs',q=require(Q);
const cp='/tmp/seh-current-canonical-qualifier-oct25/ops/contract.json',original=fs.readFileSync(cp),{c,expected,statics}=q.load(cp),results=[];
const read=fs.readFileSync;
function reject(name,edit){
 const x=structuredClone(c);edit(x);const p=path.join(out,'attack.json');fs.writeFileSync(p,JSON.stringify(x));const reads=[];
 fs.readFileSync=function(f,...a){reads.push(String(f));return read.call(this,f,...a);};
 try{assert.throws(()=>q.load(p),/independent contract authority/);}finally{fs.readFileSync=read;}
 assert.deepEqual(reads,[p]);results.push({name,contractOnlyRead:true});
}
for(const key of ['sourceBinding','inputs','allowed','candidate','guard'])reject('omit '+key,x=>{delete x[key];});
reject('plausible changed compiler path with nonzero digest',x=>{x.sourceBinding={path:'/proc/self/fd/0',sha256:q.sha(Buffer.from('plausible receipt'))};});
reject('genuine source receipt hash at malicious path',x=>{x.sourceBinding.path='/dev/zero';});
reject('contract prototype authority injection',x=>{x.__proto__={contractSHA256:q.sha(original)};x.authoritySHA256=q.sha(original);});
reject('closure path traversal with genuine hash',x=>{x.inputs['closure.json'].path='/tmp/../../dev/zero';});
reject('same count substituted compiler hash',x=>{x.inputs['build.cjs'].sha256='123456789abcdef0'.repeat(4);});
const relocated=path.join(out,'relocated-contract.json');fs.writeFileSync(relocated,original);assert.deepEqual(q.load(relocated),q.load(cp));
// Derive the entire fingerprint from every storage and span entry, never from
// the stored serialization or declared fingerprint alone.
function serialize(regions){assert.equal(new Set(regions.map(r=>r.name)).size,regions.length);return regions.map(r=>{
 assert(Number.isSafeInteger(r.base)&&Number.isSafeInteger(r.size)&&r.base>=0&&r.size>0);assert.equal(r.end,r.base+r.size);assert(r.end<=8192*65536);
 return r.name+':'+r.base.toString(16).toUpperCase().padStart(8,'0')+':'+r.size.toString(16).toUpperCase().padStart(8,'0');
}).sort().join('\n')+'\n';}
const serialization=serialize(expected.regions);assert.equal(serialization,expected.serialization);assert.equal(expected.regions.length,269);assert(expected.regions.some(r=>r.name==='DIRECT_WINDOW'&&r.kind==='span'));
assert.equal(q.sha(Buffer.from(serialization)).slice(0,16),'9a3bc9149d58209c');
for(const edit of [r=>r.filter(x=>x.name!=='DIRECT_WINDOW'),r=>{r.find(x=>x.name==='DIRECT_WINDOW').size--;return r;},r=>r.concat(r[0])])assert.throws(()=>assert.equal(serialize(edit(structuredClone(expected.regions))),serialization));
const binaries=[];
for(const row of c.allowed){
 q.select(c,row.path,row.sha256);const b=read(row.path);q.byteHash(b,row);const a=q.parse(b),prior=statics.outputs.find(x=>x.file===row.path);q.metadata(a,expected,prior);
 assert.equal(a.imports.length,291);assert.equal(a.exports.filter(x=>x.kind===0).length,2224);assert.equal(a.types.length,172);
 for(const name of ['set_null_diag','null_diag_field','null_diag_token','null_diag_root'])assert(!a.exports.some(x=>x.name===name));
 const edits=[x=>{x.exports.find(e=>e.kind===2).index=1;},x=>{x.memories[0].shared=false;},x=>{x.imports[0].name='substitute_same_count';},x=>{x.exports.find(e=>e.kind===0).name='substitute_same_count';},x=>{x.types.reverse();},x=>{x.customSections[0].name='substitute';}];
 for(const edit of edits){const x=structuredClone(a);edit(x);assert.throws(()=>q.metadata(x,expected,prior));}
 const changed=Buffer.from(b);changed[changed.length-1]^=1;assert.throws(()=>q.byteHash(changed,row),/binary hash/);assert.throws(()=>q.byteHash(b.subarray(1),row),/binary bytes/);
 binaries.push({path:row.path,sha256:q.sha(b),bytes:b.length,imports:291,functionExports:2224,types:172,noStart:a.noStart,extraMetadataRejections:edits.length,rawHashAndLengthRejections:2});
}
// Apply the exact original malicious contract bytes to both unchanged modules.
const baseline='/tmp/seh-current-canonical-qualifier-oct25/repo/docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs',old=require(baseline),attack='/tmp/seh-canonical-qualifier-independent-integrate-oct25/ops/forged-contract.json';
const accepted=old.load(attack);for(const row of accepted.c.allowed){old.select(accepted.c,row.path,row.sha256);const b=read(row.path);old.byteHash(b,row);old.metadata(old.parse(b),accepted.expected,accepted.statics.outputs.find(x=>x.file===row.path));}
assert.throws(()=>q.load(attack),/independent contract authority/);
// Run the unchanged original script in our output, then change module location
// only. It regenerates identical malicious bytes; original hash assertion stays.
const repro=path.join(out,'reproduce.cjs'),source='/tmp/seh-canonical-qualifier-independent-integrate-oct25/ops/reproduce.cjs';assert.equal(q.sha(read(source)),'dccbc1f1667332d85805146fb499bff94a744c6e95437368eedfa9dbcfa9f91c');fs.writeFileSync(repro,read(source));require(repro);
const names=['forged-contract.json','forged-source-binding.json'],before=names.map(n=>read(path.join(out,n)));delete require.cache[require.resolve(repro)];const originalLoad=Module._load;let calls=0;
Module._load=function(request,...a){if(request===baseline){calls++;return q;}return originalLoad.call(this,request,...a);};
try{assert.throws(()=>require(repro),/independent contract authority/);}finally{Module._load=originalLoad;}
assert.equal(calls,1);names.forEach((n,i)=>assert.deepEqual(read(path.join(out,n)),before[i]));
const result={state:'INDEPENDENT_STATIC_PASS',qualifierSHA256:q.sha(read(require.resolve(Q))),contractSHA256:q.sha(original),pathOmissionNonzeroCases:results,fullLayout:{entries:269,storage:expected.regions.filter(r=>r.kind==='storage').length,spans:expected.regions.filter(r=>r.kind==='span').length,hash:'9a3bc9149d58209c',independentlySerialized:true,rejectOmissionChangeDuplicate:true},binaries,originalAttack:{originalScriptSHA256:q.sha(read(repro)),originalMaliciousContractSHA256:q.sha(read(attack)),baselineBothStaticPass:true,repairRejected:true,moduleLocationOnlyAdapter:true,adaptations:calls,identicalRegeneratedMaliciousBytes:true},WebAssemblyCalls:0};
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({state:result.state,binaries:binaries.length,pathCases:results.length,layoutEntries:269,WebAssemblyCalls:0}));

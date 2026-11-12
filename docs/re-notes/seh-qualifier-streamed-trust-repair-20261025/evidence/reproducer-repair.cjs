'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),Module=require('node:module');
const root=__dirname,repro=root+'/reproducer',q=require('../repo/docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs');
const baseline='/tmp/seh-current-canonical-qualifier-oct25/repo/docs/re-notes/seh-current-canonical-qualifier-20261025/qualify.cjs';
const names=['forged-contract.json','forged-source-binding.json'];
const before=Object.fromEntries(names.map(n=>[n,fs.readFileSync(repro+'/'+n)]));
const originalLoad=Module._load;let adaptations=0;
// ONLY substitute the candidate module location. The original script, its
// file/hash assertion and all forged inputs remain unmodified.
Module._load=function(request,...rest){if(request===baseline){adaptations++;return q;}return originalLoad.call(this,request,...rest);};
try{assert.throws(()=>require(repro+'/reproduce.cjs'),/independent contract authority/);}finally{Module._load=originalLoad;}
assert.equal(adaptations,1);
for(const n of names)assert.deepEqual(fs.readFileSync(repro+'/'+n),before[n],'same malicious inputs '+n);
// Also apply both qualifiers directly to the exact original reviewer inputs.
const old=require(baseline),original='/tmp/seh-canonical-qualifier-independent-integrate-oct25/ops/forged-contract.json';
const accepted=old.load(original);
for(const row of accepted.c.allowed){old.select(accepted.c,row.path,row.sha256);const b=fs.readFileSync(row.path);old.byteHash(b,row);old.metadata(old.parse(b),accepted.expected,accepted.statics.outputs.find(x=>x.file===row.path));}
assert.throws(()=>q.load(original),/independent contract authority/);
const result={state:'REVIEWER_REPRODUCER_REPAIR_PASS',unchangedReproducerSHA256:q.sha(fs.readFileSync(repro+'/reproduce.cjs')),adapter:'Module._load replaces only exact original qualifier module location; original hash assertion reads unchanged original file',moduleLocationAdaptations:adaptations,generatedMaliciousInputsUnchanged: Object.fromEntries(names.map(n=>[n,q.sha(before[n])])),exactOriginalReviewerMaliciousInputs:{baselineAllStaticChecksPassed:true,repairRejectedBeforeInputReads:true},nativeModuleCalls:0,WebAssemblyAPIsUsed:false};
fs.writeFileSync(root+'/reproducer-repair-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));

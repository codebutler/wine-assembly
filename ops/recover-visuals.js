#!/usr/bin/env node
'use strict';
// Explicit reviewed mappings only. No filename guessing or transcript execution.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {isDeepStrictEqual}=require('node:util');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const REPORTED_BUILD_LIMITATION='Reported by the associated historical result; module bytes were not rehashed during recovery, and this is not current-build validation.';
function reportedBuild(root,entry,verifySource=true){
  const e=entry.buildEvidence;
  if(e===undefined)return null;
  if(!e || typeof e.sourceResult!=='string' || !/^[a-f0-9]{64}$/.test(e.sourceResultSha256) ||
      !/^[a-f0-9]{64}$/.test(e.reportedWasmSha256) || typeof e.app!=='string' || !e.app.trim() ||
      !Number.isSafeInteger(e.sampleIndex) || e.sampleIndex<0 || typeof e.basis!=='string' || !e.basis.trim() ||
      e.limitation!==REPORTED_BUILD_LIMITATION)throw Error('Invalid reported build evidence');
  const source=path.resolve(root,entry.source),resultPath=path.resolve(root,e.sourceResult);
  if(path.basename(resultPath)!=='result.json' || path.dirname(resultPath)!==path.dirname(source) ||
      path.basename(source)!==`sample-${e.sampleIndex}-after.png`)throw Error('Build evidence capture identity mismatch');
  // An intact retained bundle is usable after the historical sources disappear.
  // This validates the reviewed claim, never a fresh module identity.
  if(!verifySource)return e.reportedWasmSha256;
  const bytes=fs.readFileSync(resultPath);
  if(sha(bytes)!==e.sourceResultSha256)throw Error('Build evidence source result changed');
  const result=JSON.parse(bytes.toString('utf8'));
  if(result.app!==e.app || result.wasmSha256!==e.reportedWasmSha256 ||
      !Number.isSafeInteger(result.samples) || result.samples<=e.sampleIndex ||
      !Array.isArray(result.results) || !result.results[e.sampleIndex])throw Error('Build evidence result identity mismatch');
  return e.reportedWasmSha256;
}
function provenanceFor(entry,importedAt){
  return {...entry,importedAt,associationReview:entry.associationReview || 'Exact source test/log and displayed content reviewed; this is not current-build validation.'};
}
function resultFor(entry,importedAt,wasmSha256){
  return {candidateId:entry.candidateId,startedAt:entry.sourceModifiedAt,outcome:'unknown',verification:'unreviewed',
    route:'Historical capture / '+entry.scene,summary:entry.summary+' Historical image only; no current compatibility or performance result. Date is original file mtime, not a verified capture time.',
    command:'Unknown; see provenance evidence',build:{commit:null,wasmSha256},screenshots:['screen.png'],artifacts:['provenance.json'],importedAt};
}
function existingBundle(root,directory,entry){
  const reject=reason=>{throw Error('Invalid existing recovered bundle '+directory+': '+reason);};
  let stat;
  try{stat=fs.lstatSync(directory);}catch(e){if(e.code==='ENOENT')return false;throw e;}
  if(!stat.isDirectory())reject('expected a directory');
  const read=name=>{
    const file=path.join(directory,name);
    try{
      if(!fs.lstatSync(file).isFile())reject(name+' must be a regular file');
      return fs.readFileSync(file);
    }catch(e){reject(name+': '+e.message);}
  };
  if(sha(read('screen.png'))!==entry.sha256)reject('screen.png SHA-256 differs from reviewed mapping');
  const parse=name=>{const bytes=read(name);try{return JSON.parse(bytes.toString('utf8'));}catch(e){reject(name+' is malformed JSON');}};
  const provenance=parse('provenance.json'),result=parse('result.json');
  const importedAt=provenance?.importedAt;
  if(typeof importedAt!=='string' || !Number.isFinite(Date.parse(importedAt)))reject('provenance.json importedAt is invalid');
  if(!isDeepStrictEqual(provenance,provenanceFor(entry,importedAt)))reject('provenance.json differs from reviewed mapping');
  const wasmSha256=reportedBuild(root,entry,false);
  if(!isDeepStrictEqual(result,resultFor(entry,importedAt,wasmSha256)))reject('result.json differs from reviewed mapping/provenance');
  return true;
}
// Explicit root injection is for disposable-fixture validation. The CLI keeps
// the existing repository root.
function recover(root=path.resolve(__dirname,'..')){
const candidates=new Set(JSON.parse(fs.readFileSync(path.join(root,'test/candidate-corpus/manifest.json'),'utf8')).candidates.map(c=>c.id));
const registryPath=path.join(root,'lib/apps.js');
if(fs.existsSync(registryPath)) {
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'test/candidate-corpus/manifest.json'),'utf8'));
  const statusPath=path.join(root,'ops/corpus-status.json');
  const assessments=fs.existsSync(statusPath)?JSON.parse(fs.readFileSync(statusPath,'utf8')).entries || []:[];
  for(const entry of require('./corpus-inventory').inventory(manifest,require(registryPath).APPS,assessments))candidates.add(entry.id);
}
const entries=JSON.parse(fs.readFileSync(path.join(root,'ops/historical-visuals.json'),'utf8'));
const report=[];
for(const entry of entries){
  if(!candidates.has(entry.candidateId) || !/^[a-f0-9]{64}$/.test(entry.sha256) || !entry.evidence?.length || !Number.isFinite(Date.parse(entry.sourceModifiedAt)))throw Error('Invalid reviewed mapping');
  const directory=path.join(root,'scratch/runs','recovered-'+entry.candidateId+'-'+entry.sha256.slice(0,16));
  if(entry.associationReview!==undefined && (typeof entry.associationReview!=='string' || !entry.associationReview.trim()))throw Error('Invalid association review');
  if(existingBundle(root,directory,entry)){report.push({candidateId:entry.candidateId,status:'already imported'});continue;}
  const source=path.resolve(root,entry.source);
  if(!fs.existsSync(source)){report.push({candidateId:entry.candidateId,status:'source unavailable',source});continue;}
  const bytes=fs.readFileSync(source);
  if(sha(bytes)!==entry.sha256)throw Error('Source changed: '+source);
  const wasmSha256=reportedBuild(root,entry);
  fs.mkdirSync(path.dirname(directory),{recursive:true});
  // Exclusive creation also prevents an intervening import from being overwritten.
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory,'screen.png'),bytes);
  const importedAt=new Date().toISOString();
  fs.writeFileSync(path.join(directory,'provenance.json'),JSON.stringify(provenanceFor(entry,importedAt),null,2)+'\n');
  const result=resultFor(entry,importedAt,wasmSha256);
  fs.writeFileSync(path.join(directory,'result.json.tmp'),JSON.stringify(result,null,2)+'\n');
  fs.renameSync(path.join(directory,'result.json.tmp'),path.join(directory,'result.json'));
  report.push({candidateId:entry.candidateId,status:'imported',directory:path.relative(root,directory)});
}
fs.mkdirSync(path.join(root,'scratch/ops-backfill'),{recursive:true});
fs.writeFileSync(path.join(root,'scratch/ops-backfill/recovery-report.json'),JSON.stringify({at:new Date().toISOString(),entries:report},null,2)+'\n');
return report;
}
if(require.main===module)console.log(JSON.stringify(recover(),null,2));
module.exports={recover,REPORTED_BUILD_LIMITATION};

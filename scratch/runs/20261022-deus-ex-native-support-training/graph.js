'use strict';
// Pure host-side discovery using accepted source; no Wasm or guest execution.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {resolveDllGraph}=require('../../../lib/process-boot');
const {detectRequiredDlls}=require('../../../lib/dll-loader');
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'closure-audit.json')));
const assets=JSON.parse(fs.readFileSync('/home/user/wine-assembly-deus-ex-training-runtime-oct22/scratch/runs/20261022-deus-ex-training-runtime/assets.json'));
const all={...audit.game,...audit.native};
const byHash=new Map(Object.values(all).map(x=>[x.sha256,x]));
const sha=b=>require('crypto').createHash('sha256').update(b).digest('hex');
(async()=>{
 const missing=[];
 const configs=await resolveDllGraph({
  exeBytes:fs.readFileSync(all['deusex.exe'].path),seeds:assets.app.dlls,
  detectRequiredDlls,
  loadSpec:spec=>{const name=path.basename(spec).toLowerCase(),r=all[name];return r?{name,bytes:fs.readFileSync(r.path)}:null;},
  onMissing:(name,spec)=>missing.push({name,spec})
 });
 const result={source:audit.source,note:'Registry discovery with candidate files available, not a guest execution or original-media provenance proof',resolved:configs.map(x=>({name:x.name,sha256:sha(x.bytes)})),missing};
 fs.writeFileSync(path.join(__dirname,'candidate-graph.json'),JSON.stringify(result,null,2));
 assert.deepEqual(missing,[]);
 assert.equal(configs.length,19);
 console.log('PASS: accepted resolver finds 14 game DLLs + 5 candidate native DLLs; no missing files.');
 const emulated=new Set(['comctl32.dll','shell32.dll','ole32.dll']);
 const warnings=[];
 const minimal=await resolveDllGraph({exeBytes:fs.readFileSync(all['deusex.exe'].path),seeds:assets.app.dlls,detectRequiredDlls,
  loadSpec:spec=>{const name=path.basename(spec).toLowerCase(),r=all[name];return r&&!emulated.has(name)?{name,bytes:fs.readFileSync(r.path)}:null;},
  onMissing:name=>warnings.push(name.toLowerCase())});
 assert.deepEqual([...new Set(warnings)].sort(),[...emulated].sort());
 assert.equal(minimal.length,15);
 fs.writeFileSync(path.join(__dirname,'selected-graph.json'),JSON.stringify({source:audit.source,resolved:minimal.map(x=>({name:x.name,sha256:sha(x.bytes)})),warningOnly:[...new Set(warnings)],resolutionEvidence:'necessary-closure.json and existing-emulated-handlers.json',note:'14 original game DLLs plus native MSVCRT. Existing WAT entry points serve all static imports from the three warned libraries. No onMissing or isLoadable behavior changed.'},null,2));
 console.log('PASS: selected graph is 14 game DLLs + MSVCRT; only the three verified emulated-library warnings remain.');
})().catch(e=>{console.error(e);process.exitCode=1});

'use strict';
// Independent loader acceptance. No wasm, guest, build, browser or installer.
const fs=require('fs'), path=require('path'),vm=require('vm'),crypto=require('crypto'),assert=require('assert');
const repo=path.resolve(__dirname,'../..');
const {APPS}=require(path.join(repo,'lib/apps'));
const {normalizeLazyFiles}=require(path.join(repo,'lib/app-files'));
const {VirtualFS}=require(path.join(repo,'lib/filesystem'));
const {stageGltron}=require(path.join(repo,'tools/stage-gltron-original'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const task=path.dirname(repo), evidence=path.join(task,'evidence');
const dispatch=JSON.parse(fs.readFileSync('/home/user/wine-assembly/scratch/usage-watch/gltron-registration-independent-accept-oct29-dispatch.json'));
const destination=path.join(task,'stage');
const source=path.join(dispatch.payload,'extracted/app');
const app=APPS.gltron, policy=normalizeLazyFiles(app,app.files);
const receipt={candidate:dispatch.candidate,groups:[],guestExecuted:false};
const checkpoint=()=>fs.writeFileSync(path.join(evidence,'acceptance.json'),JSON.stringify(receipt,null,2)+'\n');
async function main(){
 const inventoryBytes=fs.readFileSync(dispatch.media['inventory.json'].path);
 assert.equal(hash(inventoryBytes),dispatch.media['inventory.json'].sha256);
 const inventory=JSON.parse(inventoryBytes);
 assert.equal(app.files.length,92);assert.equal(app.files.reduce((n,x)=>n+x.size,0),4968893);assert.equal(policy.summary.lazyFiles,0);
 for(const original of inventory.files){
  const rel=original.path.slice(4),file=app.files.find(x=>x.url==='binaries/gltron-0.70/'+rel);
  assert(file);assert.equal(file.sha256,original.sha256);assert.equal(file.size,original.bytes);
  assert.equal(file.vfsPath,app.workingDirectory+'\\'+rel.replace(/\//g,'\\'));assert.equal(file.loadMode,'required');
 }
 // Full pinned production source evaluated without any transformation.
 const bytes=fs.readFileSync(path.join(repo,'host.js'));assert.equal(hash(bytes),dispatch.sourcePins['host.js'].sha256);
 const c=vm.createContext({console:{log(){},warn(){},error(){}},Uint8Array,ArrayBuffer,AbortController,URL,URLSearchParams,setTimeout,clearTimeout});
 vm.runInContext(bytes.toString(),c,{filename:path.join(repo,'host.js')});const Host=vm.runInContext('WineAssembly',c);
 const newHost=()=>{const h=Object.create(Host.prototype);h._helpCtx={vfs:new VirtualFS()};return h;};
 Host.fetchAssetBytes=async url=>{try{return new Uint8Array(fs.readFileSync(path.join(destination,url.slice('binaries/gltron-0.70/'.length))));}catch{throw new Error('HTTP 404');}};
 await assert.rejects(newHost().loadFiles(policy.files,{required:true,concurrency:1}),/failed to load/);
 // Actual public staging API, exact original inventory; only one media copy.
 const staged=stageGltron(source,destination);assert.equal(staged.files,92);assert.equal(staged.bytes,4968893);
 const host=newHost();await host.loadFiles(policy.files,{required:true,concurrency:1});
 assert(host._helpCtx.vfs.setCurrentDirectory(app.workingDirectory));
 for(const file of app.files){const mounted=host._helpCtx.vfs.files.get(file.vfsPath.toLowerCase());assert(mounted);assert.equal(mounted.data.length,file.size);assert.equal(hash(mounted.data),file.sha256);}
 receipt.groups.push({name:'production-boundary',result:'PASS',files:92,bytes:4968893,missingOriginalRejected:true,sourceSHA256:hash(bytes)});checkpoint();
 // Inspect actual headless wiring; do not evaluate its guest initializers.
 const runner=fs.readFileSync(path.join(repo,'test/run.js'),'utf8');assert.equal(hash(runner),dispatch.sourcePins['test/run.js'].sha256);
 assert.equal(app.exe,'binaries/gltron-0.70/gltron.exe');assert.equal(app.exeGuestPath,'c:\\games\\gltron\\gltron.exe');
 assert(runner.includes('APP_ENTRY.exeGuestPath'));assert(runner.includes('const guestCwd = GUEST_CWD || (APP_ENTRY && APP_ENTRY.workingDirectory) || null;'));
 receipt.groups.push({name:'headless-contract-source-review',result:'PASS',runnerSHA256:hash(runner),exe:app.exe,exeGuestPath:app.exeGuestPath,cwd:app.workingDirectory});checkpoint();
 // Same-length corrupt data: retain original source/stage; mutate fetched buffer only.
 const chosen=app.files.find(x=>x.url.endsWith('/art/classic/artpack.lua'));
 const originalFetch=Host.fetchAssetBytes;let corrupt;
 Host.fetchAssetBytes=async url=>{const b=await originalFetch(url);if(url===chosen.url){b[0]^=1;corrupt=b;}return b;};
 const probe=newHost();let rejected=false,error=null;
 try{await probe.loadFiles([chosen],{required:true,concurrency:1});}catch(e){rejected=true;error=e.message;}
 const mounted=probe._helpCtx.vfs.files.get(chosen.vfsPath.toLowerCase());
 receipt.groups.push({name:'corrupt-required-loader-asset',expected:'reject',actual:rejected?'reject':'accepted',file:chosen.url,registeredSHA256:chosen.sha256,actualSHA256:hash(corrupt),size:corrupt.length,mountedSHA256:mounted?hash(mounted.data):null,error});
 receipt.outcome=rejected?'PASS':'REJECT';receipt.remaining='Stop first independent defect; broader staging adversarial groups not executed.';checkpoint();
 assert(rejected,'DEFECT: production loadFiles accepted and mounted a same-size corrupt required GLTron asset despite pinned SHA-256');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),http=require('node:http');
const {createEmulatorHandler,buildCatalog,privateIndex,rangeFor,launchFor,LOCAL_DESKTOP}=require('./emulator-server');
test('Hock original browser association requires its EXE and all generated companions', async () => {
 const {APPS,LOCAL_CANDIDATE_APPS,DESKTOP_APPS}=require('../lib/apps');
 const candidate=require('../test/candidate-corpus/manifest.json').candidates.find(c=>c.id==='hock-a-loogie-1995');
 const app=APPS.hock_a_loogie, base='test/binaries/candidates/hock-a-loogie-1995/';
 assert.deepEqual(candidate.appIds,['hock_a_loogie']);
 assert.equal(app.exe,base+candidate.browser.exe);
 assert.equal(app.exe,base+'game/BBLOOGIE.EXE');
 assert.equal(app.localFileManifest,base+'.wine-assembly-browser.json');
 assert.equal(app.requiredFiles,true);
 assert.deepEqual(app.files,[]);
 assert(LOCAL_CANDIDATE_APPS.some(([id])=>id==='hock_a_loogie'));
 assert(!DESKTOP_APPS.some(([id])=>id==='hock_a_loogie'));
 const entry=await fs.readFile(path.join(__dirname,'../index.html'),'utf8');
 assert.match(entry,/<option value="hock_a_loogie">Hock-A-Loogie \(1995, original\)<\/option>/);
 const names=['BBLOOGIE.000','SOS9502.DLL','69.AIF','BING.AIF','HOCKER1.AIF',
  ...Array.from({length:27},(_,i)=>`LOOG${i+1}.AIF`),
  'MEGALOOG.AIF','MEGASPIT.AIF','MEGHOKER.AIF','ROCKTUNE.AIF','SPIT1.AIF','YES.AIF'];
 assert.equal(names.length,38);
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hock-browser-route-'));
 const put=async(name,value)=>{await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),value);};
 let server;
 try {
  await put('lib/apps.js','module.exports='+JSON.stringify({APPS:{hock_a_loogie:app},LOCAL_CANDIDATE_APPS}));
  await put('index.html','<html>\n'+LOCAL_DESKTOP+'\n</html>');
  await put(app.exe,'synthetic metadata fixture, not original runtime evidence');
  assert.equal((await buildCatalog(root)).routes[0].available,false);
  const files=names.map(name=>({url:'game/'+name,vfsPath:'c:\\'+name,size:7}));
  await put(app.localFileManifest,JSON.stringify({files}));
  for(const file of files) await put(base+file.url,'fixture');
  const catalog=await buildCatalog(root), launch=launchFor(candidate,catalog,null,null);
  assert.equal(launch.routes.length,1);
  assert.equal(launch.routes[0].url,'/emulator/?debug&app=hock_a_loogie');
  assert.equal(launch.routes[0].available,true);
  assert.deepEqual(launch.productionRoutes,[]);
  for(const name of [app.exe,...files.map(file=>base+file.url)]) {
   const bytes=await fs.readFile(path.join(root,name));await fs.unlink(path.join(root,name));
   const missing=await buildCatalog(root);
   assert.equal(missing.routes[0].available,false,name);
   assert.equal(launchFor(candidate,missing,null,null).routes[0].url,null);
   assert(missing.routes[0].missingPaths.includes(name));await put(name,bytes);
  }
  await put(base+'game/private.txt','private');await put('scratch/secret.txt','private');
  const serve=createEmulatorHandler(root);
  server=http.createServer(async(req,res)=>{if(!await serve(req,res)){res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;
  assert.equal((await request(port,launch.routes[0].url)).status,200);
  for(const name of [app.exe,...files.map(file=>base+file.url)]) assert.equal((await request(port,'/emulator/'+name)).status,200,name);
  for(const name of [base+'game/private.txt','scratch/secret.txt','../messageboard.txt']) assert.notEqual((await request(port,'/emulator/'+name)).status,200,name);
  await fs.unlink(path.join(root,base+files[0].url));
  await fs.symlink(path.join(root,'scratch/secret.txt'),path.join(root,base+files[0].url));
  assert.equal((await buildCatalog(root)).routes[0].available,false);
  assert.notEqual((await request(port,'/emulator/'+base+files[0].url)).status,200);
 } finally {
  if(server) await new Promise(resolve=>server.close(resolve));
  await fs.rm(root,{recursive:true,force:true});
 }
});
test('kkrieger registered candidate joins corpus and requires the complete local manifest',async()=>{
 const {APPS,DESKTOP_APPS,LOCAL_CANDIDATE_APPS}=require('../lib/apps');

const kkrieger = APPS.kkrieger_beta;
const kkriegerCandidate = require('../test/candidate-corpus/manifest.json').candidates
  .find(candidate => candidate.id === 'kkrieger-beta');
assert.strictEqual(kkrieger.exe,
  'test/binaries/candidates/kkrieger-beta/' + kkriegerCandidate.browser.exe);
assert.strictEqual(kkrieger.localFileManifest,
  'test/binaries/candidates/kkrieger-beta/.wine-assembly-browser.json');
assert.strictEqual(kkrieger.requiredFiles, true);
assert.strictEqual(kkrieger.bigMemory, true);
assert(LOCAL_CANDIDATE_APPS.some(([id]) => id === 'kkrieger_beta'));
assert(!DESKTOP_APPS.some(([id]) => id === 'kkrieger_beta'));
const kkriegerInventory = require('../ops/corpus-inventory').inventory(
  { candidates: [kkriegerCandidate] }, { kkrieger_beta: kkrieger });
assert.strictEqual(kkriegerInventory.length, 1,
  'dashboard must join the registered executable to the existing candidate');
assert.deepStrictEqual(kkriegerInventory[0].appIds, ['kkrieger_beta']);
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'kkrieger-route-'));
 const put=async(name,value)=>{await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),value);};
 try{
  await put('lib/apps.js','module.exports='+JSON.stringify({APPS:{kkrieger_beta:kkrieger},LOCAL_CANDIDATE_APPS}));
  await put(kkrieger.exe,'synthetic metadata fixture, not a playable PE');
  let catalog=await buildCatalog(root);
  assert.equal(catalog.routes[0].available,false);
  assert(catalog.routes[0].missingPaths.includes(kkrieger.localFileManifest));
  await put(kkrieger.localFileManifest,JSON.stringify({files:[{url:'game/pno0001.exe'},{url:'game/readme.txt'},{url:'game/scene.org.txt'}]}));
  const base=path.posix.dirname(kkrieger.localFileManifest);
  await put(base+'/game/readme.txt','synthetic notice fixture');
  catalog=await buildCatalog(root);
  assert.equal(catalog.routes[0].available,false);
  assert(catalog.routes[0].missingPaths.includes(base+'/game/scene.org.txt'));
  await put(base+'/game/scene.org.txt','synthetic notice fixture');
  catalog=await buildCatalog(root);
  assert.equal(catalog.routes[0].available,true);
  assert.equal(catalog.routes[0].url,'/emulator/?debug&app=kkrieger_beta');
  assert(catalog.allowed.has(base+'/game/readme.txt'));
  assert(catalog.allowed.has(base+'/game/scene.org.txt'));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'emulator-server-'));
 const files={'index.html':'<html>\n'+LOCAL_DESKTOP+'\n<script src="lib/apps.js"></script></html>','lib/apps.js':"module.exports={APPS:{game:{exe:'test/binaries/game/game.exe',localFileManifest:'test/binaries/game/files.json'},missing:{exe:'test/binaries/no.exe'}},DESKTOP_APPS:[['game','Game']]};",'lib/dll-registry.js':"module.exports={DLL_PATHS:{'msvcrt.dll':'test/binaries/msvcrt.dll'}};",'lib/guest-worker.js':'worker','host.js':'host','fonts/System.fon':'font','lib/host-import-sigs.generated.json':'{}','src/api_table.json':'[]','build/wine-assembly.wasm':'wasm','test/binaries/game/game.exe':'executable','test/binaries/game/files.json':JSON.stringify({files:[{url:'data.bin'}]}),'test/binaries/game/data.bin':'0123456789','test/binaries/msvcrt.dll':'crt','scratch/secret.txt':'secret','ops/access.json':'secret'};
 for(const [name,content]of Object.entries(files)){await fs.mkdir(path.dirname(path.join(root,name)),{recursive:true});await fs.writeFile(path.join(root,name),content);}
 return root;
}
function request(port,url,method='GET',headers={}){return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path:url,method,headers},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.end();});}
test('JezzBall score helper is served and required before launch', async () => {
 const root = await fixture();
 const app = require('../lib/apps').APPS.wep16_jezzball;
 const helper = 'binaries/wep16/WEP4/WEP4UTIL.DLL';
 try {
  await fs.writeFile(path.join(root, 'lib/apps.js'), 'module.exports=' + JSON.stringify({APPS:{wep16_jezzball:app}}));
  await fs.symlink('test/binaries', path.join(root, 'binaries'));
  for (const asset of [app.exe, ...app.files, ...(app.dlls || []), app.iconFile].filter(Boolean)) {
   const name = typeof asset === 'string' ? asset : asset.url;
   await fs.mkdir(path.dirname(path.join(root, name)), {recursive:true});
   await fs.writeFile(path.join(root, name), 'fixture');
  }
  const complete = await buildCatalog(root);
  assert(complete.allowed.has(helper), 'imported score DLL must pass the hosted allowlist');
  assert.equal(complete.routes[0].available, true);
  await fs.unlink(path.join(root, helper));
  const missing = await buildCatalog(root);
  assert.equal(missing.routes[0].available, false);
  assert.deepEqual(missing.routes[0].missingPaths, [helper]);
 } finally {
  await fs.rm(root, {recursive:true, force:true});
 }
});
// A minimal NE executable whose module-reference table names `modules`.
function neImporting(modules) {
 const ne = 0x40, modTab = 0x40, nameTab = modTab + modules.length * 2;
 const names = [], offsets = [];
 let off = 1;
 for (const name of modules) { offsets.push(off); names.push(name.length, ...Buffer.from(name, 'latin1')); off += 1 + name.length; }
 const bytes = Buffer.alloc(ne + nameTab + 1 + names.length + 16);
 bytes.write('MZ', 0, 'latin1'); bytes.writeUInt32LE(ne, 0x3c);
 bytes.write('NE', ne, 'latin1');
 bytes.writeUInt16LE(modules.length, ne + 0x1e);
 bytes.writeUInt16LE(modTab, ne + 0x28); bytes.writeUInt16LE(nameTab, ne + 0x2a);
 offsets.forEach((value, i) => bytes.writeUInt16LE(value, ne + modTab + i * 2));
 Buffer.from([0, ...names]).copy(bytes, ne + nameTab);
 return bytes;
}

test('Win16 helper modules the exe imports (and win16Modules) are served from beside the exe', async () => {
 // TicTactics imports VBRUN100, which host.js fetches from the exe's own
 // directory; the registry does not list it, so the hosted page 404'd it and
 // the guest trapped at its first instruction (WIN16-WORKER-TRAP-20261011).
 const root = await fixture();
 try {
  const dir = 'test/binaries/wep16/WEP4';
  const apps = {APPS:{tic:{exe:dir + '/TICTACDP.EXE', files:[], win16Modules:['THREED']},
   pe:{exe:dir + '/PLAIN.EXE', files:[]}}};
  await fs.writeFile(path.join(root, 'lib/apps.js'), 'module.exports=' + JSON.stringify(apps));
  await fs.mkdir(path.join(root, dir), {recursive:true});
  await fs.writeFile(path.join(root, dir, 'TICTACDP.EXE'), neImporting(['KERNEL', 'VBRUN100']));
  await fs.writeFile(path.join(root, dir, 'PLAIN.EXE'), 'MZ not an NE image');
  await fs.writeFile(path.join(root, dir, 'VBRUN100.DLL'), 'fixture');
  await fs.writeFile(path.join(root, dir, 'THREED.VBX'), 'fixture');
  await fs.writeFile(path.join(root, dir, 'UNUSED.DLL'), 'fixture');
  const catalog = await buildCatalog(root);
  assert(catalog.allowed.has(dir + '/VBRUN100.DLL'), 'the imported VB runtime must pass the hosted allowlist');
  assert(catalog.allowed.has(dir + '/THREED.VBX'), 'a declared runtime-loaded module is allowed too');
  assert(!catalog.allowed.has(dir + '/UNUSED.DLL'), 'a DLL nothing imports stays private');
  assert(![...catalog.allowed].some(name => /KERNEL/i.test(name)), 'system modules are never looked for');
  assert.equal(catalog.routes.find(r => r.appId === 'tic').available, true);
  await fs.unlink(path.join(root, dir, 'VBRUN100.DLL'));
  const without = await buildCatalog(root);
  assert(!without.allowed.has(dir + '/VBRUN100.DLL'));
  assert.equal(without.routes.find(r => r.appId === 'tic').available, true,
   'an absent helper is not invented as a requirement');
 } finally { await fs.rm(root, {recursive:true, force:true}); }
});

test('registered closure, private entry, GET/HEAD ranges, isolation and denied paths',async()=>{
 const root=await fixture(),serve=createEmulatorHandler(root);const server=http.createServer(async(req,res)=>{try{if(!await serve(req,res)){res.writeHead(404);res.end();}}catch(e){res.writeHead(500);res.end(e.message);}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 try{
  const catalog=await buildCatalog(root);assert.equal(catalog.routes.find(r=>r.appId==='game').available,true);assert.equal(catalog.routes.find(r=>r.appId==='missing').available,false);
  const index=await request(port,'/emulator/?app=game');assert.equal(index.status,200);assert(index.body.includes('const LOCAL_DESKTOP = true;'));assert.equal(index.headers['cross-origin-embedder-policy'],'require-corp');assert.equal(index.headers['cross-origin-opener-policy'],'same-origin');assert.equal((await fs.readFile(path.join(root,'index.html'),'utf8')).includes('LOCAL_DESKTOP = true'),false);
  assert.equal((await request(port,'/emulator/?app=missing')).status,409);assert.equal((await request(port,'/emulator/?app=not_registered')).status,404);
  for(const url of ['/emulator/scratch/secret.txt','/emulator/ops/access.json','/emulator/.git/config','/emulator/../scratch/secret.txt','/emulator/%2e%2e/scratch/secret.txt','/emulator/lib%2fapps.js','/emulator/%252e%252e/scratch/secret.txt'])assert.notEqual((await request(port,url)).status,200,url);
  assert.equal((await request(port,'/emulator/lib/apps.js','POST')).status,405);
  const ranged=await request(port,'/emulator/test/binaries/game/data.bin','GET',{Range:'bytes=2-5'});assert.equal(ranged.status,206);assert.equal(ranged.body,'2345');assert.equal(ranged.headers['content-range'],'bytes 2-5/10');
  const head=await request(port,'/emulator/test/binaries/game/data.bin','HEAD',{Range:'bytes=-3'});assert.equal(head.status,206);assert.equal(head.body,'');assert.equal(head.headers['content-length'],'3');
  assert.equal((await request(port,'/emulator/test/binaries/game/data.bin','GET',{Range:'bytes=99-100'})).status,416);
  assert.equal((await request(port,'/emulator/test/binaries/msvcrt.dll')).body,'crt');
  for(const file of ['fonts/System.fon','lib/host-import-sigs.generated.json','src/api_table.json'])assert.equal((await request(port,'/emulator/'+file)).status,200);
  // Recheck realpath at serve time: replacing an approved file with a symlink
  // outside the repo must not expose it, even with a cached allowlist.
  await fs.unlink(path.join(root,'test/binaries/game/data.bin'));await fs.symlink('/etc/passwd',path.join(root,'test/binaries/game/data.bin'));assert.equal((await request(port,'/emulator/test/binaries/game/data.bin')).status,404);
  await fs.unlink(path.join(root,'test/binaries/game/data.bin'));await fs.symlink(path.join(root,'ops/access.json'),path.join(root,'test/binaries/game/data.bin'));assert.equal((await request(port,'/emulator/test/binaries/game/data.bin')).status,404);
 }finally{await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
});
test('index anchor, suffix ranges and production link provenance fail closed',()=>{
 assert.throws(()=>privateIndex(Buffer.from('no anchor')),/anchor/);assert.throws(()=>privateIndex(Buffer.from(LOCAL_DESKTOP+LOCAL_DESKTOP)),/anchor/);
 assert.equal(rangeFor('bytes=1-2,4-5',10),false);assert.equal(rangeFor('bytes=-0',10),false);assert.deepEqual(rangeFor('bytes=-99',10),{start:0,end:9});
 const c={appIds:['game']},catalog={routes:[{appId:'game',label:'Game',available:true,url:'/emulator/?debug&app=game'}]};assert.equal(launchFor(c,catalog,{status:'unknown',appIds:['game']}).productionRoutes.length,0);assert.equal(launchFor(c,catalog,{status:'verified',appIds:['game'],url:'https://example.test/lib/apps.js'}).productionRoutes[0].url,'https://example.test/?debug&app=game');
});

test('declared sibling assets are launchable without allowing manifest escape into private files',async()=>{
 const root=await fixture();
 try{
  const manifest=path.join(root,'test/binaries/game/files.json');
  await fs.mkdir(path.join(root,'test/binaries/MUSIC'));
  await fs.writeFile(path.join(root,'test/binaries/MUSIC/track.wav'),'music');
  await fs.writeFile(manifest,JSON.stringify({files:[{url:'../MUSIC/track.wav'}]}));
  const good=await buildCatalog(root);
  assert.equal(good.routes.find(r=>r.appId==='game').available,true);
  assert(good.allowed.has('test/binaries/MUSIC/track.wav'));
  await fs.writeFile(manifest,JSON.stringify({files:[{url:'../../../ops/access.json'}]}));
  const bad=await buildCatalog(root);
  assert.equal(bad.routes.find(r=>r.appId==='game').available,false);
  assert.equal(bad.allowed.has('ops/access.json'),false);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('existing authenticated gateway protects entry, worker and binary requests',async()=>{
 const crypto=require('node:crypto'),{createGateway}=require('./hosting/public-server');
 const root=await fixture(),handler=createEmulatorHandler(root);
 const upstream=http.createServer(async(req,res)=>{if(!await handler(req,res)){res.writeHead(404);res.end();}});await new Promise(r=>upstream.listen(0,'127.0.0.1',r));
 const config={origin:'https://private.example',salt:'11'.repeat(16),passwordHash:'22'.repeat(32),sessionKey:'33'.repeat(32)};
 const gateway=createGateway(config,upstream.address().port);await new Promise(r=>gateway.listen(0,'127.0.0.1',r));
 try{
  const port=gateway.address().port;
  for(const url of ['/emulator/?app=game','/emulator/lib/guest-worker.js','/emulator/test/binaries/game/game.exe'])assert.equal((await request(port,url,'GET',{Host:'private.example'})).status,401);
  const value=(Date.now()+60000)+'.test',signature=crypto.createHmac('sha256',Buffer.from(config.sessionKey,'hex')).update(value).digest('hex');
  const headers={Host:'private.example',Cookie:'__Host-wine_ops='+value+'.'+signature};
  const good=await request(port,'/emulator/?app=game','GET',headers);assert.equal(good.status,200);assert.equal(good.headers['cross-origin-embedder-policy'],'require-corp');assert(good.body.includes('LOCAL_DESKTOP = true'));
  const part=await request(port,'/emulator/test/binaries/game/data.bin','GET',{...headers,Range:'bytes=1-3'});assert.equal(part.status,206);assert.equal(part.body,'123');
 }finally{await new Promise(r=>gateway.close(r));await new Promise(r=>upstream.close(r));await fs.rm(root,{recursive:true,force:true});}
});

test('NFS2SE build manifest exception binds exact registry identity and reports missing assets', async () => {
  const root = await fixture();
  const registryPath = path.join(root, 'lib/apps.js');
  const manifest = 'build/nfs2se-browser.json';
  const exe = 'build/nfs2se-demo/NFS2SEA.EXE';
  const asset = 'build/nfs2se-demo/FEDATA/TITLE.QFS';
  const missing = 'build/nfs2se-demo/EACSND.DLL';
  const write = async (name, value) => {
    await fs.mkdir(path.dirname(path.join(root, name)), {recursive:true});
    await fs.writeFile(path.join(root, name), value);
  };
  const register = async (id = 'nfs2se_glide_demo', app = {exe, localFileManifest:manifest}) => {
    await write('lib/apps.js', 'module.exports=' + JSON.stringify({APPS:{[id]:app}}));
    delete require.cache[await fs.realpath(registryPath)];
  };
  const setFiles = files => write(manifest, JSON.stringify({schemaVersion:1, files:files.map(url => ({url}))}));
  try {
    await write(exe, 'exe'); await write(asset, 'fixture');
    await register();
    await setFiles(['nfs2se-demo/NFS2SEA.EXE', 'nfs2se-demo/FEDATA/TITLE.QFS', 'nfs2se-demo/EACSND.DLL']);
    let catalog = await buildCatalog(root);
    assert.equal(catalog.routes[0].available, false);
    assert.equal(catalog.routes[0].reason, 'Registered files are missing.');
    assert.deepEqual(catalog.routes[0].missingPaths, [missing]);
    await write(missing, 'dll');
    catalog = await buildCatalog(root);
    assert.equal(catalog.routes[0].available, true);
    assert(catalog.allowed.has(asset));
    assert(!catalog.allowed.has('build/private.log'));

    for (const url of ['../ops/access.json', 'private.log', 'nfs2se-demo/../private.log',
      'nfs2se-demo-other/private.log', '/etc/passwd', 'https://example.test/data',
      'nfs2se-demo/data?secret', 'nfs2se-demo/data#fragment', 'nfs2se-demo/evil\\path', 'nfs2se-demo/\0data']) {
      await setFiles([url]);
      catalog = await buildCatalog(root);
      assert.equal(catalog.routes[0].available, false, url);
      assert.equal(catalog.routes[0].reason, 'Unsupported manifest asset path', url);
      assert(!catalog.allowed.has('ops/access.json'));
      assert(!catalog.allowed.has('build/private.log'));
    }
    await setFiles(['nfs2se-demo/FEDATA/TITLE.QFS']);
    await register('other_app');
    assert.equal((await buildCatalog(root)).routes[0].reason, 'Unsupported manifest asset path');
    await register('nfs2se_glide_demo', {exe:'build/nfs2se-demo/OTHER.EXE', localFileManifest:manifest});
    assert.equal((await buildCatalog(root)).routes[0].reason, 'Unsupported manifest asset path');
    await write('build/other-manifest.json', JSON.stringify({files:[{url:'nfs2se-demo/FEDATA/TITLE.QFS'}]}));
    await register('nfs2se_glide_demo', {exe, localFileManifest:'build/other-manifest.json'});
    assert.equal((await buildCatalog(root)).routes[0].reason, 'Unsupported manifest asset path');
    await register();
    await fs.unlink(path.join(root, asset));
    await fs.symlink(path.join(root, 'ops/access.json'), path.join(root, asset));
    catalog = await buildCatalog(root);
    assert.equal(catalog.routes[0].available, false);
    assert.deepEqual(catalog.routes[0].missingPaths, [asset]);
  } finally {
    delete require.cache[registryPath];
    await fs.rm(root, {recursive:true, force:true});
  }
});

test('launch links pin the served wasm; a changed module or missing files refuse with the exact reason',async()=>{
 const {readBuildIdentity}=require('./emulator-server');
 const {execFileSync}=require('node:child_process');
 const root=await fixture(),serve=createEmulatorHandler(root);const server=http.createServer(async(req,res)=>{try{if(!await serve(req,res)){res.writeHead(404);res.end();}}catch(e){res.writeHead(500);res.end(e.message);}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 try{
  const sha=require('node:crypto').createHash('sha256').update('wasm').digest('hex');
  let id=await readBuildIdentity(root);
  assert.equal(id.wasmSha256,sha);assert.equal(id.commit,null,'no git checkout: commit stays unknown');assert.equal(id.dirty,null);
  const git=(...args)=>execFileSync('git',['-C',root,'-c','user.name=t','-c','user.email=t@t',...args],{stdio:'pipe'});
  git('init','-q');git('add','-A');git('commit','-qm','fixture');
  id=await readBuildIdentity(root);assert.match(id.commit,/^[0-9a-f]{40}$/);assert.equal(id.dirty,false);assert.equal(id.dirtyFiles,0);
  await fs.writeFile(path.join(root,'host.js'),'changed');id=await readBuildIdentity(root);assert.equal(id.dirty,true);assert.equal(id.dirtyFiles,1);
  const route=launchFor({appIds:['game','missing']},await buildCatalog(root),null,id).routes;
  assert.equal(route[0].url,'/emulator/?debug&app=game&build='+sha);assert.equal(route[1].url,null,'unavailable routes get no link');
  assert.equal(launchFor({appIds:['game']},await buildCatalog(root),null,{wasmSha256:null}).routes[0].url,'/emulator/?debug&app=game');
  assert.equal((await request(port,route[0].url)).status,200);
  const missing=await request(port,'/emulator/?app=missing');assert.equal(missing.status,409);assert.match(missing.body,/missing test\/binaries\/no\.exe/);
  await new Promise(r=>setTimeout(r,20));await fs.writeFile(path.join(root,'build/wine-assembly.wasm'),'rebuilt');
  const changed=await request(port,route[0].url);assert.equal(changed.status,409);assert.match(changed.body,/Served build changed/);assert.match(changed.body,new RegExp(sha.slice(0,12)));
  await fs.unlink(path.join(root,'build/wine-assembly.wasm'));assert.match((await readBuildIdentity(root)).reason,/missing/);
 }finally{await new Promise(r=>server.close(r));await fs.rm(root,{recursive:true,force:true});}
});

test('private launch anchor matches the real shipped entry page', async()=>{
 const original=await fs.readFile(path.join(__dirname,'../index.html'));
 const result=privateIndex(original).toString('utf8');
 assert.match(result,/window\.WINE_HTTP_RANGES = true/);
 assert(result.includes('const LOCAL_DESKTOP = true; // Authenticated private emulator only.'));
 assert.equal(result.includes(LOCAL_DESKTOP),false);
 assert.equal(original.toString('utf8').split(LOCAL_DESKTOP).length,2);
});

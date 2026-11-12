'use strict';
// Tests JS preload wiring with a stub instantiate; never compiles/runs WASM.
const assert=require('node:assert/strict'),fs=require('node:fs'),
  os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const output=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'army-preload-fixture-')),'capture.json');
const script=`
const assert=require('node:assert/strict');
const host={memory:{buffer:new ArrayBuffer(4096)},log(){},log_i32(){},log_api_exit(){}};
const originals={...host};
const ex={get_api_calls:()=>0};
const instance={exports:ex};
let called=0;
WebAssembly.instantiate=async function(m,i) {
  assert.equal(i.host,host); assert.notEqual(host.log,originals.log);
  called++; return instance;
};
require('./tools/army-bltfast-observer');
(async()=>{
  assert.equal(await WebAssembly.instantiate({}, {host}),instance);
  assert.equal(called,1);
  await assert.rejects(WebAssembly.instantiate({}, {host}),/one owning instance/);
})().catch(e=>{console.error(e);process.exitCode=1;});
`;
cp.execFileSync(process.execPath,['-e',script],{cwd:path.resolve(__dirname,'..'),
  env:{...process.env,ARMY_BLTFAST_OUTPUT:output,WINE_REGION_MAP:''},timeout:10000});
const report=JSON.parse(fs.readFileSync(output,'utf8'));
assert.equal(report.accepted,false);assert.equal(report.observer.ownerPinned,true);
assert.deepEqual(report.observer.restored,{log:true,log_i32:true,log_api_exit:true});
// Evidence deliberately retained; no repository/binary cleanup.
console.log('PASS stub instantiate preload ownership, binding, identity, second-owner rejection, exclusive bounded output: '+output);

// Real Node preload inheritance: the owning CLI blocks while its authority and
// transport workers start. Neither worker may claim the CLI's evidence file.
const preload=require.resolve('./army-bltfast-observer');
const transportScript=`
const assert=require('node:assert/strict'),fs=require('node:fs');
const {Worker}=require('node:worker_threads');
const {once}=require('node:events');
const {NamedEventAuthority,NamedEventClient}=require('./lib/named-event-authority');
(async()=>{
  let authority,client;
  try {
    authority=new NamedEventAuthority();
    client=new NamedEventClient(authority.endpoint);
    const ref=client.create('preloaded-transport',false,true);
    assert.equal(client.acquire(ref.handle),true);
    assert.equal(client.acquire(ref.handle),false);
    client.close(ref.handle);
    assert.throws(()=>client.open('preloaded-transport'),{code:'ENOENT'});
    const workerOutput=process.env.ARMY_BLTFAST_OUTPUT+'.worker';
    const worker=new Worker(\`
      const {parentPort}=require('node:worker_threads');
      parentPort.postMessage(WebAssembly.instantiate.toString().includes('[native code]'));
    \`,{eval:true,env:{...process.env,ARMY_BLTFAST_OUTPUT:workerOutput}});
    const exited=once(worker,'exit');
    assert.deepEqual(await once(worker,'message'),[true]);
    assert.deepEqual(await exited,[0]);
    assert.equal(fs.existsSync(workerOutput),false,'non-owner must not create evidence');
    console.log('PASS preloaded authority and client progress; auxiliary Worker untouched');
  } finally {
    if(client)client.shutdown();
    if(authority)await authority.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
`;
for(const route of ['execArgv','NODE_OPTIONS']) {
  const target=output+'.'+route;
  const env={...process.env,ARMY_BLTFAST_OUTPUT:target,WINE_REGION_MAP:'',NODE_OPTIONS:''};
  const args=['-e',transportScript];
  if(route==='execArgv')args.unshift('--require',preload);
  else env.NODE_OPTIONS='--require '+JSON.stringify(preload);
  const r=cp.spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'..'),env,
    encoding:'utf8',timeout:15000});
  assert.equal(r.status,0,route+'\n'+r.stdout+r.stderr);
  assert.match(r.stdout,/PASS preloaded authority and client progress/);
  assert.deepEqual(JSON.parse(fs.readFileSync(target)),
    {accepted:false,error:'No owning instance observed'});
  console.log('PASS '+route+' inheritance: real authority and client workers');
}

// Main-thread ownership remains exclusive, and unsupported maps still reject.
const originalBytes=fs.readFileSync(output);
for(const [name,env,pattern] of [
  ['existing output',{ARMY_BLTFAST_OUTPUT:output,WINE_REGION_MAP:''},/EEXIST/],
  ['foreign map',{ARMY_BLTFAST_OUTPUT:output+'.foreign',WINE_REGION_MAP:'foreign'},/matching default region map/],
  ['relative output',{ARMY_BLTFAST_OUTPUT:'relative.json',WINE_REGION_MAP:''},/must be absolute/],
]) {
  const r=cp.spawnSync(process.execPath,['--require',preload,'-e',''],{
    env:{...process.env,...env,NODE_OPTIONS:''},encoding:'utf8',timeout:10000});
  assert.equal(r.status,1,name);
  assert.match(r.stderr,pattern);
}
assert.deepEqual(fs.readFileSync(output),originalBytes);
console.log('PASS main owner collision/map/path rejecting controls; prior evidence unchanged');

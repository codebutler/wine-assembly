'use strict';
// Independent offline composition review. The historical runner is intercepted
// at its real Module compiler boundary; only extracted guest/renderer interfaces run.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const vm = require('node:vm');
const Module = require('node:module');
const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '..');
const ev = path.join(repo, 'docs/re-notes/enigma-terminal-capture-guard-20261024');
const fe = path.join(repo, 'docs/re-notes/enigma-historical-findfirst-compat-20261024-evidence');
const read = n => zlib.gunzipSync(fs.readFileSync(path.join(ev, n+'.gz'))).toString();
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const files = {F:path.join(repo,'tools/enigma-findfirst-compat.cjs'),
 T:path.join(repo,'tools/enigma-terminal-capture-guard.cjs'),
 Q:path.join(repo,'tools/enigma-quiet-filesystem.cjs')};
if (!process.argv[2]) {
 const results=[];
 for(const order of ['FTQ','TFQ','FQT','TQF','QFT','QTF']) {
  const mem=Number(/^MemAvailable:\s+(\d+)/m.exec(fs.readFileSync('/proc/meminfo','utf8'))[1])*1024;
  assert(mem>=805306368);
  const p=spawnSync(process.execPath,['--max-old-space-size=256',__filename,order],{encoding:'utf8',timeout:60000,maxBuffer:65536});
  assert.ifError(p.error);assert.equal(p.status,0,p.stderr);
  results.push(JSON.parse(p.stdout));
 }
 console.log(JSON.stringify({pass:true,results},null,2));
} else {
 const order=process.argv[2], root=fs.mkdtempSync(path.join(os.tmpdir(),'enigma-independent-'));
 const originalCompile=Module.prototype._compile, originalLoad=Module._load, originalWrite=fs.writeFileSync;
 try {
  fs.mkdirSync(path.join(root,'test'));fs.mkdirSync(path.join(root,'lib'));
  const runner=read('runner.js'), historical=read('filesystem.js'), capture=read('capture.cjs');
  const runFile=path.join(root,'test/run.js'), fsFile=path.join(root,'lib/filesystem.js'), capFile=path.join(root,'capture.cjs'), receipt=path.join(root,'denial.json');
  fs.writeFileSync(runFile,runner);fs.writeFileSync(fsFile,historical);fs.writeFileSync(capFile,capture);
  for(const n of ['mem-utils.js','region-map.generated.js','byte-provider.js']) fs.writeFileSync(path.join(root,'lib',n),zlib.gunzipSync(fs.readFileSync(path.join(fe,n+'.gz'))));
  const pins=JSON.parse(fs.readFileSync(path.join(ev,'png-standing.json'))).standingReadonlyPNG;
  for(const p of pins) {const b=fs.readFileSync(p.path);assert.equal(b.length,p.bytes);assert.equal(sha(b),p.sha256);}
  const png=require(path.dirname(pins.find(p=>p.path.endsWith('/package.json')).path));
  const compiled=new Map(), io=[];
  const restores=[];
  for(const n of ['openSync','writeSync','fsyncSync','closeSync','linkSync','unlinkSync']) {
   const f=fs[n];restores.push(()=>fs[n]=f);fs[n]=function(...args){const value=f.apply(this,args);io.push(n);return value;};
  }
  Module.prototype._compile=function(source,file){
   if([runFile,fsFile,capFile].includes(file))compiled.set(file,source);
   if(file===runFile)return; // Never instantiate a guest or execute runner setup.
   return originalCompile.call(this,source,file);
  };
  Module._load=function(name,parent,...args){if(parent?.filename===capFile && name==='./runner/node_modules/pngjs')return png;return originalLoad.call(this,name,parent,...args);};
  const adapters={};let rejection;
  try {
   for(const key of order){const a=adapters[key]=require(files[key]);if(key==='T')a.install(root,capFile,receipt);else a.install(root);}
   process.env.MAELSTROM_CAPTURE_INSTALL='1';
   require(capFile);require(runFile);require(fsFile);
  }catch(error){rejection=error;}
  if(!['FTQ','TFQ'].includes(order)) {
   assert(rejection,'unsupported order must reject');assert.match(rejection.message,/preload order|source identity/);
   assert(!compiled.has(runFile));console.log(JSON.stringify({order,rejected:true,message:rejection.message.split('\n')[0]}));
  } else {
   assert.ifError(rejection);
   const source=compiled.get(runFile), ff=adapters.F, terminal=adapters.T;
   assert.equal(source,terminal.transformRunner(adapters.Q.transform(runner)));
   assert.equal(compiled.get(fsFile),fs.readFileSync(path.join(repo,'lib/filesystem.js'),'utf8'));
   assert.equal(compiled.get(capFile),terminal.transformCapture(capture));
   // Run unchanged literal/wildcard/path/metadata oracle on actual adapted VFS.
   const saved=process.argv;process.argv=[process.execPath,path.join(repo,'test/test-vfs-findfirst-literals.js'),fsFile];
   const log=console.log;console.log=()=>{};
   try{require(path.join(repo,'test/test-vfs-findfirst-literals.js'));}finally{console.log=log;process.argv=saved;}
   let seed=0x13572468;const pixels=Buffer.alloc(256*256*4);
   for(let i=0;i<pixels.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;pixels[i]=seed&255;}
   const bad=png.PNG.sync.write({width:256,height:256,data:pixels});
   const good=png.PNG.sync.write({width:2,height:2,data:Buffer.alloc(16,127)});
   const start=source.indexOf("      } else if (ev.action === 'png' && renderer && renderer.canvas) {");
   const end=source.indexOf("      } else if (ev.action === 'png-raw'",start);
   const bs=source.indexOf('    } catch (e) {\n',source.indexOf('if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);'));
   const be=source.indexOf('\n\n    if (gameplayBench',bs);
   assert(start>0&&end>start&&bs>end&&be>bs);
   const fragment=s=>{
    const a=s.indexOf("      } else if (ev.action === 'png' && renderer && renderer.canvas) {");
    const b=s.indexOf("      } else if (ev.action === 'png-raw'",a);
    const c=s.indexOf('    } catch (e) {\n',s.indexOf('if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);'));
    const d=s.indexOf('\n\n    if (gameplayBench',c);
    return `for(let batch=30000;batch<30002;batch++){try{if(false){\n${s.slice(a,b)}\n}\ninstance.exports.run(BATCH_SIZE);\n${s.slice(c,d)}\n}`;
   };
   function execute(s,input){
    let runs=0,caught;const logs=[];const output=path.join(root,'frame.png');
    try{vm.runInNewContext(fragment(s),{require,Buffer,fs,logs,ev:{action:'png',path:output},renderer:{canvas:{},repaint(){}},canvasToPng:()=>input,ctx:{},DUMP_BACKCANVAS:false,
     instance:{exports:{run(){runs++;},get_eip:()=>0}},BATCH_SIZE:1000,flushLogs(){},console:{log:(...x)=>logs.push(x.join(' '))},eipBefore:0,describeAddr:String,hex:String,regs:()=>'',disasmAt(){},dumpStack(){},TRACE_SEH:false,process:{exit(){throw Error('mock exit');}}});}catch(e){caught=e;}
    return {runs,caught,logs,output};
   }
   const normal=execute(source,good);assert.equal(normal.runs,2);assert.equal(normal.caught,undefined);
   assert.deepEqual(png.PNG.sync.read(fs.readFileSync(normal.output)).data,png.PNG.sync.read(good).data);
   fs.unlinkSync(normal.output);assert(!fs.existsSync(receipt));
   io.length=0;const denied=execute(source,bad);
   assert.equal(denied.runs,0);assert.deepEqual(denied.logs,[]);assert(!fs.existsSync(denied.output));
   assert.equal(denied.caught.code,'ERR_ASSERTION');assert.equal(denied.caught.message,'capture byte limit');
   assert.throws(()=>terminal.rethrow(),e=>e===denied.caught);
   assert.deepEqual(io,['openSync','writeSync','fsyncSync','closeSync','linkSync','unlinkSync','openSync','fsyncSync','closeSync']);
   const record=JSON.parse(fs.readFileSync(receipt));assert.equal(record.artifactAccepted,false);assert.equal(record.terminal,true);
   // Remove BOTH injected catch rethrows, keeping the actual compiled producer.
   const call=`require(${JSON.stringify(files.T)}).rethrow();`;
   assert.equal(source.split(call).length,3);
   const reverted=source.split(call).join('');
   const mutant=execute(reverted,bad);assert.equal(mutant.runs,2);assert.equal(mutant.caught,undefined);
   assert(mutant.logs.every(x=>x.includes('png FAILED')));
   assert.throws(()=>assert.equal(mutant.runs,0));
   // Original capture's remaining guards are unchanged and still executable.
   const cap=require(capFile);assert.throws(()=>cap.encode(Buffer.from('invalid')),/real PNG required/);
   const dimensions=Buffer.from(good);dimensions.writeUInt32BE(801,16);assert.throws(()=>cap.encode(dimensions),/capture dimensions/);
   fs.writeFileSync(path.join(root,'third.png'),good);
   assert.throws(()=>fs.writeFileSync(path.join(root,'fourth.png'),good),/capture frame limit/);
   for(const restore of restores)restore();
   console.log(JSON.stringify({order,pass:true,runnerSHA256:sha(source),adaptedVfsSHA256:sha(compiled.get(fsFile)),captureSHA256:sha(compiled.get(capFile)),terminalIdentity:true,durableReceipt:true,noNextMainRun:true,successPixels:true,revertingMutationRejected:true,unchangedGuardChecks:true,record}));
  }
 }finally{Module.prototype._compile=originalCompile;Module._load=originalLoad;fs.writeFileSync=originalWrite;fs.rmSync(root,{recursive:true,force:true});}
}

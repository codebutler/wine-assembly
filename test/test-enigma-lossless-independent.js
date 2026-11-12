'use strict';
// Independent acceptance: execute the pinned canvas encoder and distinguish
// size fallback from fatal codec, pixel verification and underlying I/O errors.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const Module = require('node:module');
const os = require('node:os');
const repo = path.resolve(__dirname, '..');
const evidence = path.join(repo, 'docs/re-notes/enigma-lossless-independent-integrate-20261024');
const historical = path.join(repo, 'docs/re-notes/enigma-terminal-capture-guard-20261024');
const read = (dir, name) => zlib.gunzipSync(fs.readFileSync(path.join(dir, name + '.gz'))).toString();
assert(Number(/^MemAvailable:\s+(\d+)/m.exec(fs.readFileSync('/proc/meminfo', 'utf8'))[1])*1024 >= 805306368);
const standing = JSON.parse(fs.readFileSync(path.join(historical, 'png-standing.json'))).standingReadonlyPNG;
for (const p of standing) {
  const b = fs.readFileSync(p.path);
  assert.equal(b.length,p.bytes); assert.equal(crypto.createHash('sha256').update(b).digest('hex'),p.sha256);
}
const {PNG} = require(path.dirname(standing.find(p=>p.path.endsWith('/package.json')).path));
function evaluate(source, req) {
  const module = {exports:{}};
  vm.runInNewContext('(function(require,module){'+source+'\n})', {Buffer, process})(req,module);
  return module.exports;
}
const pinned = JSON.parse(fs.readFileSync(path.join(evidence,'pinned-canvas.json')));
const sources = {};
for (const [file,pin] of Object.entries(pinned)) {
  const source = read(evidence,path.basename(file)); sources[file]=source;
  assert.equal(Buffer.byteLength(source),pin.bytes);
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),pin.sha256);
}
const raster = evaluate(sources['lib/raster-canvas.js'],name=>name==='pngjs'?{PNG}:require(name));
const compat = evaluate(sources['lib/canvas-compat.js'],name=>{assert.equal(name,'./raster-canvas');return raster;});
const canvas = compat.createCanvas(640,480);
let seed=0x24681357;
const tile=Buffer.alloc(4*8*8);
for(let i=0;i<tile.length;i++){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;tile[i]=seed&255;}
const pixels=canvas._data;
for(let y=0;y<480;y++)for(let x=0;x<640;x++)tile.copy(pixels,4*(y*640+x),4*((y%8)*8+x%8),4*((y%8)*8+x%8)+4);
const runner=read(historical,'runner.js');
assert.equal(crypto.createHash('sha256').update(runner).digest('hex'),'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809');
const start=runner.indexOf('function canvasToPng(canvas) {');
const end=runner.indexOf('\n}\n',start)+2;
const input=vm.runInNewContext(runner.slice(start,end)+'\ncanvasToPng(canvas)',{canvas,presentForRead(){}});
assert.deepEqual([...input.subarray(24,29)],[8,6,0,0,0]);
assert.deepEqual(PNG.sync.read(input).data,Buffer.from(pixels));
const encoderFile=path.join(repo,'tools/lossless-capture-png.cjs');
const encoderSource=fs.readFileSync(encoderFile,'utf8');
const outcomes=[];
function check(source,kind) {
  const calls=[]; const fatal=new Error('independent codec failure');
  const codec={sync:{read:PNG.sync.read,write(image,options){
    calls.push(options.deflateStrategy);
    if(kind==='codec-error')throw fatal;
    if(kind==='pixel-corruption') {
      const data=Buffer.from(image.data);data[3]^=255;
      return PNG.sync.write({...image,data},{...options,deflateStrategy:0});
    }
    return PNG.sync.write(image,options);
  }}};
  const encoder=evaluate(source,require);
  if(kind==='fallback') {
    const output=encoder.encode(codec,input);
    assert.deepEqual(calls,[3,0]);assert(output.length<=131072);
    assert.deepEqual(PNG.sync.read(output).data,Buffer.from(pixels));
  } else {
    assert.throws(()=>encoder.encode(codec,input),kind==='codec-error'?e=>e===fatal:/capture pixel identity/);
    assert.deepEqual(calls,[3],'fatal validation must not fall back');
  }
  return calls;
}
for(const kind of ['fallback','codec-error','pixel-corruption'])outcomes.push({kind,calls:check(encoderSource,kind)});
const mutated=encoderSource.replace("assert.deepEqual(decoded.data, image.data, 'capture pixel identity');",'');
assert.notEqual(mutated,encoderSource);
assert.throws(()=>check(mutated,'pixel-corruption'),/Missing expected exception/);
outcomes.push({kind:'remove-pixel-verification-mutant',rejected:true});
// Actual Module._compile hook and capture fs interceptor, with a real underlying
// write failure. It must latch the same error and prevent even ordinary writes.
const root=fs.mkdtempSync(path.join(os.tmpdir(),'enigma-independent-'));
const originalWrite=fs.writeFileSync,originalCompile=Module.prototype._compile,originalLoad=Module._load;
const adapterFile=path.join(repo,'tools/enigma-terminal-capture-guard.cjs');
try {
  fs.mkdirSync(path.join(root,'test'));
  fs.writeFileSync(path.join(root,'test/run.js'),runner);
  const capture=path.join(root,'capture.cjs');fs.writeFileSync(capture,read(historical,'capture.cjs'));
  const receipt=path.join(root,'receipt.json');const target=path.join(root,'first.png');
  const fatal=Object.assign(new Error('independent underlying write failure'),{code:'EIO'});
  let attempts=0;
  fs.writeFileSync=function(file,...args){if(file===target){attempts++;throw fatal;}return originalWrite.call(this,file,...args);};
  Object.assign(process.env,{ENIGMA_TERMINAL_CAPTURE_INSTALL:'1',ENIGMA_LOSSLESS_CAPTURE:'1',MAELSTROM_CAPTURE_INSTALL:'1',
    ENIGMA_RUNNER_ROOT:root,ENIGMA_CAPTURE_PATH:capture,ENIGMA_TERMINAL_RECEIPT:receipt});
  Module._load=function(name,...args){return name==='./runner/node_modules/pngjs'?{PNG}:originalLoad.call(this,name,...args);};
  const adapter=require(adapterFile);require(capture);
  assert.throws(()=>fs.writeFileSync(target,input),e=>e===fatal);
  const later=path.join(root,'dependent.txt');assert.throws(()=>fs.writeFileSync(later,'sentinel'),e=>e===fatal);
  assert.throws(()=>adapter.rethrow(),e=>e===fatal);assert.equal(attempts,1);
  assert(!fs.existsSync(target)&&!fs.existsSync(later));
  const record=JSON.parse(fs.readFileSync(receipt));assert.equal(record.code,'EIO');assert.equal(record.artifactAccepted,false);
  outcomes.push({kind:'actual-compile-writer-EIO',attempts,identity:true,dependentAbsent:true,receipt:record});
} finally {
  fs.writeFileSync=originalWrite;Module.prototype._compile=originalCompile;Module._load=originalLoad;
  fs.rmSync(root,{recursive:true,force:true});
}
console.log(JSON.stringify({pass:true,pinnedCanvasIHDR:[8,6,0,0,0],outcomes}));

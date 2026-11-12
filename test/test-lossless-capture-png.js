'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');
const evidence = path.resolve(__dirname, '../docs/re-notes/enigma-terminal-capture-guard-20261024');
const manifest = JSON.parse(fs.readFileSync(path.join(evidence, 'png-standing.json')));
for (const e of manifest.standingReadonlyPNG) {
  const data = fs.readFileSync(e.path);
  assert.equal(data.length, e.bytes);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), e.sha256);
}
const codec = path.dirname(manifest.standingReadonlyPNG.find(e => e.path.endsWith('/package.json')).path);
const { PNG } = require(codec);
const encoderFile = path.resolve(__dirname, '../tools/lossless-capture-png.cjs');
const { encode } = require(encoderFile);
const adapterFile = path.resolve(__dirname, '../tools/enigma-terminal-capture-guard.cjs');
const read = name => zlib.gunzipSync(fs.readFileSync(path.join(evidence, name + '.gz')));
function random(n) {
  const b = Buffer.alloc(n); let s = 0x12345678;
  for (let i=0; i<n; i++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; b[i] = s & 255; }
  return b;
}
function fixtures() {
  const tile = random(8*8*4), data = Buffer.alloc(640*480*4);
  for (let y=0; y<480; y++) for(let x=0; x<640; x++)
    tile.copy(data,(y*640+x)*4,((y%8)*8+x%8)*4,((y%8)*8+x%8)*4+4);
  const image = {width:640,height:480,data};
  return {image, input:PNG.sync.write(image), noise:PNG.sync.write({width:256,height:256,data:random(256*256*4)})};
}
const memAvailable = Number(/^MemAvailable:\s+(\d+)/m.exec(fs.readFileSync('/proc/meminfo','utf8'))[1])*1024;
assert(memAvailable >= 805306368, 'fresh codec memory admission');
const f = fixtures();
if (process.argv[2] === 'child') {
  const root = process.argv[3], mode = process.argv[4];
  const capture = path.join(root,'capture.cjs'), receipt = path.join(root,'receipt.json');
  Object.assign(process.env,{ENIGMA_TERMINAL_CAPTURE_INSTALL:'1',ENIGMA_LOSSLESS_CAPTURE:'1',
    ENIGMA_RUNNER_ROOT:root,ENIGMA_CAPTURE_PATH:capture,ENIGMA_TERMINAL_RECEIPT:receipt});
  const a = require(adapterFile);
  const resolve = Module._resolveFilename;
  Module._resolveFilename = function(name,...args) {
    return resolve.call(this,name === './runner/node_modules/pngjs' ? codec : name,...args);
  };
  process.env.MAELSTROM_CAPTURE_INSTALL = '1';
  // Execute the actual transformed module and actual fs.writeFileSync interceptor.
  const transformed = a.transformLosslessCapture(read('capture.cjs').toString());
  const compiler = Module.prototype._compile;
  if (mode === 'mutation') { delete require.cache[encoderFile]; }
  if (mode === 'mutation') Module.prototype._compile = function(src,file) {
    if(file === encoderFile) src=src.replace('[3, 0]', '[3]');
    return compiler.call(this,src,file);
  };
  const producer = require(capture);
  const output = path.join(root,'output.png');
  let error;
  try {
    if(mode === 'frames') for(let n=0;n<4;n++) fs.writeFileSync(output,f.input);
    else if(mode === 'dimensions') { const bad=Buffer.from(f.input);bad.writeUInt32BE(801,16);fs.writeFileSync(output,bad); }
    else if(mode === 'malformed') fs.writeFileSync(output,Buffer.from('invalid'));
    else fs.writeFileSync(output,mode === 'noise' ? f.noise : f.input);
  } catch(e) {error=e;}
  if(mode === 'success') {
    assert.equal(error,undefined);assert(!fs.existsSync(receipt));
    assert.deepEqual(PNG.sync.read(fs.readFileSync(output)).data,f.image.data);
  } else {
    assert(error); let latched;try{a.rethrow();}catch(e){latched=e;}
    assert.equal(error,latched);
    const r=JSON.parse(fs.readFileSync(receipt));assert.equal(r.artifactAccepted,false);
    if(mode==='noise'||mode==='mutation') {
      assert.equal(r.message,'capture byte limit');assert.equal(r.code,'ERR_ASSERTION');
      assert.equal(r.captureSHA256,a.pins.capture);assert.equal(r.runnerSHA256,a.pins.runner);
    }
    const before=fs.existsSync(output)?fs.readFileSync(output):null;
    assert.throws(()=>fs.writeFileSync(path.join(root,'later.txt'),'sentinel'),e=>e===error);
    assert(!fs.existsSync(path.join(root,'later.txt')));
    if(before) assert.deepEqual(fs.readFileSync(output),before);else assert(!fs.existsSync(output));
    if(mode==='frames') assert.equal(error.message,'capture frame limit');
  }
  // Byte/frame/cumulative constants remain in actual transformed writer.
  assert(transformed.includes('++frames<=3'));assert(transformed.includes('total<=393216'));
  // 3 * single cap == cumulative cap, so cumulative rejection is unreachable
  // without first rejecting the single/frame invariant. Test the real assertion
  // with an injected prior accounting state, without changing its threshold.
  process.stdout.write(JSON.stringify({mode,pass:true,message:error?.message})+'\n');
  process.exit(0);
}
const old = PNG.sync.write(f.image,{deflateLevel:9,deflateStrategy:3});
assert(old.length>131072);
const improved=encode(PNG,f.input);
assert(improved.length<=131072);assert.deepEqual(PNG.sync.read(improved).data,f.image.data);
assert.deepEqual(encode(PNG,f.input),improved,'deterministic encoding');
assert.throws(()=>encode(PNG,f.noise),/capture byte limit/);
for(const bad of [Buffer.alloc(0),f.input.subarray(0,20),f.input.subarray(0,-1),Buffer.concat([f.input,Buffer.from('extra')])])
  assert.throws(()=>encode(PNG,bad));
const dimensions=Buffer.from(f.input);dimensions.writeUInt32BE(801,16);assert.throws(()=>encode(PNG,dimensions),/capture dimensions/);
const crc=Buffer.from(f.input);crc[29]^=1;assert.throws(()=>encode(PNG,crc));
const interlace=Buffer.from(f.input);interlace[28]=1;assert.throws(()=>encode(PNG,interlace),/non-interlaced/);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'lossless-png-'));
const outcomes=[];
try {
  for(const mode of ['success','noise','frames','dimensions','malformed','mutation']) {
    const dir=path.join(root,mode);fs.mkdirSync(path.join(dir,'test'),{recursive:true});
    fs.writeFileSync(path.join(dir,'test/run.js'),read('runner.js'));
    fs.writeFileSync(path.join(dir,'capture.cjs'),read('capture.cjs'));
    const p=spawnSync(process.execPath,['--max-old-space-size=256',__filename,'child',dir,mode],{encoding:'utf8',timeout:10000,maxBuffer:8192});
    assert.equal(p.status,0,p.stderr);outcomes.push(JSON.parse(p.stdout));
  }
  // Fault injection into accounting state of the actual transformed writer.
  const a=require(adapterFile),source=a.transformLosslessCapture(read('capture.cjs').toString());
  const altered=source.replace('let frames=0,total=0','let frames=0,total=393216');
  assert.notEqual(altered,source);
  const vm=require('node:vm');const writes=[];const fakeFS={writeFileSync:(...x)=>writes.push(x)};
  const errors=[];const rejector={rethrow(){if(errors.length)throw errors[0];},reject(e){errors.push(e);throw e;}};
  const req=name=>name==='fs'?fakeFS:name===adapterFile?rejector:name.includes('pngjs')?{PNG}:require(name);
  vm.runInNewContext('(function(require,module){'+altered+'\n})',{Buffer,process:{env:{MAELSTROM_CAPTURE_INSTALL:'1'},stderr:{write(){}}}})(req,{exports:{}});
  assert.throws(()=>fakeFS.writeFileSync('x.png',f.input),/capture cumulative byte limit/);
  assert.equal(writes.length,0);assert.equal(errors.length,1);
  assert.throws(()=>fakeFS.writeFileSync('later.png',f.input),e=>e===errors[0]);
  assert.equal(writes.length,0);
  outcomes.push({mode:'actual-cumulative-assertion-state-injection',pass:true});
  console.log(JSON.stringify({pass:true,width:640,height:480,oldStrategy3Bytes:old.length,improvedBytes:improved.length,
    pixelSHA256:crypto.createHash('sha256').update(f.image.data).digest('hex'),pngSHA256:crypto.createHash('sha256').update(improved).digest('hex'),outcomes}));
} finally {fs.rmSync(root,{recursive:true,force:true});}

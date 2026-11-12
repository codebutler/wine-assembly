'use strict';
// End-to-end offline capture: pinned source, real pngjs, actual _compile hook
// and writer. Mutants run through the same acceptance assertions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const Module = require('node:module');
const {spawnSync} = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const historical = path.join(repo, 'docs/re-notes/enigma-terminal-capture-guard-20261024');
const read = name => zlib.gunzipSync(fs.readFileSync(path.join(historical, name + '.gz')));
const manifest = JSON.parse(fs.readFileSync(path.join(historical, 'png-standing.json')));
for (const p of manifest.standingReadonlyPNG) {
  const b = fs.readFileSync(p.path);
  assert.equal(b.length, p.bytes);
  assert.equal(crypto.createHash('sha256').update(b).digest('hex'), p.sha256);
}
const codec = path.dirname(manifest.standingReadonlyPNG.find(p => p.path.endsWith('/package.json')).path);
const {PNG} = require(codec);
const adapterFile = path.join(repo, 'tools/enigma-terminal-capture-guard.cjs');
const encoderFile = path.join(repo, 'tools/lossless-capture-png.cjs');
const {profileLimits} = require(encoderFile);
assert.deepEqual(profileLimits(), {maxBytes:131072, cumulativeBytes:393216, maxFrames:3});
assert.deepEqual(profileLimits('single-frame'), {maxBytes:2097152, cumulativeBytes:2097152, maxFrames:1});
for (const invalid of ['', '__proto__', 'constructor', '2097152', 2097152, Infinity, null, {}, [], 'single-frame ']) {
  assert.throws(() => profileLimits(invalid), /capture profile/);
  assert.throws(() => require(adapterFile).transformLosslessCapture(read('capture.cjs').toString(), invalid), /capture profile/);
  assert.throws(() => require(adapterFile).install('', '', '', true, invalid), /capture profile/);
}
assert.throws(() => require(adapterFile).install('', '', '', false, 'single-frame'), /requires lossless/);
assert(Number(/^MemAvailable:\s+(\d+)/m.exec(fs.readFileSync('/proc/meminfo','utf8'))[1])*1024 >= 805306368);

if (process.argv[2] === 'child') {
  const [root, mode, mutant] = process.argv.slice(3);
  const originalWrite = fs.writeFileSync;
  const capture = path.join(root, 'capture.cjs'), target = path.join(root, 'output.png');
  fs.mkdirSync(path.join(root, 'test'), {recursive:true});
  fs.writeFileSync(path.join(root, 'test/run.js'), read('runner.js'));
  const captureBytes = read('capture.cjs');
  assert.equal(crypto.createHash('sha256').update(captureBytes).digest('hex'), '6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079');
  fs.writeFileSync(capture, captureBytes);
  // Pinned canvas compatibility was established independently; produce the
  // same RGBA8 format using its real raster canvas and default toBufferSync.
  const vm = require('node:vm');
  const rasterSource = zlib.gunzipSync(fs.readFileSync(path.join(repo, 'docs/re-notes/enigma-lossless-independent-integrate-20261024/raster-canvas.js.gz'))).toString();
  const canvasPins = JSON.parse(fs.readFileSync(path.join(repo, 'docs/re-notes/enigma-lossless-independent-integrate-20261024/pinned-canvas.json')));
  assert.equal(crypto.createHash('sha256').update(rasterSource).digest('hex'), canvasPins['lib/raster-canvas.js'].sha256);
  const mod = {exports:{}};
  vm.runInNewContext('(function(require,module){'+rasterSource+'\n})', {Buffer,process})(name=>name==='pngjs'?{PNG}:require(name), mod);
  const canvas = mod.exports.createCanvas(640,480);
  let seed = 0x12345678;
  for(let i=0;i<canvas._data.length;i++) {seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;canvas._data[i]=seed&255;}
  const input = canvas.toBufferSync();
  assert(input.length > 131072 && input.length <= 2097152);
  assert.deepEqual([...input.subarray(24,29)], [8,6,0,0,0]);
  const pixels = Buffer.from(canvas._data);
  const calls = [];
  const realWritePNG = PNG.sync.write;
  PNG.sync.write = function(image, options) {
    calls.push([options.deflateLevel, options.deflateStrategy]);
    if (mode === 'pixels') {
      const data = Buffer.from(image.data); data[3] ^= 255;
      return realWritePNG({...image,data},options);
    }
    return realWritePNG(image,options);
  };
  const fatal = Object.assign(new Error('single-frame writer failure'), {code:'EIO'});
  let writerAttempts = 0;
  fs.writeFileSync = function(file,...args) {
    if(file === target) {writerAttempts++;if(mode==='writer')throw fatal;}
    return originalWrite.call(this,file,...args);
  };
  const oldCompile = Module.prototype._compile;
  let changed = false;
  Module.prototype._compile = function(source, file) {
    const replace = (a,b) => {assert(source.includes(a)); source=source.replace(a,b);changed=true;};
    if(file===capture) {
      if(mode==='cumulative')replace('let frames=0,total=0','let frames=0,total=2097152');
      if(mutant==='profile')replace('.encode(PNG, buf, "single-frame")','.encode(PNG, buf, "default")');
      if(mutant==='frame')replace("assert(++frames<=1,'capture frame limit')",'++frames');
      if(mutant==='cumulative')replace("assert(total<=2097152,'capture cumulative byte limit')",'true');
    }
    if(file===encoderFile && mutant==='pixels')replace("assert.deepEqual(decoded.data, image.data, 'capture pixel identity');",'');
    return oldCompile.call(this,source,file);
  };
  delete require.cache[encoderFile];
  Object.assign(process.env, {MAELSTROM_CAPTURE_INSTALL:'1', ENIGMA_TERMINAL_CAPTURE_INSTALL:'1',
    ENIGMA_LOSSLESS_CAPTURE:'1', ENIGMA_CAPTURE_PROFILE:mode==='default'?'default':'single-frame',
    ENIGMA_RUNNER_ROOT:root, ENIGMA_CAPTURE_PATH:capture, ENIGMA_TERMINAL_RECEIPT:path.join(root,'receipt.json')});
  delete require.cache[adapterFile];
  const load = Module._resolveFilename;
  Module._resolveFilename = function(name,...args) {return load.call(this,name==='./runner/node_modules/pngjs'?codec:name,...args);};
  const adapter = require(adapterFile);
  require(capture); // actual install -> Module._compile -> transformed writer
  let candidate = input;
  if(mode==='dimensions') {candidate=Buffer.from(input);candidate.writeUInt32BE(801,16);}
  if(mode==='malformed')candidate=Buffer.from('invalid png');
  if(mode==='crc') {candidate=Buffer.from(input);candidate[29]^=1;}
  if(mode==='data') {candidate=Buffer.from(input);candidate[50]^=1;}
  let error, receipt;
  try {
    fs.writeFileSync(target,candidate);
    if(mode==='frames')fs.writeFileSync(target,input);
  } catch(e) {error=e;}
  if(mode==='success') {
    assert.equal(error,undefined);
    assert(!fs.existsSync(process.env.ENIGMA_TERMINAL_RECEIPT));
    const output=fs.readFileSync(target), decoded=PNG.sync.read(output,{checkCRC:true});
    assert(output.length>131072 && output.length<=2097152);
    assert.equal(decoded.width,640);assert.equal(decoded.height,480);assert.deepEqual(decoded.data,pixels);
    assert.deepEqual(calls,[[9,3]]);assert.equal(writerAttempts,1);
  } else {
    assert(error,'expected rejection');
    if(mode==='writer')assert.equal(error,fatal);
    if(mode==='frames')assert.equal(error.message,'capture frame limit');
    if(mode==='cumulative')assert.equal(error.message,'capture cumulative byte limit');
    if(mode==='pixels')assert.match(error.message,/capture pixel identity/);
    if(mode==='dimensions')assert.equal(error.message,'capture dimensions');
    receipt=JSON.parse(fs.readFileSync(process.env.ENIGMA_TERMINAL_RECEIPT));
    assert.equal(receipt.artifactAccepted,false);
    assert.equal(receipt.message,error.message.slice(0,256));
    if(mode==='default') {
      assert.equal(error.message,'capture byte limit');assert.deepEqual(calls,[[9,3],[9,0]]);
      assert.deepEqual(receipt.encoding.candidateBytes,error.captureDiagnostic.candidateBytes);
      assert.equal(receipt.encoding.candidateBytes.length,2);
      assert(receipt.encoding.candidateBytes.every(n=>n>131072 && n<=2097152));
      assert.equal(fs.statSync(process.env.ENIGMA_TERMINAL_RECEIPT).size<1024,true);
    } else assert.equal(receipt.profile,'single-frame');
    assert.equal(writerAttempts, mode==='frames'||mode==='writer'?1:0);
    if(mode!=='frames')assert(!fs.existsSync(target));
    const before=fs.existsSync(target)?fs.readFileSync(target):null;
    assert.throws(()=>fs.writeFileSync(path.join(root,'dependent.txt'),'sentinel'),e=>e===error);
    assert.throws(()=>fs.writeFileSync(target,input),e=>e===error);
    assert.throws(()=>adapter.rethrow(),e=>e===error);
    assert(!fs.existsSync(path.join(root,'dependent.txt')));
    if(before)assert.deepEqual(fs.readFileSync(target),before);
  }
  assert(calls.length<=2 && calls.every(([level,strategy])=>level===9 && [3,0].includes(strategy)));
  if(mutant)assert(changed,'mutant must apply');
  console.log(JSON.stringify({mode,pass:true,inputBytes:input.length,calls,message:error?.message,
    receipt, pixelSHA256:crypto.createHash('sha256').update(pixels).digest('hex')}));
  process.exit(0);
}
const root=fs.mkdtempSync(path.join(process.env.TMPDIR||'/tmp','single-frame-profile-'));
const outcomes=[];
try {
  for (const invalid of ['', '2097153', '__proto__', 'single-frame ']) {
    const receipt=path.join(root,'invalid-receipt');
    const p=spawnSync(process.execPath,['--max-old-space-size=256','-e','require(process.argv[1])',adapterFile],
      {encoding:'utf8',timeout:10000,maxBuffer:8192,env:{...process.env,
        ENIGMA_TERMINAL_CAPTURE_INSTALL:'1',ENIGMA_LOSSLESS_CAPTURE:'1',
        ENIGMA_CAPTURE_PROFILE:invalid,ENIGMA_TERMINAL_RECEIPT:receipt}});
    assert.equal(p.status,1);assert.match(p.stderr,/capture profile/);assert(!fs.existsSync(receipt));
  }
  let n=0;
  function run(mode,mutant='') {
    const p=spawnSync(process.execPath,['--max-old-space-size=256',__filename,'child',path.join(root,String(n++)),mode,mutant],
      {encoding:'utf8',timeout:10000,maxBuffer:16384});
    if(mutant) {assert.equal(p.status,1,p.stderr);assert.match(p.stderr,/AssertionError/);outcomes.push({mode,mutant,rejected:true});}
    else {assert.equal(p.status,0,p.stderr);outcomes.push(JSON.parse(p.stdout));}
  }
  for(const mode of ['success','default','frames','cumulative','dimensions','malformed','crc','data','writer','pixels'])run(mode);
  for(const [mode,mutant] of [['success','profile'],['frames','frame'],['cumulative','cumulative'],['pixels','pixels']])run(mode,mutant);
  console.log(JSON.stringify({pass:true,actualCompileAndWriter:true,profileSelectionAllowlisted:true,outcomes}));
} finally {fs.rmSync(root,{recursive:true,force:true});}

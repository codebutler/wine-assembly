'use strict';
// Preload BEFORE enigma-quiet-filesystem.cjs, then the original capture.cjs.
// Disabled is inert. Capture profiles are explicit, named and bounded.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Module = require('node:module');
const assert = require('node:assert/strict');
const pins = Object.freeze({
  runner: '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809',
  quietRunner: '343f7572511b0de8bf79f3a9415d68e4bc6577490cc3bf71f1e8c066623477fb',
  capture: '6d64a146f2daf8b598dbf13e3c13f890dbc783d8f5286aacba6d343758d22079',
  supervisor: '73be15954cedc19340779ff6bda2397cb94927ca702d2baebdccd5e763cf7b73',
});
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const call = `require(${JSON.stringify(__filename)})`;
const anchors = Object.freeze({
  png: '        } catch (e) {\n          logs.push(`[input] png FAILED',
  batch: '    } catch (e) {\n      flushLogs();\n      console.log(`\\n*** CRASH at batch',
  capture: "  assert(result.length<=131072,'capture byte limit');",
  supervisorHelper: 'H=pathlib.Path(__file__).parent',
  supervisorLoop: " while p.poll() is None:\n  if time.monotonic()-start>60:",
  supervisorFinal: " log.close();(E/'terminal.json')",
  supervisorExit: " log.close();(E/'terminal.json').write_text(json.dumps(receipt,indent=2));print(json.dumps(receipt))\n",
});
function once(source, anchor, replacement) {
  assert.equal(source.split(anchor).length - 1, 1, 'terminal capture anchor missing/ambiguous');
  return source.replace(anchor, replacement);
}
function transformRunner(source) {
  assert([pins.runner, pins.quietRunner].includes(sha256(source)), 'terminal capture runner hash');
  source = once(source, anchors.png, anchors.png.replace('          logs.push', `          ${call}.rethrow();\n          logs.push`));
  return once(source, anchors.batch, anchors.batch.replace('      flushLogs();', `      ${call}.rethrow();\n      flushLogs();`));
}
function transformCapture(source) {
  assert.equal(sha256(source), pins.capture, 'terminal capture preload hash');
  return once(source, anchors.capture,
    `  try { ${anchors.capture.trim()} } catch (error) { ${call}.reject(error); }`);
}
// Explicit opt-in for the pinned real capture source. Default transform and all
// original receipt/supervisor identities remain unchanged.
function transformLosslessCapture(source, profile = 'default') {
  const limits = require(path.join(path.dirname(__filename), 'lossless-capture-png.cjs')).profileLimits(profile);
  assert.equal(sha256(source), pins.capture, 'terminal capture preload hash');
  const start = source.indexOf('function encode(buf) {');
  const end = source.indexOf('\nmodule.exports={encode};', start);
  assert(start >= 0 && end > start, 'lossless capture encode anchors');
  const encoder = JSON.stringify(path.join(__dirname, 'lossless-capture-png.cjs'));
  source = source.slice(0, start) + `function encode(buf) {
  ${call}.rethrow();
  try { return require(${encoder}).encode(PNG, buf, ${JSON.stringify(profile)}); }
  catch (error) { ${call}.reject(error); }
}` + source.slice(end);
  if (profile !== 'default') {
    source = once(source, "assert(++frames<=3,'capture frame limit')",
      `assert(++frames<=${limits.maxFrames},'capture frame limit')`);
    source = once(source, "assert(total<=393216,'capture cumulative byte limit')",
      `assert(total<=${limits.cumulativeBytes},'capture cumulative byte limit')`);
  }
  // Latch frame/cumulative/writer failures too, before a later intercepted write.
  source = once(source, '    if(typeof file', `    ${call}.rethrow();\n    try {\n    if(typeof file`);
  return once(source, '    return write.call(this,file,data,...args);',
    `    return write.call(this,file,data,...args);\n    } catch (error) { ${call}.reject(error); }`);
}
function transformSupervisor(source) {
  assert.equal(sha256(source), pins.supervisor, 'terminal capture supervisor hash');
  // Validate before spawning. The only larger file allowance is the already
  // accepted explicit PNG profile; retained output has its own pipe boundary.
  const profiles = Object.fromEntries(['default', 'single-frame'].map(name =>
    [name, require(path.join(path.dirname(__filename), 'lossless-capture-png.cjs')).profileLimits(name).maxBytes]));
  const transport = fs.readFileSync(path.join(path.dirname(__filename), 'enigma-supervisor-output.py'), 'utf8');
  source = once(source, 'resource.setrlimit(resource.RLIMIT_FSIZE,(131072,131072))',
    'resource.setrlimit(resource.RLIMIT_FSIZE,(artifact_file_limit,artifact_file_limit))');
  source = once(source, 'deadline=time.monotonic()+5\n while time.monotonic()<deadline:',
    'deadline=time.monotonic()+1\n while time.monotonic()<deadline:');
  source = once(source, 'stdout=log,stderr=log,start_new_session=True',
    'stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True');
  source = once(source, "start=time.monotonic()\n(E/'command.json')",
    "start=time.monotonic();output=RetainedOutput(p.stdout,log)\n(E/'command.json')");
  source = once(source, "  n=(E/'output.log').stat().st_size\n  if n>=131072:why='output-guard';break\n  with open(E/'output.log','rb') as f:f.seek(offset);part=f.read(8192);offset+=len(part)",
    "  part=output.drain()\n  if output.capped:why='output-guard';break");
  // Drain after stop/reap too: poll() may observe exit before any loop turn.
  source = once(source, " receipt=stop(p);receipt.update(reason=why,",
    " receipt=stop(p)\n try:\n  output.drain()\n  if output.capped and why=='natural':why='output-guard'\n  if output.fault and why=='natural':why='first-observable-fault'\n finally:output.close()\n receipt.update(reason=why,");
  const helper = `def terminal_capture():
 name=os.environ.get('ENIGMA_TERMINAL_RECEIPT')
 if not name or not os.path.exists(name):return None
 with open(name,'rb') as f:data=f.read(1025)
 assert len(data)<=1024,'terminal capture receipt size'
 record=json.loads(data)
 assert record.get('version')==1 and record.get('terminal') is True
 assert record.get('reason')=='capture-byte-limit' and record.get('artifactAccepted') is False
 assert record.get('runnerSHA256')=='${pins.runner}'
 assert record.get('captureSHA256')=='${pins.capture}'
 assert record.get('code')=='ERR_ASSERTION'
 assert record.get('profile') in (None,'default','single-frame')
 if record.get('profile')=='single-frame':
  assert record.get('message') in ('capture byte limit','capture frame limit','capture cumulative byte limit')
 else:
  assert record.get('message')=='capture byte limit'
 return record
`;
  source = once(source, anchors.supervisorHelper, helper + transport + '\n' +
    `artifact_profiles=${JSON.stringify(profiles)}\n` +
    "artifact_profile=os.environ.get('ENIGMA_CAPTURE_PROFILE','default')\n" +
    "assert artifact_profile in artifact_profiles,'capture profile'\n" +
    "artifact_file_limit=artifact_profiles[artifact_profile]\n" + anchors.supervisorHelper);
  source = once(source, anchors.supervisorLoop,
    " while p.poll() is None:\n  if terminal_capture() is not None:why='capture-byte-limit';break\n  if time.monotonic()-start>60:");
  // Also inspect after natural child exit: a fast rejection can beat the poll.
  source = once(source, anchors.supervisorFinal,
    " capture_terminal=terminal_capture()\n if capture_terminal is not None:receipt.update(reason='capture-byte-limit',captureTerminal=capture_terminal)\n log.close();(E/'terminal.json')");
  // Exit only after normal finalization has stopped/reaped the child, closed
  // the log and published the receipt. Keep this OUTSIDE finally so an earlier
  // exception (including cleanup/publication failure) retains its own failure.
  return once(source, anchors.supervisorExit,
    anchors.supervisorExit + "if capture_terminal is not None:raise SystemExit(1)\n" +
    "if capture_terminal is None and (why!='natural' or p.returncode):raise SystemExit(1)\n");
}
let terminal = null;
let receiptPath = null;
let selectedProfile = 'default';
// Capture the receipt primitives before capture.cjs installs its PNG writer.
const io = Object.fromEntries(['openSync', 'writeSync', 'fsyncSync', 'closeSync', 'linkSync', 'unlinkSync'].map(k => [k, fs[k].bind(fs)]));
function reject(error) {
  if (!terminal) {
    terminal = error; // identity, not message/regex classification
    try {
      assert(receiptPath, 'terminal capture receipt is not configured');
      const diagnostic = error.captureDiagnostic;
      const metadata = selectedProfile === 'single-frame' ? { profile: selectedProfile } : {};
      if (diagnostic && ['default', 'single-frame'].includes(diagnostic.profile) &&
          Array.isArray(diagnostic.candidateBytes) && diagnostic.candidateBytes.length <= 2 &&
          diagnostic.candidateBytes.every(n => Number.isSafeInteger(n) && n >= 0 && n <= 2097152)) {
        metadata.encoding = { profile: diagnostic.profile, candidateBytes: diagnostic.candidateBytes };
      }
      const record = JSON.stringify({ ...metadata, version: 1, terminal: true, reason: 'capture-byte-limit',
        runnerSHA256: pins.runner, captureSHA256: pins.capture,
        name: String(error.name).slice(0, 80), code: String(error.code).slice(0, 80),
        message: String(error.message).slice(0, 256), artifactAccepted: false }) + '\n';
      const pending = receiptPath + '.pending';
      const fd = io.openSync(pending, 'wx', 0o600);
      try {
        const bytes = Buffer.from(record);
        let offset = 0;
        while (offset < bytes.length) {
          const n = io.writeSync(fd, bytes, offset, bytes.length - offset);
          assert(n > 0, 'terminal receipt short write');
          offset += n;
        }
        io.fsyncSync(fd);
      } finally { io.closeSync(fd); }
      // Publish the complete, fsynced inode without replacing any prior receipt.
      io.linkSync(pending, receiptPath);
      io.unlinkSync(pending);
      const dir = io.openSync(path.dirname(receiptPath), 'r');
      try { io.fsyncSync(dir); } finally { io.closeSync(dir); }
    } catch (receiptError) {
      // A failed receipt is still fatal; never resume or replace the denial.
      Object.defineProperty(error, 'terminalReceiptError', { value: receiptError });
    }
  }
  throw terminal;
}
function rethrow() { if (terminal) throw terminal; }
function install(root, capture, receipt, lossless = false, profile = 'default') {
  require(path.join(path.dirname(__filename), 'lossless-capture-png.cjs')).profileLimits(profile);
  assert(profile === 'default' || lossless === true, 'capture profile requires lossless capture');
  for (const value of [root, capture, receipt]) assert(value && path.isAbsolute(value), 'terminal capture absolute paths required');
  root = fs.realpathSync(root);
  capture = fs.realpathSync(capture);
  const runner = path.join(root, 'test/run.js');
  assert.equal(sha256(fs.readFileSync(runner)), pins.runner, 'terminal capture original runner hash');
  assert.equal(sha256(fs.readFileSync(capture)), pins.capture, 'terminal capture original preload hash');
  assert(!require.cache[runner] && !require.cache[capture], 'terminal capture must precede runner and capture loading');
  assert(!fs.existsSync(receipt), 'terminal capture receipt must be fresh');
  assert(!fs.existsSync(receipt + '.pending'), 'terminal capture pending receipt must be fresh');
  fs.realpathSync(path.dirname(receipt));
  receiptPath = receipt;
  selectedProfile = profile;
  const original = Module.prototype._compile;
  Module.prototype._compile = function(source, file) {
    if (file === runner) source = transformRunner(source);
    if (file === capture) source = lossless ? transformLosslessCapture(source, profile) : transformCapture(source);
    return original.call(this, source, file);
  };
}
module.exports = { pins, sha256, anchors, once, transformRunner, transformCapture, transformLosslessCapture, transformSupervisor, reject, rethrow, install };
if (process.env.ENIGMA_TERMINAL_CAPTURE_INSTALL === '1') {
  install(process.env.ENIGMA_RUNNER_ROOT, process.env.ENIGMA_CAPTURE_PATH, process.env.ENIGMA_TERMINAL_RECEIPT,
    process.env.ENIGMA_LOSSLESS_CAPTURE === '1',
    process.env.ENIGMA_CAPTURE_PROFILE === undefined ? 'default' : process.env.ENIGMA_CAPTURE_PROFILE);
}

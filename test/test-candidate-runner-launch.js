const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '..');
const filename = path.join(__dirname, 'test-cli-candidate-corpus.js');
const localRequire = createRequire(filename);
const calls = [];
let childResult = { status: 0, stdout: 'bounded smoke', stderr: '' };
const moduleObject = { exports: {} };
function requireStub(name) {
  if (name === 'child_process') return { spawnSync(command, args, options) {
    calls.push({ command, args, options });
    return childResult;
  } };
  return localRequire(name);
}
vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
  require: requireStub, module: moduleObject, __dirname, process, console, Buffer,
}, { filename });
const { runCandidate } = moduleObject.exports;
const base = path.join(root, 'test/binaries/candidates');
fs.mkdirSync(base, { recursive: true });
const fixture = fs.mkdtempSync(path.join(base, 'runner-contract-'));
const candidate = { id: path.basename(fixture), cli: {
  exeGuestPath: 'C:/SILVER/silver.exe', cwd: 'C:/SILVER', vfsTrees: ['game'],
  zipMounts: [{ file: 'source.zip', root: 'D:/SILVER/' }],
} };
try {
  fs.mkdirSync(path.join(fixture, 'game'));
  fs.writeFileSync(path.join(fixture, 'source.zip'), 'mount contract fixture');
  const result = runCandidate(candidate, '/original/silver.exe', '/snapshot.wasm');
  assert.equal(result.status, 'READY');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.killSignal, 'SIGKILL',
    'the smoke deadline must terminate a CPU-bound runner with a JS signal handler');
  const started = Date.now();
  const timedOut = require('child_process').spawnSync(process.execPath, ['-e',
    "process.on('SIGTERM', () => {}); process.stdout.write('armed'); while (true) {}"],
  { ...calls[0].options, timeout: 1000 });
  assert.equal(timedOut.stdout, 'armed', 'negative fixture entered its CPU loop');
  assert.equal(timedOut.error.code, 'ETIMEDOUT');
  assert.equal(timedOut.signal, 'SIGKILL');
  assert(Date.now() - started < 5000, 'termination must finish promptly');
  const args = calls[0].args;
  for (const value of ['--exe=/original/silver.exe', '--wasm=/snapshot.wasm',
    '--exe-guest-path=C:\\SILVER\\silver.exe', '--cwd=C:\\SILVER\\',
    `--vfs-tree=${fixture}/game`, `--zip=${fixture}/source.zip`, '--zip-root=D:\\SILVER\\']) {
    assert(args.includes(value), value);
  }
  assert.equal(args.filter(value => value.startsWith('--wasm=')).length, 1);
  fs.unlinkSync(path.join(fixture, 'source.zip'));
  assert.equal(runCandidate(candidate, '/original/silver.exe', '/snapshot.wasm').status, 'BLOCKED');
  assert.equal(calls.length, 1, 'missing media must not spawn');
  candidate.cli.zipMounts.push({ file: 'other.zip', root: 'E:/OTHER/' });
  assert.equal(runCandidate(candidate, '/original/silver.exe', '/snapshot.wasm').status, 'HARNESS');
  assert.equal(calls.length, 1, 'distinct roots must not spawn');
  candidate.cli = { vfsTrees: ['not-directory'] };
  fs.writeFileSync(path.join(fixture, 'not-directory'), 'x');
  assert.equal(runCandidate(candidate, '/original/silver.exe', '/snapshot.wasm').status, 'BLOCKED');
  assert.equal(calls.length, 1);
  console.log('PASS actual runner launch arguments, missing media, distinct roots, directory validation');
  candidate.cli = {};
  childResult = timedOut;
  const timeoutVerdict = runCandidate(candidate, '/original/silver.exe', '/snapshot.wasm');
  assert.equal(timeoutVerdict.status, 'BLOCKED');
  assert.equal(timeoutVerdict.reason, 'timeout');
  console.log('PASS CPU-bound child hard deadline; timeout remains BLOCKED');
  const warning = '[dll] comctl32.dll is loaded as a real PE but is not on disk (comctl32.dll); ' +
    'its imports fall to WAT stubs and an ordinal import from it crashes as "<ord>". ' +
    'test/binaries/dlls is gitignored: copy it into a fresh worktree.';
  childResult = { status: 0, stdout: 'Stats: 68196 API calls, 3000 batches', stderr: warning };
  assert.equal(runCandidate(candidate, '/original/hock.exe', '/snapshot.wasm').status, 'READY',
    'a conditional DLL warning is not an observed guest crash');
  for (const marker of ['*** CRASH at batch 7: unreachable', 'STUCK at 0x404340',
    'RuntimeError: unreachable', 'LinkError: incompatible import',
    'UNIMPLEMENTED API: MissingFunction', 'failed to load required.dll']) {
    childResult = { status: 0, stdout: marker, stderr: warning };
    assert.equal(runCandidate(candidate, '/original/hock.exe', '/snapshot.wasm').status, 'BLOCKED', marker);
  }
  for (const result of [{ status: 1 }, { status: null, signal: 'SIGKILL' }, timedOut]) {
    childResult = { stdout: '', stderr: warning, ...result };
    assert.equal(runCandidate(candidate, '/original/hock.exe', '/snapshot.wasm').status, 'BLOCKED');
  }
  console.log('PASS conditional warning vs genuine crash/stuck/error/missing-DLL/exit/signal/timeout controls');
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}

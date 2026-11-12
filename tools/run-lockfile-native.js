'use strict';
// --prepare is read-only apart from its explicit manifest. --execute requires
// a coordinator grant and exact manifest digest; never starts an original game.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const ROOT = path.resolve(__dirname, '..');
const ADMIT = 2852126720, FLOOR = 2214592512, LOG = 2 * 1024 * 1024;
const TOTAL = 32 * 1024 * 1024;
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const git = (root, ...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
const free = root => { const s = fs.statfsSync(root); return s.bavail * s.bsize; };
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const sourceName = name => /^(src|lib|tools|test|fonts|packages)\//.test(name) || !name.includes('/') ||
  /^docs\/dos-corpus\/live\/toyvm(?:-jit)?-bundle\.js$/.test(name);
function sourcePins(root) {
  return git(root, 'ls-files', '-z').split('\0').filter(Boolean).filter(sourceName)
    .filter(name => fs.existsSync(path.join(root, name)))
    .map(name => ({ file: path.join(root, name), sha256: hash(path.join(root, name)) }));
}
function verifyPins(pins) {
  for (const pin of pins) {
    if (pin.absent) assert(!fs.existsSync(pin.file), 'new formerly absent file: ' + pin.file);
    else assert.equal(hash(pin.file), pin.sha256, 'changed pin: ' + pin.file);
  }
}
function packagePins(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const file = path.join(dir, item.name);
    if (item.isDirectory()) return packagePins(file);
    assert(item.isFile(), 'dependency must be regular file: ' + file);
    return [{ file, sha256: hash(file) }];
  });
}
function outputBytes(dir) {
  if (!fs.existsSync(dir)) return 0;
  let bytes = 0;
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, item.name);
    if (item.isDirectory()) bytes += outputBytes(p);
    else if (item.isFile()) bytes += fs.statSync(p).size;
    else throw Error('unexpected output link: ' + p);
  }
  return bytes;
}
const jobs = [
  { name: 'normal-build', command: 'bash', args: ['tools/build.sh'], seconds: 120 },
  { name: 'handlers-public-tail', command: process.execPath, args: ['test/test-lockfile-handlers.js'], seconds: 60 },
  { name: 'handlers-public-compat', command: process.execPath, args: ['test/test-lockfile-handlers.js', '--compat'], seconds: 60 },
  { name: 'worker-tail', command: process.execPath, args: ['test/test-lockfile-worker.js'], seconds: 45 },
  { name: 'worker-compat', command: process.execPath, args: ['test/test-lockfile-worker.js', '--compat'], seconds: 45 },
];
const aggregateBytes = (manifest, out) => [out, path.join(ROOT, 'build'), ...(manifest.outputRoots || [])]
  .reduce((sum, dir) => sum + outputBytes(dir), 0);
let activeKill = null, interrupted = null;
function groupAbsent(pid) {
  try { process.kill(-pid, 0); return false; }
  catch (error) { if (error.code === 'ESRCH') return true; throw error; }
}
async function runJob(job, manifest, out) {
  assert(!interrupted, 'controller interrupted: ' + interrupted);
  assert(free(ROOT) > ADMIT, 'fresh per-job disk admission refused');
  verifyPins(manifest.pins);
  assert.equal(git(ROOT, 'rev-parse', 'HEAD'), manifest.commit);
  assert.equal(git(ROOT, 'status', '--porcelain'), '', 'candidate source/index must remain clean');
  assert(aggregateBytes(manifest, out) < TOTAL, 'aggregate output admission');
  const fd = fs.openSync(path.join(out, job.name + '.log'), 'wx');
  let child, reason = null, logged = 0, minFree = free(ROOT), settled = false;
  const started = Date.now();
  const kill = why => {
    reason ||= why;
    if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch (e) { if (e.code !== 'ESRCH') throw e; } }
  };
  activeKill = kill;
  const saveOutput = chunk => {
    const remaining = Math.max(0, LOG - logged);
    if (remaining) fs.writeSync(fd, chunk.subarray(0, remaining));
    logged += chunk.length;
    if (logged > LOG) kill('log cap');
  };
  let status;
  try {
    child = cp.spawn(job.command, job.args, { cwd: ROOT, detached: true,
      env: { ...process.env, NODE_PATH: manifest.nodePath }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', saveOutput); child.stderr.on('data', saveOutput);
    const timer = setTimeout(() => kill('hard deadline'), job.seconds * 1000);
    const monitor = setInterval(() => {
      try {
        minFree = Math.min(minFree, free(ROOT));
        if (minFree <= FLOOR) kill('disk floor');
        if (aggregateBytes(manifest, out) > TOTAL) kill('aggregate output cap');
      } catch (e) { kill('monitor failure: ' + e.message); }
    }, 200);
    try {
      status = await new Promise(resolve => {
        child.on('error', error => resolve({ error: error.message }));
        child.on('close', (code, signal) => resolve({ code, signal }));
      });
      settled = true;
    } finally { clearTimeout(timer); clearInterval(monitor); }
    if (child.pid && !groupAbsent(child.pid)) {
      kill('surviving process group');
      for (let n = 0; n < 20 && !groupAbsent(child.pid); n++) await new Promise(r => setTimeout(r, 50));
    }
    const absent = !child.pid || groupAbsent(child.pid);
    const result = { ...status, reason, pid: child.pid, groupAbsent: absent,
      elapsedMs: Date.now() - started, minFree, logBytes: Math.min(logged, LOG) };
    write(path.join(out, job.name + '.json'), result);
    verifyPins(manifest.pins);
    assert(absent && !reason && status.code === 0, JSON.stringify(result));
    return result;
  } finally {
    if (!settled) kill('controller interruption');
    activeKill = null;
    fs.closeSync(fd);
  }
}
async function main() {
  const option = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
  const file = option('manifest'); assert(file && path.isAbsolute(file));
  if (process.argv.includes('--prepare')) {
    assert.equal(git(ROOT, 'status', '--porcelain'), '', 'commit preparation first');
    const roots = [ROOT, '/home/user/wine-assembly', '/tmp/wa-recovery-20261014'];
    const pins = roots.flatMap(sourcePins);
    for (const root of roots.slice(1)) for (const name of ['wine-assembly.wasm', 'wine-assembly.compat.wasm']) {
      const file = path.join(root, 'build', name);
      pins.push(fs.existsSync(file) ? { file, sha256: hash(file) } : { file, absent: true });
    }
    const original = '/home/user/wine-assembly/scratch/runs/20261019-madbomber-dbcs-retry/launch-manifest.json';
    pins.push({ file: original, sha256: hash(original) });
    for (const item of JSON.parse(fs.readFileSync(original)).files) {
      const file = '/home/user/wine-assembly/scratch/runs/20261018-madbomber-source/original/madbomber-0.2.5/' + item.path;
      assert.equal(fs.statSync(file).size, item.bytes); assert.equal(hash(file), item.sha256);
      pins.push({ file, sha256: item.sha256 });
    }
    // Record missing tracked inputs instead of silently borrowing another tree.
    const required = ['.gitignore', 'index.html', 'fonts/substitutions.json', 'fonts/Terminal.fon',
      'package.json', 'package-lock.json', 'docs/dos-corpus/live/toyvm-bundle.js',
      'docs/dos-corpus/live/toyvm-jit-bundle.js'];
    const missing = required.filter(name => !fs.existsSync(path.join(ROOT, name)));
    const nodePath = '/tmp/wa-recovery-20261014/node_modules';
    const png = require.resolve('pngjs', { paths: [nodePath] });
    pins.push(...packagePins(path.dirname(path.dirname(png))));
    write(file, { root: ROOT, commit: git(ROOT, 'rev-parse', 'HEAD'), pins, missing,
      nodePath, required, jobs, limits: { ADMIT, FLOOR, LOG, TOTAL }, preparedAt: new Date().toISOString() });
    console.log(JSON.stringify({ manifest: file, sha256: hash(file), pins: pins.length, missing }));
    return;
  }
  assert(process.argv.includes('--execute'));
  assert.equal(process.env.WA_LOCKFILE_RUNTIME_GRANTED, '1', 'coordinator sole-runtime grant required');
  assert.equal(hash(file), process.env.WA_LOCKFILE_MANIFEST_SHA256, 'reviewed manifest digest');
  const manifest = JSON.parse(fs.readFileSync(file));
  assert.equal(manifest.root, ROOT); assert.equal(git(ROOT, 'rev-parse', 'HEAD'), manifest.commit);
  assert.deepEqual(manifest.jobs, jobs); assert.deepEqual(manifest.limits, { ADMIT, FLOOR, LOG, TOTAL });
  assert.deepEqual(manifest.missing, [], 'resolve sparse inputs and prepare a fresh manifest');
  for (const name of manifest.required) assert(fs.existsSync(path.join(ROOT, name)), name);
  verifyPins(manifest.pins);
  assert(free(ROOT) > ADMIT, 'fresh initial disk admission refused');
  assert(!fs.existsSync(path.join(ROOT, 'build')), 'fresh isolated build destination required');
  const out = option('out'); assert(out && path.isAbsolute(out));
  assert(!fs.existsSync(out), 'new evidence destination required');
  // Root coordinates this lease with every local native lane. A grant alone
  // does not authorize stealing a lease or terminating unrelated processes.
  const lease = '/tmp/wine-assembly-local-runtime.lock';
  fs.mkdirSync(lease);
  try {
    fs.writeFileSync(path.join(lease, 'owner.json'), JSON.stringify({ pid: process.pid, root: ROOT, manifest: file }));
    fs.mkdirSync(out);
    fs.copyFileSync(file, path.join(out, 'manifest.json'));
    const results = [];
    try {
      for (const job of jobs) {
        results.push(await runJob(job, manifest, out));
        if (job.name === 'normal-build') {
          const modules = ['wine-assembly.wasm', 'wine-assembly.compat.wasm'].map(name => {
            const file = path.join(ROOT, 'build', name); return { file, sha256: hash(file) };
          });
          write(path.join(out, 'built-module-pins.json'), modules);
          manifest.pins.push(...modules);
        }
      }
      const modules = ['wine-assembly.wasm', 'wine-assembly.compat.wasm'].map(name => {
        const file = path.join(ROOT, 'build', name); return { file, sha256: hash(file), bytes: fs.statSync(file).size };
      });
      verifyPins(manifest.pins);
      write(path.join(out, 'result.json'), { passed: true, results, modules, commit: manifest.commit });
    } catch (error) {
      write(path.join(out, 'result.json'), { passed: false, results, error: error.stack }); throw error;
    }
  } finally {
    fs.unlinkSync(path.join(lease, 'owner.json')); fs.rmdirSync(lease);
  }
}
module.exports = { ADMIT, FLOOR, LOG, TOTAL, jobs, sourceName, sourcePins, verifyPins,
  outputBytes, aggregateBytes, groupAbsent, runJob,
  interrupt: signal => { interrupted = signal; activeKill?.('controller received ' + signal); } };
if (require.main === module) {
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    interrupted = signal; activeKill?.('controller received ' + signal);
  });
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

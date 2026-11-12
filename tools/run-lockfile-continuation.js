'use strict';
// Remaining instrumented tests plus exact-binary smoke, without rebuilding.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const control = require('./run-lockfile-native');
const root = path.resolve(__dirname, '..');
const builtCommit = 'b130b94452212a0854fe764440128f42fe9395d5';
const prior = path.join(root, 'scratch/runs/20261019-lockfile-native-v2');
const outputRoots = [path.join(root, 'scratch/runs/20261019-lockfile-native'), prior];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim();
const option = name => process.argv.find(a => a.startsWith('--' + name + '='))?.slice(name.length + 3);
const save = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const modules = [
  { file: path.join(root, 'build/wine-assembly.wasm'), sha256: '97c67d7abbff795cab66c547fd637b6e7f2081a5513dc9cd860738b6bea33985' },
  { file: path.join(root, 'build/wine-assembly.compat.wasm'), sha256: 'b3a9e9513d56932ee7217154789774d92c289f50adc78ef1dbdfa15c8a164fb1' },
];
const jobs = [...control.jobs.slice(1), ...modules.map((pin, i) => ({
  name: 'production-public-' + (i ? 'compat' : 'tail'), command: process.execPath,
  args: ['test/test-lockfile-public-binary.js', '--wasm=' + pin.file, '--sha256=' + pin.sha256], seconds: 30,
}))];
function checkSourceDelta() {
  const allowed = new Set(['docs/re-notes/madbomber-lockfile-design.md', 'tools/run-lockfile-native.js',
    'tools/run-lockfile-continuation.js', 'tools/test-lockfile-native-control.js', 'test/test-lockfile-public-binary.js']);
  const delta = git('diff', '--name-only', builtCommit, 'HEAD').split('\n').filter(Boolean);
  assert.deepEqual(delta.filter(name => !allowed.has(name)), [], 'normal-build source must remain identical');
  return delta;
}
async function main() {
  const file = option('manifest'); assert(file && path.isAbsolute(file));
  if (process.argv.includes('--prepare')) {
    assert.equal(git('status', '--porcelain'), '');
    control.verifyPins(modules);
    const old = JSON.parse(fs.readFileSync(path.join(prior, 'manifest.json')));
    const roots = [root, '/home/user/wine-assembly', '/tmp/wa-recovery-20261014'];
    const refresh = new Set([path.join(root, 'tools/run-lockfile-native.js'),
      path.join(root, 'tools/test-lockfile-native-control.js'), '/home/user/wine-assembly/TODOS.md']);
    const additions = new Set([path.join(root, 'tools/run-lockfile-continuation.js'),
      path.join(root, 'test/test-lockfile-public-binary.js')]);
    // Preserve every other old hash; only reviewed qualification files and
    // the coordinator's ledger update may change from the built snapshot.
    control.verifyPins(old.pins.filter(pin => !refresh.has(pin.file)));
    const pins = old.pins.map(pin => refresh.has(pin.file) ? { file: pin.file, sha256: sha(pin.file) } : pin);
    const existing = new Set(old.pins.map(pin => pin.file));
    for (const pin of roots.flatMap(control.sourcePins)) if (!existing.has(pin.file)) {
      assert(additions.has(pin.file), 'unexpected new source pin: ' + pin.file); pins.push(pin);
    }
    pins.push(...modules);
    for (const dir of outputRoots) for (const name of fs.readdirSync(dir)) {
      const file = path.join(dir, name); assert(fs.statSync(file).isFile()); pins.push({ file, sha256: sha(file) });
    }
    control.verifyPins(pins);
    save(file, { ...old, commit: git('rev-parse', 'HEAD'), pins, jobs, outputRoots,
      builtCommit, modules, sourceDelta: checkSourceDelta(), preparedAt: new Date().toISOString() });
    console.log(JSON.stringify({ manifest: file, sha256: sha(file), pins: pins.length,
      aggregateExistingBytes: control.aggregateBytes({ outputRoots }, path.dirname(file)), jobs: jobs.map(j => j.name) }));
    return;
  }
  assert(process.argv.includes('--execute')); assert.equal(process.env.WA_LOCKFILE_RUNTIME_GRANTED, '1');
  assert.equal(sha(file), process.env.WA_LOCKFILE_MANIFEST_SHA256);
  const manifest = JSON.parse(fs.readFileSync(file));
  assert.equal(manifest.commit, git('rev-parse', 'HEAD')); assert.equal(manifest.root, root);
  assert.deepEqual(manifest.jobs, jobs); assert.deepEqual(manifest.modules, modules);
  assert.deepEqual(manifest.outputRoots, outputRoots); assert.deepEqual(manifest.sourceDelta, checkSourceDelta());
  assert.deepEqual(manifest.limits, { ADMIT: control.ADMIT, FLOOR: control.FLOOR, LOG: control.LOG, TOTAL: control.TOTAL });
  control.verifyPins(manifest.pins);
  const stat = fs.statfsSync(root); assert(stat.bavail * stat.bsize > control.ADMIT, 'fresh initial disk admission refused');
  const out = option('out'); assert(out && path.isAbsolute(out) && !fs.existsSync(out));
  const lease = '/tmp/wine-assembly-local-runtime.lock'; fs.mkdirSync(lease);
  try {
    save(path.join(lease, 'owner.json'), { pid: process.pid, root, manifest: file });
    fs.mkdirSync(out); fs.copyFileSync(file, path.join(out, 'manifest.json'));
    const results = [];
    try {
      for (const job of jobs) results.push(await control.runJob(job, manifest, out));
      control.verifyPins(manifest.pins);
      save(path.join(out, 'result.json'), { passed: true, results, modules, commit: manifest.commit, builtCommit });
    } catch (error) {
      save(path.join(out, 'result.json'), { passed: false, results, error: error.stack }); throw error;
    }
  } finally { fs.unlinkSync(path.join(lease, 'owner.json')); fs.rmdirSync(lease); }
}
module.exports = { jobs, modules, checkSourceDelta };
if (require.main === module) {
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => control.interrupt(signal));
  main().catch(error => { console.error(error); process.exitCode = 1; });
}

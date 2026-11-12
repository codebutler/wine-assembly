#!/usr/bin/env node
'use strict';
// Standalone orchestration; copy outside the target checkout if targeting a
// reviewed commit that predates this controller. Runtime grant required.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const cp = require('node:child_process'), assert = require('node:assert/strict');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function validateConfig(config) {
  for (const key of ['checkout', 'output', 'controllerOutput', 'nativeRoot', 'gameRoot', 'regsvr32'])
    assert(path.isAbsolute(config[key] || ''), 'Absolute ' + key + ' required');
  assert(/^[a-f0-9]{40}$/.test(config.commit || ''), 'Exact reviewed commit required');
  assert(/^[a-f0-9]{64}$/.test(config.gameInventorySha256 || ''), 'Pinned game inventory required');
  assert.equal(config.moduleSha256, null, 'Fresh build must derive its module pin; do not supply an old hash');
  for (const target of [config.output, config.controllerOutput]) {
    const relative = path.relative(config.checkout, target);
    assert(relative.startsWith('../') || path.isAbsolute(relative), 'Evidence must be outside checkout');
  }
  assert.notEqual(path.resolve(config.output), path.resolve(config.controllerOutput));
}
function registrationConfig(config, buildResult, wasm) {
  assert.equal(buildResult.status, 0, 'Canonical build failed; registration forbidden');
  assert(!buildResult.signal && !buildResult.error, 'Canonical build interrupted');
  assert(fs.lstatSync(wasm).isFile(), 'Fresh canonical module must be a regular file');
  assert.deepEqual(fs.readFileSync(wasm).subarray(0, 8), Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]), 'Missing WASM module header');
  const { controllerOutput, ...registration } = config;
  return { ...registration, moduleSha256: sha(wasm) };
}
function run(config) {
  validateConfig(config);
  const { checkout, controllerOutput: output } = config;
  assert.equal(fs.realpathSync(checkout), path.resolve(checkout), 'Use an owned real checkout');
  assert(!fs.existsSync(config.output), 'Registration output must be fresh');
  const git = args => cp.execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8', timeout: 10000 });
  assert.equal(git(['rev-parse', 'HEAD']).trim(), config.commit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=normal']).trim(), '');
  const sourcePaths = git(['ls-files', '-z']).split('\0').filter(Boolean);
  const sources = () => sourcePaths.map(name => {
    const p = path.join(checkout, name), stat = fs.lstatSync(p);
    assert(stat.isFile() || stat.isSymbolicLink(), 'Unexpected tracked entry: ' + name);
    return { path: name, sha256: sha(p), ...(stat.isSymbolicLink() ? { link: fs.readlinkSync(p) } : {}) };
  });
  const capacity = fs.statfsSync(path.dirname(output));
  assert(Number(capacity.bavail) * Number(capacity.bsize) >= 2.5 * 1024 ** 3, '2GiB floor plus 512MiB build reserve required');
  fs.mkdirSync(output);
  const save = (name, value) => fs.writeFileSync(path.join(output, name), JSON.stringify(value, null, 2) + '\n');
  const startedAt = new Date().toISOString(), before = sources();
  save('request.json', config); save('source-before.json', before);
  save('controller.json', { sha256: sha(__filename), node: process.version, startedAt });
  const command = (label, args) => {
    save(label + '-args.json', { executable: 'timeout', args, cwd: checkout });
    const fd = fs.openSync(path.join(output, label + '.log'), 'wx');
    let result;
    try { result = cp.spawnSync('timeout', args, { cwd: checkout, stdio: ['ignore', fd, fd] }); }
    finally { fs.closeSync(fd); }
    const status = { status: result.status, signal: result.signal, error: result.error?.message, finishedAt: new Date().toISOString() };
    save(label + '-status.json', status); return status;
  };
  let complete;
  try {
    // Retain, rather than trust, an older build. A successful build must create
    // a new regular artifact; a stale file cannot silently satisfy the gate.
    const buildDir = path.join(checkout, 'build');
    if (fs.existsSync(buildDir)) assert(fs.lstatSync(buildDir).isDirectory() && fs.realpathSync(buildDir) === buildDir,
      'Build directory must be owned, not a shared symlink');
    const prior = path.join(output, 'prior-build'); fs.mkdirSync(prior);
    for (const name of ['wine-assembly.wasm', 'wine-assembly.compat.wasm', 'combined.wat']) {
      const p = path.join(checkout, 'build', name);
      if (fs.existsSync(p)) {
        assert(fs.lstatSync(p).isFile(), 'Do not move shared/symlink build artifacts');
        fs.renameSync(p, path.join(prior, name));
      }
    }
    const build = command('canonical', ['--signal=TERM', '--kill-after=5s', '240s', 'bash', 'tools/build.sh']);
    const registration = registrationConfig(config, build, path.join(checkout, 'build/wine-assembly.wasm'));
    assert.deepEqual(sources(), before, 'Canonical build changed tracked source');
    assert.equal(git(['status', '--porcelain', '--untracked-files=normal']).trim(), '');
    save('registration-config.json', registration);
    save('build-receipt.json', { commit: config.commit, moduleSha256: registration.moduleSha256, build,
      sourceReceiptSha256: sha(path.join(output, 'source-before.json')), sourceFiles: before.length });
    const result = command('registration', ['--signal=TERM', '--kill-after=5s', '600s', process.execPath,
      path.join(checkout, 'tools/cmr3-register-native.js'), path.join(output, 'registration-config.json')]);
    assert.equal(result.status, 0, 'Registration failed; retain partial evidence and stop');
    assert(!result.signal && !result.error);
    const guestResult = JSON.parse(fs.readFileSync(path.join(config.output, 'result.json')));
    assert.equal(guestResult.success, true); assert.equal(guestResult.steps.length, 9);
    complete = { startedAt, finishedAt: new Date().toISOString(), commit: config.commit,
      moduleSha256: registration.moduleSha256, registrationOutput: config.output, success: true, gameExecuted: false };
  } catch (error) { save('failure.json', { startedAt, error: error.stack }); throw error; }
  finally {
    const after = sources(); save('source-after.json', after);
    assert.deepEqual(after, before); assert.equal(git(['rev-parse', 'HEAD']).trim(), config.commit);
    save('source-postflight.json', { unchanged: true, files: after.length });
  }
  if (complete) save('result.json', complete);
}
if (require.main === module) {
  try { assert.equal(process.argv.length, 3, 'Usage: cmr3-build-register.js CONFIG.json'); run(JSON.parse(fs.readFileSync(process.argv[2]))); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { validateConfig, registrationConfig };

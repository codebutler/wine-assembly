#!/usr/bin/env node
'use strict';
// Source preparation only until a runtime owner grants execution. No build/download.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const cp = require('node:child_process'), assert = require('node:assert/strict');
const plan = require('../docs/cmr3-native-recovery-plan-20261015.json');
const historical = require('../docs/cmr3-historical-receipts-20261015.json');
const { inventory } = require('./cmr3-assemble-original');
const ORDER = ['devenum.dll', 'quartz.dll', 'qedit.dll', 'qasf.dll', 'WMVCORE.DLL', 'WMADMOD.DLL', 'WMVDMOD.DLL', 'qasf.dll', 'MLANG.DLL'];
// Exact authenticated WMVCORE PRXFILE/200/1033 resource; see static review notes.
const WMV_PROFILE = Object.freeze({ path: 'windows/wmsyspr9.prx', bytes: 316640,
  sha256: '95f1edbc3cb9aa70a374a61b43bd16818636b0190aa841504130bb718c39c2c7' });
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function verify(p, expected) {
  assert(fs.lstatSync(p).isFile(), 'Regular file required: ' + p);
  assert.equal(fs.statSync(p).size, expected.bytes, p);
  assert.equal(sha(p), expected.sha256, p);
}
function verifyCommonDirectory(common) {
  if (!fs.existsSync(common)) return;
  assert(fs.lstatSync(common).isDirectory(), 'Common DLL directory must not be a symlink');
  for (const entry of fs.readdirSync(common)) {
    assert.equal(entry, 'SOURCES.md', 'Unexpected common DLL search entry: ' + entry);
    assert(fs.lstatSync(path.join(common, entry)).isFile(), 'Common documentation must be a regular file');
  }
}
function assess(log, status, snapshot, dll, effects = {}) {
  assert.equal(status, 0, 'Host did not finish normally');
  assert(!/UNIMPLEMENTED|\[eip-zero\]|RuntimeError|unreachable|timed? out|time limit|maximum.*seconds|\[CRASH\]/i.test(log), 'Guest failure diagnostic');
  const exits = [...log.matchAll(/\[Exit\] code=(-?\d+)/g)].map(m => Number(m[1]));
  assert.deepEqual(exits, [0], 'Require one successful guest ExitProcess');
  const results = [...log.matchAll(/\[TRACE-AT #[^\]]+\][^\n]*EIP=0x0*401341 EAX=0x([0-9a-f]+)/gi)].map(m => parseInt(m[1], 16));
  assert.deepEqual(results, [0], 'Require one observed DllRegisterServer S_OK');
  assert(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot));
  if (dll.toLowerCase() === 'wmvcore.dll') {
    assert(effects.before, 'WMVCORE requires its prior registry snapshot');
    assert.deepEqual(snapshot, effects.before, 'WMVCORE must leave registry unchanged');
    assert(Array.isArray(effects.files), 'WMVCORE requires captured VFS profile evidence');
    assert.equal(effects.files.length, 1, 'Require exactly one profile output, no missing or duplicate files');
    const file = effects.files[0];
    assert.deepEqual({ ...file, path: file.path.toLowerCase() }, WMV_PROFILE, 'Wrong WMVCORE profile location or bytes');
    return { hresult: '0x00000000', guestExit: 0, registryUnchanged: true, profile: file, entries: Object.keys(snapshot).length };
  }
  const servers = Object.entries(snapshot).filter(([key, value]) => {
    if (!/\\inprocserver32$/i.test(key) || typeof value !== 'string') return false;
    const values = JSON.parse(value).values || {};
    return Object.values(values).some(v => v.type === 1 && typeof v.data === 'string' &&
      v.data.replaceAll('\\', '/').split('/').pop().toLowerCase() === dll.toLowerCase());
  }).map(([key]) => key);
  assert(servers.length, 'No native InprocServer32 registration for ' + dll);
  return { hresult: '0x00000000', guestExit: 0, servers, entries: Object.keys(snapshot).length };
}
function runnerArgs(stage, dll, previous, next, vfsOutput) {
  const args = ['test/run.js', '--exe=' + path.join(stage, 'regsvr32.exe'), '--args=/s ' + dll,
    '--vfs-tree=' + stage, '--dlls=' + ['msvcrt.dll', 'msdmo.dll', 'WMASF.DLL'].map(n => path.join(stage, n)).join(','),
    '--no-build', '--quiet-api', '--max-batches=20000', '--max-seconds=45',
    '--trace-at=0x401341', '--trace-at-limit=2', '--trace-api=LoadLibraryA,LoadLibraryExA,GetProcAddress,ExitProcess',
    '--reg-import=' + previous, '--reg-export=' + next];
  if (dll.toLowerCase() === 'wmvcore.dll') {
    assert(path.isAbsolute(vfsOutput || ''), 'WMVCORE requires a fresh absolute VFS export directory');
    args.push('--save-vfs=' + vfsOutput, '--save-vfs-suffix=.prx');
  }
  return args;
}
function run(config) {
  const { checkout, output, nativeRoot, gameRoot, regsvr32, commit, moduleSha256, gameInventorySha256 } = config;
  for (const p of [checkout, output, nativeRoot, gameRoot, regsvr32]) assert(path.isAbsolute(p || ''), 'Absolute paths required');
  for (const hash of [moduleSha256, gameInventorySha256]) assert(/^[a-f0-9]{64}$/.test(hash || ''), 'Reviewed SHA256 required');
  assert(/^[a-f0-9]{40}$/.test(commit || ''), 'Exact reviewed commit required');
  assert.equal(fs.realpathSync(checkout), path.resolve(__dirname, '..'), 'Run the recipe from its own checkout');
  const git = args => cp.execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8', timeout: 10000 }).trim();
  assert.equal(git(['rev-parse', 'HEAD']), commit);
  assert.equal(git(['status', '--porcelain', '--untracked-files=normal']), '', 'Clean checkout required');
  // Dynamic loader searches here BEFORE the app folder, even with explicit --dlls.
  const common = path.join(checkout, 'test/binaries/dlls');
  verifyCommonDirectory(common);
  const wasm = path.join(checkout, 'build/wine-assembly.wasm');
  assert.equal(sha(wasm), moduleSha256);
  verify(regsvr32, plan.registry.registrationTool);
  assert.deepEqual(inventory(nativeRoot), [...historical.native].sort((a,b) => a.path.localeCompare(b.path)));
  const gameReceipt = path.join(gameRoot, '../game-inventory.json');
  assert.equal(sha(gameReceipt), gameInventorySha256);
  const gameBefore = inventory(gameRoot);
  assert.equal(gameBefore.length, 302);
  assert.deepEqual(gameBefore, JSON.parse(fs.readFileSync(gameReceipt)));
  const capacity = fs.statfsSync(path.dirname(output));
  assert(Number(capacity.bavail) * Number(capacity.bsize) >= 2.5 * 1024 ** 3, '2GiB floor plus 512MiB reserve required');
  fs.mkdirSync(output); // Exclusive fresh output, retained on failure.
  const save = (name, data) => fs.writeFileSync(path.join(output, name), JSON.stringify(data, null, 2) + '\n');
  const start = Date.now(), steps = [];
  let completed;
  save('config.json', config);
  try {
    save('game-before.json', gameBefore); save('native-before.json', inventory(nativeRoot));
    save('pins.json', { commit, moduleSha256, gameInventorySha256, node: process.version, recipe: sha(__filename), runner: sha(path.join(checkout, 'test/run.js')) });
    const stage = path.join(output, 'registration'); fs.mkdirSync(stage);
    for (const r of historical.native) { fs.copyFileSync(path.join(nativeRoot, r.path), path.join(stage, r.path)); verify(path.join(stage, r.path), r); }
    fs.copyFileSync(regsvr32, path.join(stage, 'regsvr32.exe')); verify(path.join(stage, 'regsvr32.exe'), plan.registry.registrationTool);
    let previous = path.join(output, 'seed.json');
    save('seed.json', { 'reg:HKLM\\SOFTWARE\\CODEMASTERS\\Colin McRae Rally 3 Demo': JSON.stringify({ values: { INSTALL_PATH: { type: 1, data: 'C:' }, CD_PATH: { type: 1, data: 'C:' } } }) });
    for (const [index, dll] of ORDER.entries()) {
      assert(Date.now() - start < 570000 - 55000, 'Insufficient remaining overall budget');
      const prefix = String(index + 1).padStart(2, '0') + '-' + dll;
      const next = path.join(output, prefix + '.registry.json');
      const vfsOutput = dll.toLowerCase() === 'wmvcore.dll' ? path.join(output, prefix + '.vfs') : null;
      if (vfsOutput) fs.mkdirSync(vfsOutput);
      const args = runnerArgs(stage, dll, previous, next, vfsOutput);
      save(prefix + '.args.json', { executable: process.execPath, args, cwd: checkout, timeoutMs: 55000 });
      const fd = fs.openSync(path.join(output, prefix + '.log'), 'wx');
      let result;
      try { result = cp.spawnSync(process.execPath, args, { cwd: checkout, timeout: 55000, killSignal: 'SIGKILL', stdio: ['ignore', fd, fd] }); }
      finally { fs.closeSync(fd); }
      save(prefix + '.status.json', { status: result.status, signal: result.signal, error: result.error?.message });
      assert(!result.error && !result.signal, 'Host timeout or spawn failure');
      const effects = vfsOutput ? { before: JSON.parse(fs.readFileSync(previous)), files: inventory(vfsOutput) } : {};
      if (vfsOutput) save(prefix + '.vfs-inventory.json', effects.files);
      const verdict = assess(fs.readFileSync(path.join(output, prefix + '.log'), 'utf8'), result.status, JSON.parse(fs.readFileSync(next)), dll, effects);
      if (vfsOutput) {
        // Retain the genuinely guest-written profile in the next process's VFS.
        const destination = path.join(stage, WMV_PROFILE.path);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        fs.copyFileSync(path.join(vfsOutput, effects.files[0].path), destination, fs.constants.COPYFILE_EXCL);
        verify(destination, WMV_PROFILE);
      }
      steps.push({ dll, ...verdict, snapshot: path.basename(next), bytes: fs.statSync(next).size, sha256: sha(next) });
      save(prefix + '.assessment.json', steps.at(-1)); previous = next;
    }
    completed = { success: true, newlyGenerated: true, historicalByteMatch: sha(previous) === plan.registry.sha256,
      historicalSha256: plan.registry.sha256, finalSnapshot: previous, steps, elapsedMs: Date.now() - start, gameplayQualified: false };
  } catch (error) { save('failure.json', { error: error.stack, steps, elapsedMs: Date.now() - start }); throw error; }
  finally {
    try {
    const gameAfter = inventory(gameRoot), nativeAfter = inventory(nativeRoot);
    save('game-after.json', gameAfter); save('native-after.json', nativeAfter);
    assert.deepEqual(gameAfter, gameBefore); assert.deepEqual(nativeAfter, [...historical.native].sort((a,b) => a.path.localeCompare(b.path)));
    assert.equal(sha(wasm), moduleSha256); assert.equal(git(['rev-parse', 'HEAD']), commit);
    assert.equal(git(['status', '--porcelain', '--untracked-files=normal']), '');
    for (const r of historical.native) verify(path.join(output, 'registration', r.path), r);
    verify(path.join(output, 'registration/regsvr32.exe'), plan.registry.registrationTool);
    if (steps.some(step => step.profile)) verify(path.join(output, 'registration', WMV_PROFILE.path), WMV_PROFILE);
    save('postflight.json', { identitiesUnchanged: true });
    } catch (error) { save('postflight-failure.json', { error: error.stack }); throw error; }
  }
  if (completed) save('result.json', completed);
}
if (require.main === module) {
  try { assert.equal(process.argv.length, 3, 'Usage: node tools/cmr3-register-native.js CONFIG.json'); run(JSON.parse(fs.readFileSync(process.argv[2]))); }
  catch (e) { console.error(e); process.exitCode = 1; }
}
module.exports = { ORDER, WMV_PROFILE, assess, runnerArgs, verify, verifyCommonDirectory };

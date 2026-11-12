#!/usr/bin/env node
'use strict';
// Acquisition/extraction only: no Windows executables or registration are run.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const plan = require('../docs/cmr3-native-recovery-plan-20261015.json');
const expected = require('../docs/cmr3-historical-receipts-20261015.json').native;
const { requireCapacity } = require('./cmr3-recovery-guards');
const BUDGET = 1024 ** 3;
function digest(file, algorithm = 'sha256') {
  const fd = fs.openSync(file, 'r'), hash = crypto.createHash(algorithm), buffer = Buffer.alloc(65536);
  try { for (;;) { const n = fs.readSync(fd, buffer); if (!n) break; hash.update(buffer.subarray(0, n)); } return hash.digest('hex'); }
  finally { fs.closeSync(fd); }
}
function verifyIdentity(file, pin) {
  assert.equal(fs.statSync(file).size, pin.bytes, 'Size mismatch: ' + file);
  const algorithm = pin.sha256 ? 'sha256' : 'sha1', hash = pin[algorithm];
  assert(hash, 'Missing source identity pin');
  assert.equal(digest(file, algorithm), hash, 'Hash mismatch: ' + file);
}
function walk(root) {
  const out = [];
  function visit(dir) { for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) visit(p); else if (e.isFile()) out.push(p); else throw Error('Nonregular extraction entry: ' + p);
  } }
  visit(root); return out.sort();
}
function selectExact(root, pin) {
  const candidates = walk(root).filter(p => path.basename(p).toLowerCase() === pin.path.toLowerCase());
  const matching = candidates.filter(p => fs.statSync(p).size === pin.bytes && digest(p) === pin.sha256);
  if (!matching.length) throw Error('No exact native identity for ' + pin.path + '; candidates: ' + candidates.join(', '));
  return matching[0];
}
function selectDirectOrCabinet(root, pin, extract) {
  const files = walk(root);
  if (files.some(p => path.basename(p).toLowerCase() === pin.path.toLowerCase())) return selectExact(root, pin);
  const cabinets = files.filter(p => path.basename(p).toLowerCase() === 'directx.cab');
  assert.equal(cabinets.length, 1, 'Expected one original DirectX.cab or direct native payload');
  return selectExact(extract(cabinets[0]), pin);
}
function recover(root, seeds, sourceCache) {
  if (![root, seeds].every(p => path.isAbsolute(p || ''))) throw Error('Usage: cmr3-native-recovery.js ABSOLUTE_FRESH_OUTPUT ABSOLUTE_SEED_DIRECTORY');
  if (sourceCache && !path.isAbsolute(sourceCache)) throw Error('Source cache must be absolute');
  requireCapacity(path.dirname(root), BUDGET);
  fs.mkdirSync(root);
  const startedAt = new Date().toISOString(), deadline = Date.now() + 570000;
  const save = (n, data) => fs.writeFileSync(path.join(root, n), JSON.stringify(data, null, 2) + '\n');
  function run(name, bin, args, cap) {
    const timeout = Math.min(cap, deadline - Date.now());
    if (timeout < 1000) throw Error('Native recovery deadline reached');
    const r = cp.spawnSync(bin, args, { encoding: 'utf8', timeout, maxBuffer: 4 * 1024 ** 2 });
    fs.writeFileSync(path.join(root, name + '.log'), String(r.stdout || '') + String(r.stderr || ''));
    save(name + '.json', { bin, args, timeout, status: r.status, signal: r.signal, error: r.error?.message });
    if (r.status !== 0) throw Error(name + ' failed; source, partial outputs and log retained');
  }
  try {
    const native = path.join(root, 'native'); fs.mkdirSync(native);
    const provenance = [];
    function copy(file, pin, source) {
      verifyIdentity(file, pin);
      const dest = path.join(native, pin.path);
      fs.copyFileSync(file, dest, fs.constants.COPYFILE_EXCL); verifyIdentity(dest, pin);
      provenance.push({ ...pin, source, extractedPath: file });
    }
    // Fail before network activity if the four small authenticated seeds are absent.
    for (const seed of plan.locallyVerifiedExactMatches) {
      const pin = expected.find(p => p.path.toLowerCase() === seed.native.toLowerCase());
      copy(path.join(seeds, seed.native), pin, 'hash-verified original local seed');
    }
    const sources = path.join(root, 'sources'); fs.mkdirSync(sources);
    function acquire(pkg, name) {
      requireCapacity(root, BUDGET);
      const target = path.join(sources, name), partial = target + '.part';
      if (sourceCache) {
        const cached = path.join(sourceCache, name);
        verifyIdentity(cached, pkg);
        fs.copyFileSync(cached, target, fs.constants.COPYFILE_EXCL); verifyIdentity(target, pkg);
        save(name + '-source.json', { url: pkg.url, recoveredFrom: cached, bytes: fs.statSync(target).size, sha256: digest(target), sha1: digest(target, 'sha1') });
        return target;
      }
      const seconds = Math.max(1, Math.min(300, Math.floor((deadline - Date.now() - 5000) / 1000)));
      run('fetch-' + name, 'curl', ['--fail', '--location', '--max-time', String(seconds), '--max-filesize', String(pkg.bytes),
        '--dump-header', path.join(sources, name + '.headers'), '--output', partial, pkg.url], seconds * 1000 + 3000);
      verifyIdentity(partial, pkg); fs.renameSync(partial, target);
      save(name + '-source.json', { url: pkg.url, bytes: fs.statSync(target).size, sha256: digest(target), sha1: digest(target, 'sha1') });
      return target;
    }
    function extract(archive, name) {
      requireCapacity(root, BUDGET);
      const dir = path.join(root, name);
      run('extract-' + name, '7z', ['x', '-y', '-o' + dir, archive], 60000); return dir;
    }
    const wmp = plan.historicalPackageSources[0];
    const wmpRoot = extract(acquire(wmp, 'MPSetup.exe'), 'wmp9');
    for (const name of wmp.provides) {
      const pin = expected.find(p => p.path.toLowerCase() === name.toLowerCase());
      copy(selectExact(wmpRoot, pin), pin, 'MPSetup.exe');
    }
    const ie = plan.historicalPackageSources[1];
    const ieRoot = extract(acquire(ie, 'ie60.exe'), 'ie6');
    const cabinets = walk(ieRoot).filter(p => path.basename(p).toUpperCase() === ie.nestedCabinet);
    assert.equal(cabinets.length, 1, 'Expected one original IEMIL_4.CAB');
    const mlangRoot = extract(cabinets[0], 'mlang');
    const mlang = expected.find(p => p.path === 'MLANG.DLL');
    copy(selectExact(mlangRoot, mlang), mlang, 'ie60.exe/IEMIL_4.CAB');
    const dx = plan.qedit.publicCandidate;
    const dxZip = extract(acquire(dx, 'dx81.zip'), 'dx81-package');
    const dxExes = walk(dxZip).filter(p => path.basename(p) === dx.listedMember);
    assert.equal(dxExes.length, 1, 'Expected one listed DirectX installer');
    assert.equal(fs.statSync(dxExes[0]).size, dx.listedMemberBytes);
    const dxRoot = extract(dxExes[0], 'dx81');
    const qedit = expected.find(p => p.path === 'qedit.dll');
    copy(selectDirectOrCabinet(dxRoot, qedit, cab => extract(cab, 'dx81-files')), qedit, 'dx81.zip/DX81eng.exe direct or cabinet payload; exact native hash required');
    assert.equal(walk(native).length, 12);
    for (const pin of expected) verifyIdentity(path.join(native, pin.path), pin);
    save('native-inventory.json', provenance);
    save('result.json', { startedAt, finishedAt: new Date().toISOString(), success: true, nativeFiles: 12,
      registryPrepared: false, guestExecuted: false, note: 'Original dependencies recovered; registry and launch remain separate' });
  } catch (e) {
    save('failure.json', { startedAt, finishedAt: new Date().toISOString(), error: String(e.stack || e) }); throw e;
  }
}
if (require.main === module) { try { recover(process.argv[2], process.argv[3], process.argv[4]); } catch (e) { console.error(e); process.exitCode = 1; } }
module.exports = { digest, verifyIdentity, selectExact, selectDirectOrCabinet, recover };

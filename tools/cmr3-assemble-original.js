#!/usr/bin/env node
'use strict';
// Cabinet mapping recovered from the original Oct14 audit; no guest execution.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const assert = require('node:assert/strict');
const plan = require('../docs/cmr3-recovery-20261015.json');
const historical = require('../docs/cmr3-historical-receipts-20261015.json');
const { requireCapacity, verifyCarve } = require('./cmr3-recovery-guards');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function inventory(root) {
  const rows = [];
  function walk(dir, rel = '') {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name))) {
      const r = path.posix.join(rel, e.name), p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) rows.push({ path: r, bytes: fs.statSync(p).size, sha256: sha(p) });
      else throw Error('Unexpected nonregular extraction entry: ' + r);
    }
  }
  walk(root); return rows;
}
function assemble(source, out) {
  if (![source, out].every(p => path.isAbsolute(p || ''))) throw Error('Usage: cmr3-assemble-original.js ABSOLUTE_ACQUISITION ABSOLUTE_FRESH_OUTPUT');
  requireCapacity(path.dirname(out));
  fs.mkdirSync(out);
  const save = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2) + '\n');
  const startedAt = new Date().toISOString();
  try {
    assert.equal(fs.statSync(path.join(source, 'installer.exe')).size, plan.source.memberBytes);
    assert.equal(sha(path.join(source, 'installer.exe')), plan.source.expectedMemberSha256);
    const carved = JSON.parse(fs.readFileSync(path.join(source, 'carved.json')));
    assert.deepEqual(carved.map(r => r.path), plan.historicalExtraction.rangesHalfOpen.map(r => r.output));
    for (const [index, r] of carved.entries()) {
      verifyCarve(path.join(source, 'installer.exe'), path.join(source, 'cabinet', r.path), plan.historicalExtraction.rangesHalfOpen[index]);
      assert.equal(fs.statSync(path.join(source, 'cabinet', r.path)).size, r.bytes);
      assert.equal(sha(path.join(source, 'cabinet', r.path)), r.sha256);
    }
    const exe = path.join(source, 'cabinet/Rally_3PC.exe');
    assert.equal(sha(exe), plan.historicalExtraction.expectedExeSha256);
    const unshield = '/usr/bin/unshield';
    const version = cp.spawnSync('dpkg-query', ['-W', '-f=${Package} ${Version}\n', 'unshield', 'libunshield0'], { encoding: 'utf8', timeout: 10000 });
    save('tool.json', { binary: unshield, sha256: sha(unshield), packages: version.stdout, status: version.status });
    const raw = path.join(out, 'extracted'), game = path.join(out, 'game');
    requireCapacity(out);
    const args = ['-d', raw, 'x', path.join(source, 'cabinet/data1.cab')];
    const result = cp.spawnSync(unshield, args, { encoding: 'utf8', timeout: 90000, maxBuffer: 4 * 1024 ** 2 });
    fs.writeFileSync(path.join(out, 'unshield.log'), String(result.stdout || '') + String(result.stderr || ''));
    save('extraction.json', { args, status: result.status, signal: result.signal, error: result.error?.message });
    if (result.status !== 0) throw Error('Cabinet extraction failed');
    const extracted = inventory(raw);
    save('extracted-inventory.json', extracted);
    assert.equal(extracted.length, historical.mapping.raw);
    const excluded = [], mapped = [], destinations = new Set();
    for (const row of extracted) {
      const [group, ...rest] = row.path.split('/');
      if (!Object.hasOwn(historical.mapping.groups, group)) { excluded.push(row.path); continue; }
      const target = path.posix.join(historical.mapping.groups[group], ...rest);
      assert(!target.startsWith('../') && !path.isAbsolute(target));
      assert(!destinations.has(target.toLowerCase()), 'Case-insensitive destination collision: ' + target);
      destinations.add(target.toLowerCase()); mapped.push({ ...row, target });
    }
    assert.deepEqual(excluded.sort(), [...historical.mapping.excluded].sort());
    assert.equal(mapped.length, historical.mapping.mapped);
    fs.mkdirSync(game);
    for (const row of mapped) {
      const dst = path.join(game, row.target);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(path.join(raw, row.path), dst, fs.constants.COPYFILE_EXCL);
      assert.equal(sha(dst), row.sha256);
    }
    fs.copyFileSync(exe, path.join(game, 'Rally_3PC.exe'), fs.constants.COPYFILE_EXCL);
    const installed = inventory(game);
    assert.equal(installed.length, plan.historicalExtraction.mappedOriginalFiles);
    save('mapping.json', { groups: historical.mapping.groups, excluded, mapped });
    save('game-inventory.json', installed);
    save('result.json', { startedAt, finishedAt: new Date().toISOString(), success: true, extracted: extracted.length,
      excluded: excluded.length, gameFiles: installed.length, gameBytes: installed.reduce((s,r) => s+r.bytes, 0),
      stage: 'original files mapped; native dependencies and registry absent; no launch qualification' });
  } catch (e) {
    save('failure.json', { startedAt, finishedAt: new Date().toISOString(), error: String(e.stack || e) }); throw e;
  }
}
if (require.main === module) { try { assemble(process.argv[2], process.argv[3]); } catch (e) { console.error(e); process.exitCode = 1; } }
module.exports = { assemble, inventory };

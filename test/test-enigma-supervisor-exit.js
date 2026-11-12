'use strict';
// Offline source/subprocess tests only; no historical guest/watchdog launch.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const evidence = path.join(repo, 'docs/re-notes/enigma-supervisor-exit-repair-20261024');
const old = path.join(repo, 'docs/re-notes/enigma-runner-repairs-independent-20261024');
const originalOracle = fs.readFileSync(path.join(__dirname, 'test-enigma-supervisor-denial-independent.py'), 'utf8');
assert.equal(crypto.createHash('sha256').update(originalOracle).digest('hex'),
  '608d6fb2e87a59c0fe65445d057bed30fc40b6906f4ab48a61fafebb08d48a67');
assert.equal(fs.readFileSync(path.join(__dirname, 'test-enigma-supervisor-denial-repaired.py'), 'utf8'),
  originalOracle.replace("evidence = repo / 'docs/re-notes/enigma-runner-repairs-independent-20261024'",
    "evidence = repo / 'docs/re-notes/enigma-supervisor-exit-repair-20261024'"));
assert.deepEqual(zlib.gunzipSync(fs.readFileSync(path.join(evidence, 'candidate-terminal.cjs.gz'))),
  fs.readFileSync(path.join(repo, 'tools/enigma-terminal-capture-guard.cjs')));
assert.deepEqual(fs.readFileSync(path.join(__dirname, 'enigma-supervisor-exit-composition.cjs')),
  zlib.gunzipSync(fs.readFileSync(path.join(old, 'composition-review.js.gz'))));
const results = [];
for (const args of [
  ['python3', 'test/test-enigma-supervisor-denial-repaired.py'],
  ['python3', 'test/test-enigma-supervisor-exit.py'],
  [process.execPath, '--max-old-space-size=256', 'test/enigma-supervisor-exit-composition.cjs'],
]) {
  const memAvailable = Number(/^MemAvailable:\s+(\d+)/m.exec(fs.readFileSync('/proc/meminfo', 'utf8'))[1]) * 1024;
  assert(memAvailable >= 805306368, 'fresh memory admission');
  const p = spawnSync(args[0], args.slice(1), { cwd: repo, encoding: 'utf8', timeout: 60000,
    maxBuffer: 1048576, env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1', NODE_OPTIONS: '--max-old-space-size=256' } });
  assert.ifError(p.error);
  assert.equal(p.status, 0, p.stderr);
  results.push({ command: args, status: p.status, memAvailable, outputBytes: Buffer.byteLength(p.stdout) });
}
assert.equal(require('../tools/test-tiers').classifyTest('test-enigma-supervisor-exit.js'), 'unit');
console.log(JSON.stringify({ pass: true, originalOracleUnchanged: true, fixtureIdentityOnly: true, results }));

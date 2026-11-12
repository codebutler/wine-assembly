'use strict';
// Allocation-light controller safeguards only: no compiler, guest or Worker.
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const control = require('./run-lockfile-native');
assert.equal(control.ADMIT, 2852126720);
assert.equal(control.FLOOR, 2214592512);
assert.equal(control.LOG, 2097152);
assert.equal(control.TOTAL, 33554432);
assert.deepEqual(control.jobs.map(j => [j.name, j.seconds]), [
  ['normal-build', 120], ['handlers-public-tail', 60], ['handlers-public-compat', 60],
  ['worker-tail', 45], ['worker-compat', 45],
]);
const continuation = require('./run-lockfile-continuation');
assert.deepEqual(continuation.jobs.slice(0, 4), control.jobs.slice(1));
assert(continuation.jobs.every(job => job.name !== 'normal-build'));
assert.deepEqual(continuation.jobs.slice(4).map(job => job.seconds), [30, 30]);
assert(continuation.jobs.slice(4).every(job => job.args[0] === 'test/test-lockfile-public-binary.js'));
const exportsTable = require('../src/kernel32-exports.json').exports;
const apiTable = require('../src/api_table.json');
for (const [name, ordinal, id] of [['LockFile', 591, 453], ['UnlockFile', 592, 711]]) {
  assert(exportsTable.some(row => row.name === name && row.api === name && row.ordinal === ordinal));
  assert.equal(apiTable[id].name, name);
  assert.equal(apiTable[id].nargs, 5);
}
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lockfile-control-'));
try {
  const file = path.join(dir, 'pin'), absent = path.join(dir, 'absent');
  fs.writeFileSync(file, 'original');
  const pins = [{ file, sha256: crypto.createHash('sha256').update('original').digest('hex') },
    { file: absent, absent: true }];
  control.verifyPins(pins);
  assert.equal(control.outputBytes(dir), 8);
  assert.equal(control.aggregateBytes({ outputRoots: [dir] }, '/nonexistent-lockfile-evidence'),
    control.outputBytes(path.join(__dirname, '../build')) + 8);
  fs.writeFileSync(file, 'changed');
  assert.throws(() => control.verifyPins(pins), /changed pin/);
  fs.writeFileSync(file, 'original'); fs.writeFileSync(absent, 'new');
  assert.throws(() => control.verifyPins(pins), /formerly absent/);
  fs.unlinkSync(absent); fs.unlinkSync(file);
  assert.throws(() => control.verifyPins(pins), /ENOENT/);
} finally { fs.rmSync(dir, { recursive: true, force: true }); }
console.log('LockFile controller guards: PASS (source only; no spawn/build/runtime)');

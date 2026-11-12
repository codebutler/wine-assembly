'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto');
const { requireCapacity, verifyCarve, FLOOR, EXPANSION_BUDGET } = require('../tools/cmr3-recovery-guards');
test('capacity preserves floor after conservative expansion', () => {
  const free = bytes => () => ({ bavail: bytes, bsize: 1 });
  assert.throws(() => requireCapacity('.', EXPANSION_BUDGET, free(FLOOR + EXPANSION_BUDGET - 1)), /Insufficient space/);
  assert.equal(requireCapacity('.', EXPANSION_BUDGET, free(FLOOR + EXPANSION_BUDGET)), FLOOR + EXPANSION_BUDGET);
  assert.throws(() => requireCapacity('.', EXPANSION_BUDGET, free(FLOOR)), /Insufficient space/);
});
test('carve is bound to original bytes even when its receipt hash is edited', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cmr3-carve-test-'));
  try {
    const source = path.join(dir, 'source'), carved = path.join(dir, 'carved'), range = { start: 2, end: 6 };
    fs.writeFileSync(source, 'abcdefgh'); fs.writeFileSync(carved, 'cdef');
    verifyCarve(source, carved, range);
    fs.writeFileSync(carved, 'WXYZ');
    const receipt = { bytes: 4, sha256: crypto.createHash('sha256').update('WXYZ').digest('hex') };
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(carved)).digest('hex'), receipt.sha256);
    assert.throws(() => verifyCarve(source, carved, range), /differ from verified source/);
    fs.writeFileSync(carved, 'cde');
    assert.throws(() => verifyCarve(source, carved, range), /length mismatch/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

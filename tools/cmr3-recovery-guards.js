'use strict';
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const FLOOR = 2 * 1024 ** 3;
const EXPANSION_BUDGET = 512 * 1024 ** 2; // Acquisition <256MiB; raw+mapped installation <512MiB.
function requireCapacity(root, expansion = EXPANSION_BUDGET, statfs = fs.statfsSync) {
  const s = statfs(root), free = Number(s.bavail) * Number(s.bsize);
  if (free < FLOOR + expansion) throw Error('Insufficient space: preserve 2GiB floor plus recovery expansion budget');
  return free;
}
function hashRange(file, start, end) {
  const fd = fs.openSync(file, 'r'), h = crypto.createHash('sha256'), buffer = Buffer.alloc(65536);
  try {
    for (let position = start; position < end;) {
      const n = fs.readSync(fd, buffer, 0, Math.min(buffer.length, end - position), position);
      if (!n) throw Error('Short source range');
      h.update(buffer.subarray(0, n)); position += n;
    }
    return h.digest('hex');
  } finally { fs.closeSync(fd); }
}
function verifyCarve(source, carved, range) {
  assert(Number.isSafeInteger(range.start) && Number.isSafeInteger(range.end) && range.start >= 0 && range.end > range.start);
  assert(range.end <= fs.statSync(source).size, 'Source range out of bounds');
  assert.equal(fs.statSync(carved).size, range.end - range.start, 'Carved range length mismatch');
  assert.equal(hashRange(carved, 0, range.end - range.start), hashRange(source, range.start, range.end), 'Carved bytes differ from verified source range');
}
module.exports = { requireCapacity, verifyCarve, hashRange, FLOOR, EXPANSION_BUDGET };

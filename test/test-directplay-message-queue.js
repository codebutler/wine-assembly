#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (export "test_enqueue" (func $dp_message_enqueue))
  (export "test_find" (func $dp_message_find))
  (export "test_query" (func $dp_message_query))
  (export "test_remove" (func $dp_message_remove))
  (export "test_cancel_range" (func $dp_message_cancel_range))
  (export "test_clear" (func $dp_clear_entities))
  (export "test_sparse_map" (func $virtual_map_commit))
  (export "test_g2w" (func $g2w))
  (func (export "test_bytes") (result i32) (global.get $dp_message_bytes))
  (func (export "test_id_limit") (param $id i32) (global.set $dp_message_next_id (local.get $id)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const data = e.guest_alloc(1048576) >>> 0;
  e.guest_write32(data, 0x11223344);
  const add = (owner = 1, size = 4, priority = 0, kind = 0) =>
    e.test_enqueue(owner, 10, 20, data, size, priority, kind) >>> 0;
  const a = add(1, 4, 10);
  const b = add(2, 4, 10);
  const c = add(1, 4, 20, 1);
  assert(a && b && c);
  assert.strictEqual(new Set([a, b, c]).size, 3);
  assert.strictEqual(e.test_bytes(), 12);
  assert.strictEqual(e.test_query(1, 0, 0, 0, 0), 1);
  assert.strictEqual(e.test_query(1, 0, 10, 20, 1), 4);
  assert.strictEqual(e.test_query(1, 1, 10, 20, 0), 1);
  assert.strictEqual(e.test_query(1, 0, 11, 20, 0), 0);
  assert.strictEqual(e.test_query(1, 0, 10, 21, 0), 0);
  assert.strictEqual(e.test_query(3, 0, 0, 0, 0), 0);
  e.guest_write32(data, 0xaabbccdd);
  const entry = e.test_find(1, a) >>> 0;
  assert.strictEqual(e.guest_read32(entry + 8), 10);
  assert.strictEqual(e.guest_read32(entry + 12), 20);
  assert.strictEqual(e.guest_read32(e.guest_read32(entry + 16)) >>> 0, 0x11223344,
    'queue owns payload bytes independently of the caller');
  assert.strictEqual(e.test_find(2, a), 0, 'IDs are owner-scoped');
  assert.strictEqual(e.test_remove(2, a), 0);
  assert.strictEqual(e.test_cancel_range(1, 0, 10, 10), 1);
  assert.strictEqual(e.test_find(1, a), 0);
  assert(e.test_find(2, b));
  assert(e.test_find(1, c), 'send cancellation leaves receive messages alone');
  assert.strictEqual(e.test_bytes(), 8);
  assert.strictEqual(e.test_cancel_range(1, 1, 21, 20), 0);
  assert.strictEqual(e.test_remove(1, c), 1);
  assert.strictEqual(e.test_remove(1, c), 0, 'removal is not repeated');
  assert.strictEqual(add(0), 0);
  assert.strictEqual(add(1, 1048577), 0, 'individual payload limit');
  assert.strictEqual(add(1, 4, 0, 2), 0, 'only send/receive kinds are valid');
  assert.strictEqual(e.test_enqueue(1, 10, 20, 0, 4, 0, 0), 0);
  assert.strictEqual(e.test_bytes(), 4, 'invalid writes do not change accounting');
  e.test_clear();
  assert.strictEqual(e.test_bytes(), 0, 'Close frees queues even before entity-table initialization');
  assert.strictEqual(e.test_find(2, b), 0);

  const page = 0x30000000;
  assert.strictEqual(e.test_sparse_map(page, 4096) >>> 0, page);
  assert.strictEqual(e.test_sparse_map(0x28000000, 12288) >>> 0, 0x28000000);
  assert.strictEqual(e.test_sparse_map(page + 4096, 4096) >>> 0, page + 4096);
  assert.notStrictEqual(e.test_g2w(page + 4095) + 1, e.test_g2w(page + 4096),
    'fixture has noncontiguous backing across adjacent guest pages');
  const pattern = [17, 34, 51, 68, 85, 102, 119, 136];
  pattern.forEach((value, i) => e.guest_write8(page + 4092 + i, value));
  const sparseId = e.test_enqueue(1, 10, 20, page + 4092, 8, -1, 0);
  assert(sparseId);
  const sparsePayload = e.guest_read32(e.test_find(1, sparseId) + 16) >>> 0;
  assert.deepStrictEqual(pattern.map((_, i) => e.guest_read8(sparsePayload + i)), pattern,
    'payload copy translates each sparse guest page');
  assert.strictEqual(e.test_cancel_range(1, 0, 0, 0x7fffffff), 0);
  assert.strictEqual(e.test_cancel_range(1, 0, 0x80000000, 0xffffffff), 1,
    'priority bounds use unsigned DWORD comparisons');
  assert.strictEqual(e.test_bytes(), 0);

  const ids = Array.from({ length: 64 }, () => add(1, 0));
  assert(ids.every(Boolean));
  assert.strictEqual(new Set(ids).size, 64);
  assert.strictEqual(add(1, 0), 0, 'slot capacity is bounded even for empty messages');
  assert.strictEqual(e.test_remove(1, ids[0]), 1);
  const reused = add(1, 0);
  assert(reused > ids[63], 'slot reuse must not recycle message IDs');
  assert.strictEqual(e.test_find(1, ids[0]), 0);
  assert.strictEqual(e.guest_read32(e.test_query(1, 0, 0, 0, 2)) >>> 0, ids[1],
    'FIFO lookup uses message order, not a recycled slot index');
  assert.strictEqual(e.test_query(1, 0, 0, 0, 0), 64);
  assert.strictEqual(e.test_query(1, 0, 0, 0, 1), 0);
  e.test_clear();

  const large = Array.from({ length: 4 }, () => add(1, 1048576));
  assert(large.every(Boolean));
  assert.strictEqual(e.test_bytes(), 4194304);
  assert.strictEqual(add(1, 1), 0, 'total payload budget is bounded');
  assert.strictEqual(e.test_remove(1, large[0]), 1);
  assert(add(1, 1048576), 'removal releases byte capacity');
  e.test_clear();
  assert.strictEqual(e.test_bytes(), 0);
  e.test_id_limit(-1);
  assert.strictEqual(add(1, 0), 0xffffffff);
  assert.strictEqual(add(1, 0), 0, 'ID exhaustion cannot silently wrap and alias');
  e.test_clear();
  assert.strictEqual(e.test_bytes(), 0);
  console.log('PASS DirectPlay internal queue ownership, copied bytes, cancellation, limits, and cleanup');
})().catch(error => {
  console.error(error.stack || error);
  process.exitCode = 1;
});

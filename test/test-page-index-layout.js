#!/usr/bin/env node
// The worker-heavy page-index split (lib/apps.js `workerHeavyCodeCache`).
//
// Default: main 512 slots, fifteen workers 16 each. Mode 1: main 256, workers
// 32, in the same $PAGE_INDEX_ARENA. The mode lives in shared memory so that
// set_page_index_layout on the first instance decides every later
// init_thread. This checks both modes: main's slot count, every worker's base
// and slot count, and that the last worker's slots end inside the arena.
//
// Run: node test/test-page-index-layout.js

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const EXTRA_WAT = `
  (func (export "test_pix_slots") (result i32) (global.get $PAGE_INDEX_SLOTS))
  (func (export "test_pix_base") (result i32) (global.get $PAGE_INDEX))
  (func (export "test_pix_arena") (result i32) (global.get $PAGE_INDEX_ARENA))
  (func (export "test_pix_arena_size") (result i32) (global.get $PAGE_INDEX_ARENA_SIZE))
  (func (export "test_pix_bytes") (result i32) (global.get $PAGE_INDEX_BYTES))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none' });
  const arena = e.test_pix_arena() >>> 0, size = e.test_pix_arena_size() >>> 0, bytes = e.test_pix_bytes();
  const initWorker = tid => e.init_thread(tid, e.get_image_base(), e.get_code_start(), e.get_code_end(),
    e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks(), 0);

  for (const [mode, mainSlots, workerSlots] of [[0, 512, 16], [1, 256, 32], [0, 512, 16]]) {
    assert.strictEqual(e.set_page_index_layout(mode), mode, `mode ${mode} is stored`);
    assert.strictEqual(e.test_pix_slots(), mainSlots, `mode ${mode}: main slots`);
    for (const tid of [1, 2, 15]) {
      initWorker(tid);
      const base = e.test_pix_base() >>> 0;
      assert.strictEqual(e.test_pix_slots(), workerSlots, `mode ${mode}: worker ${tid} slots`);
      assert.strictEqual(base, arena + mainSlots * bytes + (tid - 1) * workerSlots * bytes,
        `mode ${mode}: worker ${tid} base follows main's share`);
      assert(base + workerSlots * bytes <= arena + size, `mode ${mode}: worker ${tid} ends inside the arena`);
    }
  }
  assert.strictEqual(e.set_page_index_layout(7), 0, 'an unknown mode is the default');
  console.log('PASS  page-index layout: default 512/16 and worker-heavy 256/32 both fit the arena');
})().catch(error => { console.error(error.stack || error); process.exit(1); });

#!/usr/bin/env node
// Real allocator coverage for default, worker-heavy and segmented layouts.
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
  (func (export "test_pix_extra") (result i32) (global.get $PAGE_INDEX_EXTRA))
  (func (export "test_pix_alloc") (result i32) (local $p i32)
    (local.set $p (call $page_index_alloc))
    (if (local.get $p) (then (call $page_index_clear (local.get $p))))
    (local.get $p))
  (func (export "test_pix_reset") (call $page_dir_reset))
  (func (export "test_pix_spill") (call $thread_spill_enter))
  (func (export "test_pix_rewind") (call $thread_arena_rewind))
  (func (export "test_pix_slot") (param i32) (result i32)
    (call $page_dir_slot (local.get 0)))
  (func (export "test_pix_drop") (param i32) (call $page_dir_drop (local.get 0)))
  (func (export "test_pix_create") (param i32) (result i32)
    (if (i32.eqz (call $page_create (local.get 0) (i32.const 1)))
      (then (return (i32.const 0))))
    (global.get $cur_page_index))
  (func (export "test_pix_evicts") (result i32) (global.get $page_index_evicts))
`;

(async () => {
  const { exports: e, module, host, gdi, memory } =
    await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none' });
  const arena = e.test_pix_arena() >>> 0, size = e.test_pix_arena_size() >>> 0, bytes = e.test_pix_bytes();
  const originalMainCapacity = e.test_arena_get(1) - e.test_arena_get(2);
  const initWorker = (tid, target = e) => target.init_thread(tid, e.get_image_base(), e.get_code_start(), e.get_code_end(),
    e.get_thunk_base(), e.get_thunk_end(), e.get_num_thunks(), 0);

  for (const mode of [0, 1, 2, 0, 2, 1, 0]) {
    const mainSlots = mode === 1 ? 256 : 512, workerSlots = mode === 0 ? 16 : 32;
    const arenaSlots = mode === 2 ? 16 : workerSlots;
    assert.strictEqual(e.set_page_index_layout(mode), mode, `mode ${mode} is stored`);
    initWorker(0);
    assert.strictEqual(e.test_pix_slots(), mainSlots, `mode ${mode}: main slots`);
    assert.strictEqual(e.test_pix_extra(), 0, 'main never retains a worker extra segment');
    assert.strictEqual(e.test_arena_get(1) - e.test_arena_get(2), originalMainCapacity);
    for (let tid = 1; tid <= 15; tid++) {
      initWorker(tid);
      const base = e.test_pix_base() >>> 0;
      assert.strictEqual(e.test_pix_slots(), workerSlots, `mode ${mode}: worker ${tid} slots`);
      assert.strictEqual(base, arena + mainSlots * bytes + (tid - 1) * arenaSlots * bytes,
        `mode ${mode}: worker ${tid} base follows main's share`);
      assert(base + arenaSlots * bytes <= arena + size);
      assert.strictEqual(e.test_arena_get(1) - e.test_arena_get(2), (mode === 2 ? 624 : 768) * 1024);
      assert.strictEqual(e.test_pix_extra(), mode === 2 ? e.test_arena_get(1) : 0);
    }
  }
  assert.strictEqual(e.set_page_index_layout(7), 0, 'an unknown mode is the default');

  // Independent instances must pick up shared mode 2. Fill every index with
  // boundary sentinels, then check all sixteen owners after every allocation.
  e.set_page_index_layout(2);
  initWorker(0);
  const workers = [];
  for (let tid = 1; tid <= 15; tid++) {
    const w = new WebAssembly.Instance(module, { host, gdi }).exports;
    initWorker(tid, w);
    assert.strictEqual(w.test_pix_slots(), 32, 'new instance inherits shared mode');
    workers.push(w);
  }
  const words = new Uint32Array(memory.buffer), sentinels = [], ranges = [];
  for (const [tid, w] of [e, ...workers].entries()) {
    const n = tid ? 32 : 512, base = w.test_pix_base() >>> 0, extra = w.test_pix_extra() >>> 0;
    ranges.push([base, base + (tid ? 16 : 512) * bytes]);
    if (tid) {
      ranges.push([extra, extra + 16 * bytes]);
      // The final code word immediately before the index tail must survive.
      words[(extra - 4) >>> 2] = 0x76540000 | tid;
      sentinels.push([extra - 4, 0x76540000 | tid]);
    }
    for (let i = 0; i < n; i++) {
      const p = w.test_pix_alloc() >>> 0;
      assert.strictEqual(p, tid && i >= 16 ? extra + (i - 16) * bytes : base + i * bytes,
        `owner ${tid} slot ${i} maps to its segment`);
      assert.strictEqual(words[p >>> 2], 0xffffffff, 'index entries cleared');
      assert.strictEqual(words[(p + bytes - 4) >>> 2], 0, 'bitmap tail cleared');
      const mark = (0x12340000 | (tid << 10) | i) >>> 0;
      for (const a of [p, p + bytes - 4]) {
        words[a >>> 2] = mark;
        sentinels.push([a, mark]);
      }
    }
    assert.strictEqual(w.test_pix_alloc(), 0, 'unowned full indexes cannot be evicted');
  }
  ranges.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < ranges.length; i++) assert(ranges[i - 1][1] <= ranges[i][0], 'all owner segments disjoint');
  for (const [a, mark] of sentinels) assert.strictEqual(words[a >>> 2], mark, 'other owners preserve sentinels');

  const w = workers[0], extra = w.test_pix_extra(), normalEnd = w.test_arena_get(1);
  w.test_pix_reset();
  for (let i = 0; i < 16; i++) w.test_pix_alloc();
  w.test_pix_spill();
  assert.notStrictEqual(w.test_arena_get(1), normalEnd);
  for (let i = 0; i < 16; i++) assert.strictEqual(w.test_pix_alloc(), extra + i * bytes,
    'extra indexes remain in code partition during spill');
  w.test_pix_rewind();
  assert.strictEqual(w.test_arena_get(1), normalEnd, 'rewind restores reduced code limit');
  w.test_pix_reset();
  assert.strictEqual(w.test_pix_alloc(), w.test_pix_base(), 'reset restarts first segment');

  // Exercise production page ownership, free-list links and clock eviction.
  initWorker(1, w);
  const pages = [], slots = new Set();
  for (let p = 0x400000; pages.length < 35; p += 0x1000) {
    const slot = w.test_pix_slot(p);
    if (!slots.has(slot)) { slots.add(slot); pages.push(p); }
  }
  const pointers = pages.slice(0, 32).map(p => w.test_pix_create(p));
  assert(pointers.every(Boolean));
  assert.strictEqual(pointers[15], w.test_pix_base() + 15 * bytes);
  assert.strictEqual(pointers[16], extra);
  assert.strictEqual(pointers[31], extra + 15 * bytes);
  const evicts = w.test_pix_evicts();
  assert(pointers.includes(w.test_pix_create(pages[32])), '33rd page recycles a clock victim');
  assert.strictEqual(w.test_pix_evicts(), evicts + 1);
  // Start fresh so both chosen pages are known to remain live.
  initWorker(1, w);
  pages.slice(0, 32).forEach(p => assert(w.test_pix_create(p)));
  w.test_pix_drop(pages[0]);
  w.test_pix_drop(pages[16]);
  assert.strictEqual(w.test_pix_create(pages[33]), extra, 'extra segment recycles via absolute free-list pointer');
  assert.strictEqual(w.test_pix_create(pages[34]), w.test_pix_base(), 'ordinary segment recycles via same free list');
  w.test_pix_spill();
  e.set_page_index_layout(0);
  initWorker(0, w);
  assert.strictEqual(w.test_pix_extra(), 0);
  assert.strictEqual(w.test_pix_slots(), 512);
  assert.strictEqual(w.test_arena_get(1) - w.test_arena_get(2), originalMainCapacity);
  assert.strictEqual(w.test_arena_get(3), 0, 'reused main clears spill state');
  console.log('PASS page-index layouts 0/1/2: all owners, segmented allocation, isolation, recycling, clock eviction, spill and reuse');
})().catch(error => { console.error(error.stack || error); process.exit(1); });

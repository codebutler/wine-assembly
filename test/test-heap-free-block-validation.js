#!/usr/bin/env node
//
// $heap_alloc must not serve a free block whose own header is impossible.
//
// $heap_free already validates a block's extent before linking it, but the
// header lives in guest memory and stays writable afterwards: a guest that
// overruns the live block in front of a free one rewrites that header after
// the link happened. If the allocator then trusts it, a header reading tens
// of megabytes looks like a fit for any request, gets split, and is handed
// back as a low pointer -- and HEAP_ZERO_MEMORY promptly zeroes that whole
// bogus extent straight through whatever the emulator keeps above the heap.
// The failure surfaces nowhere near the heap (the decoder walks into zeros),
// so it is worth pinning the check itself down here.
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "set_free_list") (param i32) (global.set $free_list (local.get 0)))
  (func (export "test_set_heap_arena") (param $base i32) (param $ptr i32)
    (global.set $image_base (i32.const 0))
    (global.set $heap_base (local.get $base))
    (global.set $heap_ptr (local.get $ptr))
    (global.set $heap_end (i32.add (local.get $ptr) (i32.const 0x10000)))
    (i32.atomic.store (global.get $HEAP_SHARED) (global.get $heap_end))
    (call $zero_memory (global.get $HEAP_ARENAS) (global.get $HEAP_ARENAS_SIZE))
    (global.set $heap_arena_record (call $heap_arena_register
      (local.get $base) (global.get $heap_end)))
    (i32.atomic.store offset=8 (global.get $heap_arena_record) (local.get $ptr))
    ;; A fresh heap has nothing binned either; with the arenas zeroed above,
    ;; a flush finds no bin tail resolvable and simply empties every bin.
    (call $heap_bins_flush)
    (global.set $free_list (i32.const 0)))
`;

function putBlock(wat, at, size, next) {
  for (let i = 0; i < 4; i++) {
    wat.guest_write8(at + i, (size >>> (i * 8)) & 0xff);
    wat.guest_write8(at + 4 + i, (next >>> (i * 8)) & 0xff);
  }
}

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });

  const BASE = 0x00100000;
  const TOP = 0x00110000;

  // --- control: a well-formed free block is still recycled ------------------
  wat.test_set_heap_arena(BASE, TOP);
  const good = 0x0010f000;
  putBlock(wat, good, 0x100, 0);
  wat.set_free_list(good);
  const fromList = wat.guest_alloc(0x40) >>> 0;
  assert(fromList > good && fromList < good + 0x100,
    `a valid free block is served from the list (got 0x${fromList.toString(16)})`);
  assert.strictEqual(wat.get_heap_ptr() >>> 0, TOP,
    'and the bump pointer did not move');

  // --- the regression: a header that escapes the arena ----------------------
  wat.test_set_heap_arena(BASE, TOP);
  const bad = 0x00108000;
  putBlock(wat, bad, 0x03d09020, 0);   // 64 MB, ending far past heap_ptr
  wat.set_free_list(bad);
  const alloc = wat.guest_alloc(0x40) >>> 0;
  assert(alloc >= TOP,
    `the impossible block is refused and the request bump-allocates ` +
    `(got 0x${alloc.toString(16)})`);
  assert.strictEqual(wat.get_free_list() >>> 0, 0,
    'the chain is cut there: its next pointer lives in the block we distrust');

  // A request that would have "fit" the bogus 64 MB header is refused too --
  // this is the shape Pawn hits, and serving it is what wipes linear memory.
  wat.test_set_heap_arena(BASE, TOP);
  putBlock(wat, bad, 0x03d09020, 0);
  wat.set_free_list(bad);
  const huge = wat.guest_alloc(0x03d09000) >>> 0;
  assert(huge === 0 || huge >= TOP,
    `a huge request is never carved out of the bogus block ` +
    `(got 0x${huge.toString(16)})`);

  // --- headers that are merely malformed ------------------------------------
  for (const [name, size] of [['undersized', 8], ['misaligned', 0x101]]) {
    wat.test_set_heap_arena(BASE, TOP);
    putBlock(wat, good, size, 0);
    wat.set_free_list(good);
    const got = wat.guest_alloc(4) >>> 0;
    assert(got >= TOP, `a ${name} free-block header is refused too`);
  }

  console.log('PASS  heap_alloc refuses free blocks whose header escapes the arena');

  // A valid recycled block can cross non-adjacent sparse backing pages.
  // .kkrieger's clone copied its edges correctly, then an unrelated recycled
  // 80 KB vertex allocation cleared a live edge through a linear WASM fill.
  const sparse = 0x60000000, guard = 0x61000000, need = 0x14008;
  assert(wat.test_virtual_map_commit(sparse, 4096));
  assert(wat.test_virtual_map_commit(guard, 4096));
  assert(wat.test_virtual_map_commit(sparse + 4096, 0x14000));
  assert.notStrictEqual(wat.guest_to_wasm(sparse + 4096),
    wat.guest_to_wasm(sparse) + 4096, 'fixture backing is noncontiguous');
  assert.strictEqual(wat.guest_to_wasm(guard), wat.guest_to_wasm(sparse) + 4096,
    'unrelated guard occupies the next physical page');
  wat.test_set_heap_arena(sparse, sparse + 0x15000);
  for (let offset = 0; offset < need; offset += 4)
    wat.guest_write32(sparse + offset, 0x5a5a5a5a);
  for (let offset = 0; offset < 4096; offset += 4)
    wat.guest_write32(guard + offset, 0x11223344);
  putBlock(wat, sparse, need, 0);
  wat.set_free_list(sparse);
  assert.strictEqual(wat.guest_alloc(81920) >>> 0, sparse + 4,
    'the valid free block is reused');
  for (let offset = 0; offset < 4096; offset += 4)
    assert.strictEqual(wat.guest_read32(guard + offset) >>> 0, 0x11223344,
      `recycling preserves unrelated backing at guard+${offset}`);
  for (let offset = 4; offset < need; offset += 4)
    assert.strictEqual(wat.guest_read32(sparse + offset) >>> 0, 0,
      `the entire recycled payload is cleared at offset ${offset}`);
  assert.strictEqual(wat.guest_read32(sparse) >>> 0, need,
    'clearing preserves the allocation header');
  console.log('PASS  recycled sparse heap clearing preserves unrelated backing and clears every page');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

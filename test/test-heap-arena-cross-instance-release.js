'use strict';

// One instance releasing a free arena must never let another instance hand the
// same memory out twice.
//
// Every WASM instance on the shared memory keeps its own free lists, but the
// arena table they validate links against is shared, and
// $heap_arena_release_free (run by whichever instance hits address-space
// pressure first) used to release ANY arena that was fully carved and had no
// live bytes. Only the releasing instance's own lists were purged. Another
// instance kept its link, and once the guest range was reserved again for a
// new arena, that stale link resolved through $heap_arena_find against the NEW
// record and passed validation.
//
// The software D3D9 render worker is exactly such an instance: the same module
// on the same memory, with its large draw contexts coming back from its own
// large-free list while guest threads apply the address-space pressure. This
// was found while chasing Black & White 2's "native raster execution failed
// (-1)" latch, but fixing it did NOT clear that latch (docs/re-notes/
// black-white-2.md, 2026-10-23); it is a separate defect, proven here.
//
// Instance W plays the render worker (d3dim_worker_init, as
// lib/d3d-render-worker.js does), instance M the guest thread.

const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const regions = require('../lib/region-map.generated');

const IMAGE_BASE = 0x400000;
const LARGE = 1024 * 1024;   // above $HEAP_LARGE: its own single-block arena

const extraWat = `
  (func (export "test_release_free") (result i32)
    (call $heap_arena_release_free))
  (func (export "test_arena_live") (param $guest_ptr i32) (result i32)
    (local $rec i32)
    (local.set $rec (call $heap_arena_find (i32.sub (local.get $guest_ptr) (i32.const 4))))
    (if (result i32) (local.get $rec)
      (then (i32.atomic.load offset=12 (local.get $rec)))
      (else (i32.const -1))))
`;

(async () => {
  const module = await WebAssembly.compile(compileSrcWasm(
    (filename, source) => filename === '13-exports.wat' ? `${source}\n${extraWat}\n` : source));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const instance = async () => {
    const host = { memory };
    for (const [n, s] of Object.entries(sigs)) host[n] = s.results?.length ? () => 0 : () => {};
    return (await WebAssembly.instantiate(module, { host })).exports;
  };
  const M = await instance();
  M.init_thread(0, IMAGE_BASE, 0, 0, 0, 0, 0);
  M.heap_init(regions.END.GUEST_HEAP_BASE - regions.GUEST_BASE + IMAGE_BASE);
  const W = await instance();
  W.d3dim_worker_init(IMAGE_BASE);

  // W: one large block, freed. Its arena is full and holds no live bytes, and
  // the only thing naming it is W's own large-free list.
  const w1 = W.guest_alloc(LARGE) >>> 0;
  assert.ok(w1, 'worker large allocation failed');
  W.guest_free(w1);
  assert.strictEqual(M.test_arena_live(w1), 0, 'freed large arena should have no live bytes');

  // M under pressure releases free arenas -- including W's.
  const released = M.test_release_free() >>> 0;
  assert.ok(released >= LARGE, `M released ${released} bytes, expected W's free arena`);

  // M reserves again; top-down placement hands back the range just freed.
  const m1 = M.guest_alloc(LARGE) >>> 0;
  assert.ok(m1, 'main large allocation failed');
  if (m1 !== w1) {
    console.log(`SKIP: range not reused (released 0x${w1.toString(16)}, got 0x${m1.toString(16)})`);
    process.exit(0);
  }
  const marks = [4, LARGE >> 1, LARGE - 64];
  for (const off of marks) M.guest_write32(m1 + off, 0x4d41494e ^ off);   // "MAIN"

  // W allocates the same size again. Its stale link now resolves against M's
  // record; it must not be served.
  const w2 = W.guest_alloc(LARGE) >>> 0;
  assert.ok(w2, 'worker re-allocation failed');
  assert.notStrictEqual(w2, m1,
    `W was handed M's live block 0x${m1.toString(16)} through a stale large-free link`);
  for (const off of marks) {
    assert.strictEqual(M.guest_read32(m1 + off) >>> 0, (0x4d41494e ^ off) >>> 0,
      `M's block was overwritten at +0x${off.toString(16)} by W's allocation`);
  }

  // A free large block taken from the list is claimed exactly once: after M
  // frees its block it is on M's list, and W's stale link (if any survived)
  // must not let both instances take it.
  M.guest_free(m1);
  const a = M.guest_alloc(LARGE) >>> 0, b = W.guest_alloc(LARGE) >>> 0;
  assert.ok(a && b, 'large allocations after free failed');
  assert.notStrictEqual(a, b, `both instances were handed 0x${a.toString(16)}`);

  console.log('PASS test-heap-arena-cross-instance-release');
})().catch(error => { console.error(error); process.exit(1); });

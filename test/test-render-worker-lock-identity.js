'use strict';

// The render worker must not share a lock identity with the main guest thread.
//
// $lock_acquire is recursive by owner id ($lock_owner_id), and the owner id is
// $current_thread_id. A guest thread gets tid+1 from init_thread, so the main
// thread is 1 -- and the render worker, which never runs init_thread
// (lib/d3d-render-worker.js calls d3dim_worker_init), kept the global's
// default, also 1. So while the guest held LOCK_VIRTUAL_MAP the worker did not
// wait: it "recursed" into the same critical section, both edited the shared
// virtual-map table at once, and a live heap arena lost its map record. Black
// & White 2's software D3D9 queue then latched "native raster execution failed
// (-1)" ~787 s into a run, when $w2g of the render worker's draw context
// returned 0 and $heap_shrink refused the context's compaction
// (docs/re-notes/black-white-2.md, 2026-10-23).
//
// test_lock_try replays $lock_acquire's first decision without spinning:
// 2 = "already mine, recurse", 1 = took a free lock, 0 = held by someone else.

const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const sigs = require('../lib/host-import-sigs.generated.json').sigs;
const regions = require('../lib/region-map.generated');

const IMAGE_BASE = 0x400000;

const extraWat = `
  (func (export "test_lock_owner") (result i32) (call $lock_owner_id))
  (func (export "test_lock_take") (call $lock_acquire (global.get $LOCK_VIRTUAL_MAP)))
  (func (export "test_lock_give") (call $lock_release (global.get $LOCK_VIRTUAL_MAP)))
  (func (export "test_lock_try") (result i32)
    (local $me i32)
    (local.set $me (call $lock_owner_id))
    (if (i32.eq (i32.atomic.load (global.get $LOCK_VIRTUAL_MAP)) (local.get $me))
      (then (return (i32.const 2))))
    (if (i32.eqz (i32.atomic.rmw.cmpxchg (global.get $LOCK_VIRTUAL_MAP) (i32.const 0) (local.get $me)))
      (then
        (i32.store offset=4 (global.get $LOCK_VIRTUAL_MAP) (i32.const 1))
        (return (i32.const 1))))
    (i32.const 0))
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

  assert.notStrictEqual(W.test_lock_owner() >>> 0, M.test_lock_owner() >>> 0,
    `render worker and main guest thread share lock owner id ${M.test_lock_owner() >>> 0}`);

  // The guest holds the virtual-map lock; the render worker must find it held.
  M.test_lock_take();
  const decision = W.test_lock_try();
  assert.notStrictEqual(decision, 2, 'render worker recursed into the guest thread\'s LOCK_VIRTUAL_MAP');
  assert.strictEqual(decision, 0, 'render worker should see LOCK_VIRTUAL_MAP held');
  M.test_lock_give();

  // Released, it is the worker's to take, and the guest then waits for it.
  assert.strictEqual(W.test_lock_try(), 1, 'render worker could not take a free lock');
  assert.strictEqual(M.test_lock_try(), 0, 'main thread should see the worker holding the lock');
  W.test_lock_give();

  console.log('PASS test-render-worker-lock-identity');
})().catch(error => { console.error(error); process.exit(1); });

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

// DPA/DSA are opaque comctl32 handles, but their operations are exported only
// through the API dispatcher.  These narrow wrappers drive the real handlers
// while giving each stdcall entry a disposable guest stack.
const extraWat = String.raw`
  (func $test_api_stack
    (global.set $esp (call $w2g (region.addr $GUEST_STACK 524288))))
  (func (export "test_heap_alloc") (param $size i32) (result i32)
    (call $heap_alloc (local.get $size)))

  (func (export "test_dsa_create") (param $size i32) (param $grow i32) (result i32)
    (call $test_api_stack)
    (call $handle_DSA_Create
      (local.get $size) (local.get $grow) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dsa_destroy") (param $dsa i32) (result i32)
    (call $test_api_stack)
    (call $handle_DSA_Destroy
      (local.get $dsa) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dsa_insert")
      (param $dsa i32) (param $index i32) (param $item i32) (result i32)
    (call $test_api_stack)
    (call $handle_DSA_InsertItem
      (local.get $dsa) (local.get $index) (local.get $item)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dsa_get")
      (param $dsa i32) (param $index i32) (param $item i32) (result i32)
    (call $test_api_stack)
    (call $handle_DSA_GetItem
      (local.get $dsa) (local.get $index) (local.get $item)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dsa_get_ptr") (param $dsa i32) (param $index i32) (result i32)
    (call $test_api_stack)
    (call $handle_DSA_GetItemPtr
      (local.get $dsa) (local.get $index) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dsa_delete") (param $dsa i32) (param $index i32) (result i32)
    (call $test_api_stack)
    (call $handle_DSA_DeleteItem
      (local.get $dsa) (local.get $index) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))

  (func (export "test_dpa_create") (param $grow i32) (result i32)
    (call $test_api_stack)
    (call $handle_DPA_Create
      (local.get $grow) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dpa_destroy") (param $dpa i32) (result i32)
    (call $test_api_stack)
    (call $handle_DPA_Destroy
      (local.get $dpa) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dpa_insert")
      (param $dpa i32) (param $index i32) (param $value i32) (result i32)
    (call $test_api_stack)
    (call $handle_DPA_InsertPtr
      (local.get $dpa) (local.get $index) (local.get $value)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dpa_get") (param $dpa i32) (param $index i32) (result i32)
    (call $test_api_stack)
    (call $handle_DPA_GetPtr
      (local.get $dpa) (local.get $index) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dpa_delete") (param $dpa i32) (param $index i32) (result i32)
    (call $test_api_stack)
    (call $handle_DPA_DeletePtr
      (local.get $dpa) (local.get $index) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
  (func (export "test_dpa_delete_all") (param $dpa i32) (result i32)
    (call $test_api_stack)
    (call $handle_DPA_DeleteAllPtrs
      (local.get $dpa) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const view = new DataView(memory.buffer);
  const wasm = guest => e.guest_to_wasm(guest) >>> 0;
  const itemA = e.test_heap_alloc(8) >>> 0;
  const itemB = e.test_heap_alloc(8) >>> 0;
  const itemC = e.test_heap_alloc(8) >>> 0;
  const itemOut = e.test_heap_alloc(8) >>> 0;
  view.setUint32(wasm(itemA), 0x11111111, true);
  view.setUint32(wasm(itemA) + 4, 0xaaaaaaaa, true);
  view.setUint32(wasm(itemB), 0x22222222, true);
  view.setUint32(wasm(itemB) + 4, 0xbbbbbbbb, true);
  view.setUint32(wasm(itemC), 0x33333333, true);
  view.setUint32(wasm(itemC) + 4, 0xcccccccc, true);

  assert.strictEqual(e.test_dsa_create(0, 2), 0,
    'DSA_Create rejects a zero-byte item instead of constructing a corrupt array');
  assert.strictEqual(e.test_dsa_create(0x40000000, 8), 0,
    'DSA_Create rejects overflowing capacity multiplication');
  const dsa = e.test_dsa_create(8, 2) >>> 0;
  assert(dsa, 'DSA_Create returns an opaque live handle');
  assert.strictEqual(e.test_dsa_insert(dsa, 0, itemA), 0);
  assert.strictEqual(e.test_dsa_insert(dsa, 0x7fffffff, itemC), 1);
  assert.strictEqual(e.test_dsa_insert(dsa, 1, itemB), 1,
    'DSA insertion grows storage and shifts the trailing item');
  assert.strictEqual(e.test_dsa_get(dsa, 1, itemOut), 1);
  assert.strictEqual(view.getUint32(wasm(itemOut), true), 0x22222222);
  assert.strictEqual(view.getUint32(wasm(itemOut) + 4, true), 0xbbbbbbbb);
  const dsaItem = e.test_dsa_get_ptr(dsa, 2) >>> 0;
  assert(dsaItem, 'DSA_GetItemPtr returns the third live item');
  assert.strictEqual(view.getUint32(wasm(dsaItem), true), 0x33333333);

  assert.strictEqual(e.test_dsa_destroy(dsa), 1,
    'DSA_Destroy releases a live array');
  assert.strictEqual(e.test_dsa_destroy(dsa), 0,
    'DSA_Destroy rejects a retired handle');
  assert.strictEqual(e.test_dsa_get_ptr(dsa, 0), 0,
    'DSA reads reject a retired handle');
  assert.strictEqual(e.test_dsa_insert(dsa, 0, itemA), -1,
    'DSA writes reject a retired handle');
  assert.strictEqual(e.test_dsa_delete(dsa, 0), 0,
    'DSA deletion rejects a retired handle');
  const recycledDsa = e.test_dsa_create(8, 2) >>> 0;
  assert.strictEqual(recycledDsa, dsa,
    'DSA_Destroy returns the handle block to the process heap');
  assert.strictEqual(e.test_dsa_destroy(recycledDsa), 1);

  assert.strictEqual(e.test_dpa_create(536870912), 0,
    'DPA_Create rejects an overflowing pointer-array allocation');
  const dpa = e.test_dpa_create(2) >>> 0;
  assert(dpa, 'DPA_Create returns an opaque live handle');
  assert.strictEqual(e.test_dpa_insert(dpa, 0, 0x11111111), 0);
  assert.strictEqual(e.test_dpa_insert(dpa, 0x7fffffff, 0x33333333), 1);
  assert.strictEqual(e.test_dpa_insert(dpa, 1, 0x22222222), 1,
    'DPA insertion grows storage and shifts the trailing pointer');
  assert.strictEqual(e.test_dpa_get(dpa, 0) >>> 0, 0x11111111);
  assert.strictEqual(e.test_dpa_get(dpa, 1) >>> 0, 0x22222222);
  assert.strictEqual(e.test_dpa_get(dpa, 2) >>> 0, 0x33333333);

  assert.strictEqual(e.test_dpa_destroy(dpa), 1,
    'DPA_Destroy releases a live array');
  assert.strictEqual(e.test_dpa_destroy(dpa), 0,
    'DPA_Destroy rejects a retired handle');
  assert.strictEqual(e.test_dpa_get(dpa, 0), 0,
    'DPA reads reject a retired handle');
  assert.strictEqual(e.test_dpa_insert(dpa, 0, 1), -1,
    'DPA writes reject a retired handle');
  assert.strictEqual(e.test_dpa_delete(dpa, 0), 0,
    'DPA deletion rejects a retired handle');
  assert.strictEqual(e.test_dpa_delete_all(dpa), 0,
    'DPA_DeleteAllPtrs rejects a retired handle');
  const recycledDpa = e.test_dpa_create(2) >>> 0;
  assert.strictEqual(recycledDpa, dpa,
    'DPA_Destroy returns the handle block to the process heap');
  assert.strictEqual(e.test_dpa_destroy(recycledDpa), 1);

  const arbitrary = 0x1234567c;
  assert.strictEqual(e.test_dsa_destroy(0), 0);
  assert.strictEqual(e.test_dpa_destroy(0), 0);
  assert.strictEqual(e.test_dsa_destroy(arbitrary), 0,
    'DSA rejects an aligned non-heap handle without trapping');
  assert.strictEqual(e.test_dpa_destroy(arbitrary), 0,
    'DPA rejects an aligned non-heap handle without trapping');

  console.log('PASS  comctl32 DPA/DSA own backing storage and retire destroyed handles');
})().catch(error => {
  console.error(error);
  process.exit(1);
});

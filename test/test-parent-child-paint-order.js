#!/usr/bin/env node
'use strict';

// USER must dispatch a dirty parent before a native child whose pixels the
// parent can overwrite. The child remains queued, then repaints after the
// parent's WM_PAINT has propagated its update region down the window tree.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (global $test_order_parent (mut i32) (i32.const 0))
  (global $test_order_child (mut i32) (i32.const 0))

  (func (export "test_order_create") (result i32)
    (local $parent i32) (local $child i32)
    (local.set $parent (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $host_register_dialog_frame
      (local.get $parent) (i32.const 0)
      (i32.const 0) (i32.const 200) (i32.const 80) (i32.const 0))
    ;; An application-owned parent: present in USER's window table, but not
    ;; registered as one of the WAT-native built-in control classes.
    (call $wnd_table_set (local.get $parent) (i32.const 0x00401000))
    (drop (call $wnd_set_style (local.get $parent) (i32.const 0x90000000)))
    (local.set $child (call $ctrl_create_child
      (local.get $parent) (i32.const 4) (i32.const 101)
      (i32.const 0) (i32.const 0) (i32.const 180) (i32.const 24)
      (i32.const 0x50000000) (i32.const 0)))
    (global.set $test_order_parent (local.get $parent))
    (global.set $test_order_child (local.get $child))
    (local.get $parent))

  (func (export "test_order_child") (result i32)
    (global.get $test_order_child))

  (func (export "test_order_clear")
    (call $paint_flag_clear_hwnd (global.get $test_order_parent))
    (call $update_clear_hwnd (global.get $test_order_parent))
    (call $paint_flag_clear_hwnd (global.get $test_order_child))
    (call $update_clear_hwnd (global.get $test_order_child)))

  (func (export "test_order_queue_both")
    (call $paint_flag_set_inv (global.get $test_order_parent))
    (call $paint_flag_set_inv (global.get $test_order_child)))

  (func (export "test_order_drain_native") (result i32)
    (call $paint_drain_native_control_paints))

  (func (export "test_order_select") (result i32)
    (call $paint_select_next_dirty))

  (func (export "test_order_clear_parent")
    (call $paint_flag_clear_hwnd (global.get $test_order_parent))
    (drop (call $paint_seed_child_paints (global.get $test_order_parent)))
    (call $update_clear_hwnd (global.get $test_order_parent)))

  (func (export "test_order_first_pending") (result i32)
    (call $paint_flag_first))

  (func (export "test_order_update") (param $hwnd i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_UpdateWindow (local.get $hwnd)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp)))
  (func (export "test_order_partial_child")
    (call $update_invalidate_rect (global.get $test_order_child)
      (i32.const 3) (i32.const 4) (i32.const 12) (i32.const 15)))
  (func (export "test_order_update_rect") (param $dst i32) (result i32)
    (call $update_get_rect (global.get $test_order_child) (call $g2w (local.get $dst))))

  (func (export "test_cycle_parent") (result i32)
    (local $a i32) (local $b i32)
    (local.set $a (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (local.set $b (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $a) (i32.const 0x00401000))
    (call $wnd_table_set (local.get $b) (i32.const 0x00401000))
    (drop (call $wnd_set_style (local.get $a) (i32.const 0x10000000)))
    (drop (call $wnd_set_style (local.get $b) (i32.const 0x10000000)))
    (call $wnd_set_parent (local.get $a) (local.get $b))
    ;; This second edge would close a -> b -> a. It must be rejected.
    (call $wnd_set_parent (local.get $b) (local.get $a))
    (call $wnd_get_parent (local.get $b)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat });
  const parent = e.test_order_create() >>> 0;
  const child = e.test_order_child() >>> 0;
  assert(parent && child, 'parent/child window tree should exist');

  e.test_order_clear();
  e.test_order_queue_both();
  assert.strictEqual(e.test_order_drain_native(), 0,
    'native child must wait while an application-owned ancestor is dirty');
  assert.strictEqual(e.test_order_select() >>> 0, parent,
    'the application-owned ancestor is the next WM_PAINT target');

  e.test_order_clear_parent();
  assert.strictEqual(e.test_order_drain_native(), 1,
    'native child paints after the ancestor update is consumed');
  assert.strictEqual(e.test_order_first_pending() >>> 0, 0,
    'parent and child paint state should be fully consumed');

  e.test_order_clear();
  e.test_order_update(child);
  assert.strictEqual(e.test_order_first_pending(), 0,
    'UpdateWindow on a clean window must not invent pending paint');
  const rect = e.guest_alloc(16);
  assert.strictEqual(e.test_order_update_rect(rect), 0,
    'UpdateWindow on a clean window must leave its update region empty');
  e.test_order_partial_child();
  e.test_order_update(child);
  assert.strictEqual(e.test_order_update_rect(rect), 1);
  assert.deepStrictEqual([0, 4, 8, 12].map(o => e.guest_read32(rect + o)),
    [3, 4, 12, 15], 'deferred native UpdateWindow must not expand a partial update');
  e.test_order_clear();

  // A real guest callback proves the clean-window case sends no message,
  // while an existing update still follows the synchronous guest path.
  const calls = e.guest_alloc(4);
  const proc = e.guest_alloc(16);
  e.guest_write32(calls, 0);
  // cmp dword [esp+8],WM_PAINT; jne ret; inc dword [calls]; ret 16
  const code = [0x83, 0x7c, 0x24, 0x08, 0x0f, 0x75, 0x06,
    0xff, 0x05, calls & 255, (calls >>> 8) & 255,
    (calls >>> 16) & 255, calls >>> 24, 0xc2, 0x10, 0x00];
  for (let i = 0; i < code.length; i += 4) {
    e.guest_write32(proc + i, code[i] | code[i + 1] << 8 |
      code[i + 2] << 16 | code[i + 3] << 24);
  }
  e.wnd_table_set(parent, proc);
  e.test_order_update(parent);
  assert.strictEqual(e.guest_read32(calls), 0,
    'clean UpdateWindow must not enter the guest window procedure');
  e.test_order_queue_both();
  e.test_order_update(parent);
  assert.strictEqual(e.guest_read32(calls), 1,
    'dirty UpdateWindow must enter the guest procedure before returning');
  e.test_order_clear();

  assert.strictEqual(e.test_cycle_parent(), 0,
    'window parenting rejects an edge that would create a cycle');

  console.log('PASS  parent-first paint order and bounded ancestor traversal');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

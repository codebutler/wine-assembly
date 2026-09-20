#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = `
  (func (export "test_init")
    (global.set $WIN16_THUNK_SEL (call $win16_index_to_sel (i32.const 3)))
    (call $win16_seg_set (i32.const 1) (i32.const 0x100000) (i32.const 65536) (i32.const 0) (i32.const 1))
    (call $win16_seg_set (i32.const 2) (i32.const 0x110000) (i32.const 65536) (i32.const 1) (i32.const 2))
    (call $win16_seg_set (i32.const 3) (i32.const 0x120000) (i32.const 65536) (i32.const 0) (i32.const 3))
    (global.set $code16 (i32.const 1))
    (call $win16_set_sreg (i32.const 1) (call $win16_index_to_sel (i32.const 1)))
    (call $win16_set_sreg (i32.const 2) (call $win16_index_to_sel (i32.const 2))))
  (func (export "test_window") (param $proc i32) (result i32)
    (local $h i32)
    (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $h) (i32.or (i32.const 0x000f0000) (local.get $proc)))
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x10000000)))
    (call $client_rect_set (local.get $h) (i32.const 3) (i32.const 4) (i32.const 116) (i32.const 218))
    (local.get $h))
  (func (export "test_narrow") (param $h i32) (result i32) (call $win16_h16 (local.get $h)))
  (func (export "test_as_child") (param $h i32) (param $parent i32)
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x50000000)))
    (call $wnd_set_parent (local.get $h) (local.get $parent))
    (call $ctrl_geom_sync (local.get $h) (i32.const 7) (i32.const 26)
      (i32.const 120) (i32.const 230) (i32.const 8)))
  (func (export "test_thunk") (result i32)
    (call $win16_thunk_for (i32.const 2) (i32.const 107) (i32.const 0)))
  (func (export "test_set_thunk") (result i32)
    (call $win16_thunk_for (i32.const 2) (i32.const 232) (i32.const 0)))
  (func (export "test_destroy_thunk") (result i32)
    (call $win16_thunk_for (i32.const 2) (i32.const 53) (i32.const 0)))
  (func (export "test_call") (param $h i32) (param $pointer i32) (param $caller i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (call $gs32 (i32.const 0x110804) (local.get $pointer))
    (call $gs16 (i32.const 0x110808) (i32.const 0))
    (call $gs16 (i32.const 0x11080a) (i32.const 0x47))
    (call $gs16 (i32.const 0x11080c) (call $win16_h16 (local.get $h)))
    (call $win16_DefWindowProc))
  (func (export "test_result") (result i32) (i32.load (global.get $reg_base)))
  (func (export "test_set") (param $h i32) (param $flags i32) (param $caller i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (call $gs16 (i32.const 0x110804) (local.get $flags))
    (call $gs16 (i32.const 0x110806) (i32.const 40))
    (call $gs16 (i32.const 0x110808) (i32.const 30))
    (call $gs16 (i32.const 0x11080a) (i32.const 2))
    (call $gs16 (i32.const 0x11080c) (i32.const 1))
    (call $gs16 (i32.const 0x11080e) (i32.const 0))
    (call $gs16 (i32.const 0x110810) (call $win16_h16 (local.get $h)))
    (call $win16_SetWindowPos))
  (func (export "test_move") (param $h i32) (param $repaint i32) (param $caller i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0x000f))
    (call $gs16 (i32.const 0x110804) (local.get $repaint))
    (call $gs16 (i32.const 0x110806) (i32.const 40))
    (call $gs16 (i32.const 0x110808) (i32.const 30))
    (call $gs16 (i32.const 0x11080a) (i32.const 2))
    (call $gs16 (i32.const 0x11080c) (i32.const 1))
    (call $gs16 (i32.const 0x11080e) (call $win16_h16 (local.get $h)))
    (call $win16_MoveWindow))
  (func (export "test_dirty") (param $h i32) (result i32)
    (call $update_get_rect (local.get $h) (i32.const 0)))
  (func (export "test_damage") (param $h i32) (param $erase i32)
    (call $update_invalidate_rect (local.get $h) (i32.const 3) (i32.const 4) (i32.const 12) (i32.const 15))
    (call $paint_flag_set (local.get $h))
    (if (local.get $erase) (then (call $nc_flags_set (local.get $h) (i32.const 2)))))
  (func (export "test_visible") (param $h i32) (param $visible i32)
    (drop (call $wnd_set_style (local.get $h) (select (i32.const 0x10000000) (i32.const 0) (local.get $visible)))))
  (func (export "test_update") (param $h i32) (param $caller i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0xf))
    (call $gs16 (i32.const 0x110804) (call $win16_h16 (local.get $h)))
    (call $win16_UpdateWindow))
  (func (export "test_user_thunk") (param $ordinal i32) (result i32)
    (call $win16_thunk_for (i32.const 2) (local.get $ordinal) (i32.const 0)))
  (func (export "test_show") (param $h i32) (param $cmd i32) (param $caller i32)
    (call $post_queue_reset)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0xf))
    (call $gs16 (i32.const 0x110804) (local.get $cmd))
    (call $gs16 (i32.const 0x110806) (call $win16_h16 (local.get $h)))
    (call $win16_ShowWindow))
  (func (export "test_post_count") (result i32) (call $post_queue_total_count))
  (func (export "test_post_msg") (param $i i32) (result i32)
    (call $post_queue_peek_field (local.get $i) (i32.const 1)))
  (func (export "test_begin_core") (param $h i32) (result i32)
    (i32.store (global.get $reg_base) (i32.const 0x12345678))
    (i32.store offset=8 (global.get $reg_base) (i32.const 0x23456789))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (drop (call $begin_paint_core (local.get $h) (i32.const 0x110e00) (i32.const 1)))
    (i32.and
      (i32.eq (i32.load (global.get $reg_base)) (i32.const 0x12345678))
      (i32.and
        (i32.eq (i32.load offset=8 (global.get $reg_base)) (i32.const 0x23456789))
        (i32.eq (i32.load offset=16 (global.get $reg_base)) (i32.const 0x110800)))))
  (func (export "test_begin16") (param $h i32) (param $caller i32)
    (call $gs32 (global.get $GUEST_STACK) (i32.const 0x76543210))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (local.get $caller))
    (call $gs16 (i32.const 0x110802) (i32.const 0xf))
    (call $gs32 (i32.const 0x110804) (i32.const 0x00170e00))
    (call $gs16 (i32.const 0x110808) (call $win16_h16 (local.get $h)))
    (call $win16_BeginPaint))
  (func (export "test_bridge_scratch") (result i32) (call $gl32 (global.get $GUEST_STACK)))
  (func (export "test_background") (param $h i32) (param $brush i32)
    (call $wnd_set_bg_brush (local.get $h) (local.get $brush)))
  (func (export "test_expose_children") (param $h i32)
    (call $win16_rearm_visible_child_erases (local.get $h)))
  (func (export "test_erase_pending") (param $h i32) (result i32)
    (i32.and (call $nc_flags_test (local.get $h)) (i32.const 2)))
  (func (export "test_alive") (param $h i32) (result i32)
    (i32.ge_s (call $wnd_table_find (local.get $h)) (i32.const 0)))
`;

// Pascal far wndproc, recording {message,wParam,lParam} into SS:0904.
// BP makes the layout explicit; preserve BX/BP across nested callbacks.
function recorder(extra = []) {
  return [0x55, 0x89, 0xe5, 0x53,
    0x36, 0x8b, 0x1e, 0x00, 0x09, 0xc1, 0xe3, 0x03,
    0x8b, 0x46, 0x0c, 0x36, 0x89, 0x87, 0x04, 0x09,
    0x8b, 0x46, 0x0a, 0x36, 0x89, 0x87, 0x06, 0x09,
    0x66, 0x8b, 0x46, 0x06, 0x36, 0x66, 0x89, 0x87, 0x08, 0x09,
    0x36, 0xff, 0x06, 0x00, 0x09,
    ...extra, 0x5b, 0x5d, 0x31, 0xc0, 0x31, 0xd2, 0xca, 0x0a, 0x00];
}
const word = n => [n & 255, (n >>> 8) & 255];
const pack = (x, y) => ((x & 0xffff) | (y << 16)) >>> 0;
(async () => {
  const rectangles = new Map(), moves = [], orders = [];
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', extraHostOverrides: {
    get_window_rect: (hwnd, out) => {
      // Deliberately distinct outer and client geometry, including negatives.
      for (const [i, n] of (rectangles.get(hwnd) || [-20, -30, 200, 300]).entries()) view.setInt32(out + i * 4, n, true);
    },
    move_window: (hwnd, x, y, w, h, flags) => {
      const old = rectangles.get(hwnd) || [-20, -30, 200, 300];
      const nx = flags & 2 ? old[0] : x, ny = flags & 2 ? old[1] : y;
      const nw = flags & 1 ? old[2] - old[0] : w, nh = flags & 1 ? old[3] - old[1] : h;
      rectangles.set(hwnd, [nx, ny, nx + nw, ny + nh]);
      moves.push({ hwnd, x, y, w, h, flags });
    },
    set_window_zorder: (hwnd, after) => orders.push([hwnd, after]),
    get_window_client_size: hwnd => {
      const r = rectangles.get(hwnd) || [-20, -30, 200, 300];
      return pack(r[2] - r[0], r[3] - r[1]);
    },
  }});
  const view = new DataView(memory.buffer);
  e.test_init();
  const writeCode = (offset, code) => code.forEach((b, i) => e.guest_write8(0x100000 + offset + i, b));
  writeCode(0x200, recorder());
  const hwnd = e.test_window(0x200);
  const pointer = 0x00170a00; // SS:0A00, not a flat address
  const flagsAt = 0x110a0c;
  // Poison WINDOWPOS's geometry: messages must describe committed client
  // geometry, not replay these outer-window request fields.
  for (let i = 0; i < 32; i += 4) e.guest_write32(0x110a00 + i, 0x33333333);
  const run = (target, flags, caller) => {
    e.guest_write32(flagsAt, 0xbeef0000 | flags);
    e.guest_write32(0x110900, 0);
    writeCode(caller, [0xeb, 0xfe]);
    e.test_call(target, pointer, caller);
    e.set_bp(0x100000 + caller);
    for (let i = 0; e.get_eip() !== 0x100000 + caller && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100000 + caller, 'returns to original far caller');
    assert.strictEqual(e.get_esp(), 0x11080e, 'all Pascal and continuation frames consumed');
    assert.strictEqual(e.test_result(), 0);
    assert.strictEqual(e.guest_read32(flagsAt) >>> 0, (0xbeef0000 | flags) >>> 0, 'input and adjacent guard unchanged');
    return Array.from({ length: e.guest_read32(0x110900) }, (_, i) => ({
      msg: e.guest_read32(0x110904 + i * 8) & 0xffff,
      wp: e.guest_read32(0x110904 + i * 8) >>> 16,
      lp: e.guest_read32(0x110908 + i * 8) >>> 0,
    }));
  };
  const move = { msg: 3, wp: 0, lp: pack(-17, -26) };
  const size = { msg: 5, wp: 0, lp: pack(113, 214) };
  assert.deepStrictEqual(run(hwnd, 0, 0x40), [move, size]);
  assert.deepStrictEqual(run(hwnd, 1, 0x50), [move], 'NOSIZE suppresses only size');
  assert.deepStrictEqual(run(hwnd, 2, 0x60), [size], 'NOMOVE suppresses only move');
  assert.deepStrictEqual(run(hwnd, 3, 0x70), [], 'both flags suppress both messages');

  const child = e.test_window(0x200);
  e.test_as_child(child, hwnd);
  assert.deepStrictEqual(run(child, 0, 0x90), [
    { msg: 3, wp: 0, lp: pack(10, 30) }, size,
  ], 'child move is relative to parent client origin');

  // On the outer WM_MOVE, call DefWindowProc for another window with NOMOVE.
  // Its callback must finish before the outer sequence resumes at WM_SIZE.
  const inner = e.test_window(0x200), narrow = e.test_narrow(inner), thunk = e.test_thunk();
  e.guest_write32(0x110b0c, 2);
  const nestedCall = [0x68, ...word(narrow), 0x68, 0x47, 0, 0x6a, 0,
    0x68, 0x17, 0, 0x68, 0x00, 0x0b, 0x9a, ...word(thunk), 0x1f, 0];
  writeCode(0x300, recorder([0x83, 0x7e, 0x0c, 3, 0x75, nestedCall.length, ...nestedCall]));
  const outer = e.test_window(0x300);
  assert.deepStrictEqual(run(outer, 0, 0x80), [move, size, size], 'nested callbacks retain independent flags and stages');

  const mutation = [0x8b, 0x5e, 0x06, // bx = WINDOWPOS offset in SS
    ...[[0, 0xdead], [2, 1], [4, -7], [6, -9], [8, 53], [10, 64], [12, 8]]
      .flatMap(([offset, value]) => [0x36, 0xc7, 0x47, offset, ...word(value)])];
  const mutateChanging = [0x83, 0x7e, 0x0c, 0x46, 0x75, mutation.length, ...mutation];
  const chain = [0xff, 0x76, 0x0e, 0xff, 0x76, 0x0c, 0xff, 0x76, 0x0a,
    0xff, 0x76, 0x08, 0xff, 0x76, 0x06, 0x9a, ...word(thunk), 0x1f, 0];
  const chainChanged = [0x83, 0x7e, 0x0c, 0x47, 0x75, chain.length, ...chain];
  writeCode(0x400, recorder(mutateChanging));
  writeCode(0x500, recorder([...mutateChanging, ...chainChanged]));
  const consuming = e.test_window(0x400), chaining = e.test_window(0x500);
  const runSet = (target, flags, caller, result = 1, isMove = false) => {
    e.guest_write32(0x110900, 0); moves.length = 0; orders.length = 0;
    writeCode(caller, [0xeb, 0xfe]);
    (isMove ? e.test_move : e.test_set)(target, flags, caller);
    if (isMove || !(flags & 0x400)) assert.deepStrictEqual(moves, [], 'changing runs before any geometry is committed');
    e.set_bp(0x100000 + caller);
    for (let i = 0; e.get_eip() !== 0x100000 + caller && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100000 + caller);
    assert.strictEqual(e.get_esp(), isMove ? 0x110810 : 0x110812, 'positioning continuation and Pascal frame restored');
    assert.strictEqual(e.test_result(), result);
    return Array.from({ length: e.guest_read32(0x110900) }, (_, i) => e.guest_read32(0x110904 + i * 8) & 0xffff);
  };
  assert.deepStrictEqual(runSet(consuming, 0x14, 0xa0), [0x46, 0x47], 'consuming changed gets no synthetic move/size');
  assert.deepStrictEqual(moves, [{ hwnd: consuming, x: -7, y: -9, w: 53, h: 64, flags: 0x18 }]);
  assert.deepStrictEqual(orders, [[consuming, 1]], 'far changing callback can replace insertion target');
  const beforePointer = e.guest_read32(0x110908) >>> 0, afterPointer = e.guest_read32(0x110910) >>> 0;
  assert.strictEqual(beforePointer, afterPointer, 'both notifications share the invocation-owned WINDOWPOS');
  assert.strictEqual(beforePointer >>> 16, 0x17, 'WINDOWPOS is a far pointer in the task stack segment');
  const wp = 0x110000 + (afterPointer & 0xffff);
  assert.strictEqual(e.guest_read32(wp) & 0xffff, e.test_narrow(consuming), 'callback cannot replace the target HWND');
  assert.strictEqual(e.guest_read32(wp + 12) & 0xffff, 0x18, 'changed sees committed flags');
  assert.deepStrictEqual(runSet(chaining, 0x14, 0xb0), [0x46, 0x47, 3, 5], 'default processing alone derives geometry messages');
  assert.deepStrictEqual(runSet(chaining, 0x418, 0xc0), [0x47, 3, 5], 'NOSENDCHANGING skips only changing');
  assert.deepStrictEqual(moves, [{ hwnd: chaining, x: 1, y: 2, w: 30, h: 40, flags: 0x418 }]);
  assert.deepStrictEqual(runSet(chaining, 0x418, 0xd0), [0x47], 'unchanged geometry suppresses derived move/size');

  const setThunk = e.test_set_thunk();
  const nestedSet = [e.test_narrow(consuming), 0, 5, 6, 7, 8, 0x14]
    .flatMap(value => [0x68, ...word(value)]);
  nestedSet.push(0x9a, ...word(setThunk), 0x1f, 0);
  writeCode(0x600, recorder([...mutateChanging,
    0x83, 0x7e, 0x0c, 0x46, 0x75, nestedSet.length, ...nestedSet]));
  const nestedOuter = e.test_window(0x600);
  assert.deepStrictEqual(runSet(nestedOuter, 0x14, 0xe0), [0x46, 0x46, 0x47, 0x47],
    'nested SetWindowPos completes before the outer changing callback returns');
  assert.deepStrictEqual(moves.map(({ hwnd, x, y, w, h }) => [hwnd, x, y, w, h]),
    [[consuming, -7, -9, 53, 64], [nestedOuter, -7, -9, 53, 64]], 'nested WINDOWPOS cannot overwrite outer mutations');
  const pointers = Array.from({ length: 4 }, (_, i) => e.guest_read32(0x110908 + i * 8) >>> 0);
  assert.strictEqual(pointers[0], pointers[3]);
  assert.strictEqual(pointers[1], pointers[2]);
  assert.notStrictEqual(pointers[0], pointers[1], 'nested transactions own distinct far structures');
  const destroyThunk = e.test_destroy_thunk();
  const destroy = [0xff, 0x76, 0x0e, 0x9a, ...word(destroyThunk), 0x1f, 0];
  writeCode(0x700, recorder([0x83, 0x7e, 0x0c, 0x46, 0x75, destroy.length, ...destroy]));
  const doomed = e.test_window(0x700);
  const destroyedMessages = runSet(doomed, 0x14, 0xf0, 0);
  assert.strictEqual(destroyedMessages[0], 0x46);
  assert(!destroyedMessages.includes(0x47), 'destroying the target during changing cancels changed');
  assert.deepStrictEqual(moves, [], 'destroyed target is never moved');
  assert.deepStrictEqual(orders, [], 'destroyed target is never reordered');
  const moveConsuming = e.test_window(0x400), moveChaining = e.test_window(0x500);
  assert.deepStrictEqual(runSet(moveConsuming, 1, 0x100, 1, true), [0x46, 0x47], 'MoveWindow allows consuming CHANGED');
  assert.deepStrictEqual(moves, [{ hwnd: moveConsuming, x: -7, y: -9, w: 53, h: 64, flags: 0x18 }]);
  assert.deepStrictEqual(orders, [[moveConsuming, 1]], 'MoveWindow honors callback-enabled Z-order');
  assert.deepStrictEqual(runSet(moveChaining, 1, 0x110, 1, true), [0x46, 0x47, 3, 5]);
  const mixedOuter = e.test_window(0x600);
  assert.deepStrictEqual(runSet(mixedOuter, 1, 0x170, 1, true), [0x46, 0x46, 0x47, 0x47],
    'MoveWindow retains its own mode across a nested SetWindowPos');
  assert.deepStrictEqual(moves.map(move => move.hwnd), [consuming, mixedOuter]);
  writeCode(0x800, recorder(chainChanged));
  const noRepaint = e.test_window(0x800), repaint = e.test_window(0x800);
  assert.deepStrictEqual(runSet(noRepaint, 0, 0x120, 1, true), [0x46, 0x47, 3, 5]);
  assert.strictEqual(moves[0].flags, 0x1c, 'MoveWindow(FALSE) begins with NOREDRAW');
  assert.strictEqual(e.test_dirty(noRepaint), 0, 'NOREDRAW creates no update region');
  assert.deepStrictEqual(runSet(repaint, 1, 0x130, 1, true), [0x46, 0x47, 3, 5, 0x0f],
    'MoveWindow(TRUE) sends paint after geometry, without erasing before BeginPaint');
  assert.strictEqual(moves[0].flags, 0x14, 'MoveWindow(TRUE) enables repaint');
  assert.strictEqual(e.test_dirty(repaint), 1, 'a wndproc that never calls BeginPaint does not validate damage');
  const moveDoomed = e.test_window(0x700);
  assert(!runSet(moveDoomed, 1, 0x140, 0, true).includes(0x47));
  assert.deepStrictEqual(moves, [], 'destroyed MoveWindow target is not committed');
  for (const [i, target] of [0, 0x76543210].entries()) {
    assert.deepStrictEqual(runSet(target, 1, 0x150 + i * 16, 0, true), []);
    assert.deepStrictEqual(moves, [], 'native bridge preserves invalid MoveWindow failure');
  }
  const runUpdate = (target, caller) => {
    e.guest_write32(0x110900, 0);
    writeCode(caller, [0xeb, 0xfe]);
    e.test_update(target, caller);
    e.set_bp(0x100000 + caller);
    for (let i = 0; e.get_eip() !== 0x100000 + caller && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100000 + caller);
    assert.strictEqual(e.get_esp(), 0x110806, 'UpdateWindow consumes only its own Pascal and continuation frames');
    return Array.from({ length: e.guest_read32(0x110900) }, (_, i) => e.guest_read32(0x110904 + i * 8) & 0xffff);
  };
  const clean = e.test_window(0x200);
  assert.deepStrictEqual(runUpdate(clean, 0x180), [], 'clean UpdateWindow does not send paint');
  assert.strictEqual(e.test_dirty(clean), 0, 'clean UpdateWindow must not invent damage');
  const begin = e.test_user_thunk(39), end = e.test_user_thunk(40), update = e.test_user_thunk(124);
  const paintCall = thunk => [0xff, 0x76, 0x0e, 0x16, 0x8d, 0x46, 0xde, 0x50,
    0x9a, ...word(thunk), 0x1f, 0];
  const paintBody = nested => [0x83, 0xec, 32, ...paintCall(begin), 0x36, 0xa3, 0x08, 0x0d,
    ...[0, 1, 2, 3].flatMap(i => [0x8b, 0x46, 0xe2 + i * 2, 0x36, 0xa3, ...word(0xd00 + i * 2)]),
    ...nested, ...paintCall(end), 0x83, 0xc4, 32];
  const paintProc = nested => {
    const body = paintBody(nested);
    return recorder([0x83, 0x7e, 0x0c, 0x0f, 0x75, body.length, ...body]);
  };
  writeCode(0x900, paintProc([]));
  const painter = e.test_window(0x900);
  e.test_damage(painter, 0);
  assert.deepStrictEqual(runUpdate(painter, 0x190), [0x0f], 'dirty UpdateWindow completes real BeginPaint/EndPaint before return');
  assert.strictEqual(e.test_dirty(painter), 0);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => (e.guest_read32(0x110d00 + i * 2) & 0xffff)), [3, 4, 12, 15],
    'BeginPaint sees the original partial region, not an expanded client');
  assert.deepStrictEqual(runUpdate(painter, 0x1a0), [], 'completed paint is not delivered again');
  e.test_damage(painter, 1);
  assert.deepStrictEqual(runUpdate(painter, 0x1b0), [0x0f, 0x14], 'pending erase is sent from BeginPaint inside paint');
  assert.strictEqual(e.guest_read32(0x11090c) >>> 16, e.guest_read32(0x110d08) & 0xffff,
    'WM_ERASEBKGND receives the actual returned, narrowed paint DC');
  const innerPaint = e.test_window(0x900);
  const nestedUpdate = [0x68, ...word(e.test_narrow(innerPaint)), 0x9a, ...word(update), 0x1f, 0,
    0x36, 0xff, 0x06, 0x10, 0x0d];
  writeCode(0xa00, paintProc(nestedUpdate));
  const outerPaint = e.test_window(0xa00);
  e.test_damage(innerPaint, 0); e.test_damage(outerPaint, 0);
  e.guest_write32(0x110d10, 0);
  assert.deepStrictEqual(runUpdate(outerPaint, 0x1c0), [0x0f, 0x0f]);
  assert.strictEqual(e.guest_read32(0x110d10), 1, 'outer WM_PAINT resumes after inner UpdateWindow completes');
  assert.strictEqual(e.test_dirty(innerPaint), 0);
  assert.strictEqual(e.test_dirty(outerPaint), 0);
  const movingPainter = e.test_window(0x900);
  assert.deepStrictEqual(runSet(movingPainter, 1, 0x1d0, 1, true), [0x46, 0x47, 0x0f, 0x14]);
  assert.strictEqual(e.test_dirty(movingPainter), 0, 'MoveWindow(TRUE) waits for BeginPaint/EndPaint validation');
  const hidden = e.test_window(0x900);
  e.test_visible(hidden, 0); e.test_damage(hidden, 0);
  assert.deepStrictEqual(runUpdate(hidden, 0x1e0), [], 'hidden window does not paint');
  assert.strictEqual(e.test_dirty(hidden), 1, 'hidden update retains its damage');
  e.test_visible(hidden, 1);
  assert.deepStrictEqual(runUpdate(hidden, 0x1f0), [0x0f]);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110d00 + i * 2) & 0xffff), [3, 4, 12, 15]);
  writeCode(0xb00, recorder([0x83, 0x7e, 0x0c, 0x14, 0x75, destroy.length, ...destroy,
    0x83, 0x7e, 0x0c, 0x0f, 0x75, paintBody([]).length, ...paintBody([])]));
  const eraseDoomed = e.test_window(0xb00);
  e.test_damage(eraseDoomed, 1);
  assert.deepStrictEqual(runUpdate(eraseDoomed, 0x30), [0x0f, 0x14],
    'destruction from the BeginPaint erase callback returns through both nested frames');
  assert.strictEqual(e.test_alive(eraseDoomed), 0);
  assert.strictEqual(e.test_erase_pending(eraseDoomed), 0, 'declined erase cannot rearm a destroyed window');
  const runShow = (target, cmd, caller) => {
    e.guest_write32(0x110900, 0);
    writeCode(caller, [0xeb, 0xfe]);
    e.test_show(target, cmd, caller);
    e.set_bp(0x100000 + caller);
    for (let i = 0; e.get_eip() !== 0x100000 + caller && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100000 + caller);
    assert.strictEqual(e.get_esp(), 0x110808, 'ShowWindow restores its Pascal and nested callback frames');
    assert(!Array.from({length: e.test_post_count()}, (_, i) => e.test_post_msg(i)).includes(0x14),
      'ShowWindow must not leave a posted erase to overwrite later UpdateWindow painting');
    return Array.from({length: e.guest_read32(0x110900)}, (_, i) => e.guest_read32(0x110904 + i * 8) & 0xffff);
  };
  const showing = e.test_window(0x900);
  e.test_visible(showing, 0);
  assert.deepStrictEqual(runShow(showing, 1, 0x40), [0x14], 'initial erase completes before ShowWindow returns');
  assert.strictEqual(e.test_erase_pending(showing), 2, 'ShowWindow retains a declined erase for BeginPaint');
  assert.deepStrictEqual(runUpdate(showing, 0x50), [0x0f, 0x14]);
  assert.strictEqual(e.test_dirty(showing), 0);
  assert.deepStrictEqual(runShow(showing, 1, 0x60), [], 'showing an already visible window does not repeat initial erase');
  const updateSelf = [0xff, 0x76, 0x0e, 0x9a, ...word(update), 0x1f, 0];
  const handledShow = recorder([0x83, 0x7e, 0x0c, 5, 0x75, updateSelf.length, ...updateSelf,
    0x83, 0x7e, 0x0c, 0x0f, 0x75, paintBody([]).length, ...paintBody([])]);
  handledShow.splice(-7, 2, 0xb8, 1, 0); // return AX=1, DX=0: erase handled
  writeCode(0xc00, handledShow);
  const showNested = e.test_window(0xc00);
  e.test_visible(showNested, 0);
  assert.deepStrictEqual(runShow(showNested, 3, 0x70), [5, 0x0f, 0x14],
    'UpdateWindow inside maximize consumes initial erase; ShowWindow must not erase again afterward');
  assert.strictEqual(e.test_dirty(showNested), 0);
  const corePaint = e.test_window(0x900);
  e.test_damage(corePaint, 0);
  assert.strictEqual(e.test_begin_core(corePaint), 1, 'paint core must not change EAX, EDX or ESP');
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110e08 + 4 * i)), [3, 4, 12, 15]);
  const directPaint = e.test_window(0x900);
  e.test_damage(directPaint, 0);
  e.guest_write32(0x110dfe, 0xabcdef01);
  e.guest_write32(0x110e20, 0x13579bdf);
  e.test_begin16(directPaint, 0x80);
  assert.strictEqual(e.get_eip(), 0x100080);
  assert.strictEqual(e.get_esp(), 0x11080a, 'BeginPaint consumes exactly six Pascal argument bytes');
  assert.strictEqual(e.test_bridge_scratch(), 0x76543210, 'Win16 BeginPaint must not overwrite shared bridge scratch');
  assert.strictEqual(e.guest_read32(0x110dfe) & 0xffff, 0xef01);
  assert.strictEqual(e.guest_read32(0x110e20), 0x13579bdf);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110e04 + 2 * i) & 0xffff), [3, 4, 12, 15]);
  assert.strictEqual(e.test_result() & 0xffff, e.guest_read32(0x110e00) & 0xffff, 'returned HDC matches narrowed PAINTSTRUCT');

  // Real far callback results use DX:AX. The high-word-only case catches a
  // BOOL-in-AX shortcut; NULL brush alone must not imply fErase=TRUE.
  let ordinal = 0;
  const finishBegin = () => {
    e.set_bp(0x100090);
    for (let i = 0; e.get_eip() !== 0x100090 && i < 30; i++) e.run(100);
    e.set_bp(0);
    assert.strictEqual(e.get_eip(), 0x100090);
    assert.strictEqual(e.get_esp(), 0x11080a);
  };
  writeCode(0x90, [0xeb, 0xfe]);
  for (const handled of [0, 7, 0x10000]) for (const brush of [0, 16]) for (const erase of [0, 1]) {
    const off = 0x2000 + ordinal++ * 128;
    const body = recorder();
    body.splice(-7, 4, 0xb8, ...word(handled), 0xba, ...word(handled >>> 16));
    writeCode(off, body);
    const h = e.test_window(off);
    e.test_background(h, brush);
    e.test_damage(h, erase);
    e.guest_write32(0x110900, 0);
    e.test_begin16(h, 0x90);
    finishBegin();
    assert.strictEqual(e.guest_read32(0x110900), erase, 'only pending erase calls the far wndproc');
    const dc = e.guest_read32(0x110e00) & 0xffff;
    assert(dc);
    assert.strictEqual(e.test_result(), dc);
    if (erase) {
      assert.strictEqual(e.guest_read32(0x110904) & 0xffff, 0x14);
      assert.strictEqual(e.guest_read32(0x110904) >>> 16, dc);
    }
    assert.strictEqual(e.guest_read32(0x110e02) & 0xffff, +(erase && !handled),
      `Win16 fErase: erase=${erase}, brush=${brush}, DX:AX=${handled}`);
    assert.strictEqual(e.test_erase_pending(h), erase && !handled ? 2 : 0);
    assert.strictEqual(e.test_bridge_scratch(), 0x76543210, 'far callback does not borrow global bridge scratch');
    assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110e04 + i * 2) & 0xffff), [3, 4, 12, 15]);
  }
  const successProc = extra => {
    const body = recorder(extra);
    body.splice(-7, 4, 0xb8, 7, 0, 0x31, 0xd2);
    return body;
  };
  // Same-window recursion sees the in-flight erase consumed, not a second
  // callback. Both paint structures and the far return survive nesting.
  writeCode(0x3000, successProc(paintBody([])));
  const recursivePaint = e.test_window(0x3000);
  e.test_damage(recursivePaint, 1);
  e.guest_write32(0x110900, 0);
  e.test_begin16(recursivePaint, 0x90);
  finishBegin();
  assert.strictEqual(e.guest_read32(0x110900), 1);
  assert.strictEqual(e.guest_read32(0x110e02) & 0xffff, 0);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.guest_read32(0x110e04 + i * 2) & 0xffff), [3, 4, 12, 15]);

  // Different-window erasing does recurse: each callback receives its own DC
  // and the inner continuation must not overwrite the outer caller/result.
  writeCode(0x3100, successProc([]));
  const nestedErase = e.test_window(0x3100);
  const innerCall = thunk => [0x68, ...word(e.test_narrow(nestedErase)), 0x16,
    0x8d, 0x46, 0xde, 0x50, 0x9a, ...word(thunk), 0x1f, 0];
  writeCode(0x3200, successProc([0x83, 0xec, 32, ...innerCall(begin),
    0x36, 0xa3, 0x08, 0x0d, ...innerCall(end), 0x83, 0xc4, 32]));
  const outerErase = e.test_window(0x3200);
  e.test_damage(outerErase, 1); e.test_damage(nestedErase, 1);
  e.guest_write32(0x110900, 0);
  e.test_begin16(outerErase, 0x90);
  finishBegin();
  assert.strictEqual(e.guest_read32(0x110900), 2);
  assert.strictEqual(e.guest_read32(0x110904) >>> 16, e.guest_read32(0x110e00) & 0xffff);
  assert.strictEqual(e.guest_read32(0x11090c) >>> 16, e.guest_read32(0x110d08) & 0xffff);
  assert.notStrictEqual(e.guest_read32(0x110904) >>> 16, e.guest_read32(0x11090c) >>> 16);
  assert.strictEqual(e.guest_read32(0x110e02) & 0xffff, 0);
  for (const [i, handled] of [0, 7, 0x10000].entries()) {
    const off = 0x4000 + i * 128;
    const body = recorder();
    body.splice(-7, 4, 0xb8, ...word(handled), 0xba, ...word(handled >>> 16));
    writeCode(off, body);
    const h = e.test_window(off);
    e.test_visible(h, 0);
    assert.deepStrictEqual(runShow(h, 1, 0x90), [0x14]);
    assert.strictEqual(e.test_erase_pending(h), handled ? 0 : 2,
      `ShowWindow uses the complete DX:AX erase result ${handled}`);
    assert.deepStrictEqual(runShow(h, 1, 0x90), []);
    assert.strictEqual(e.test_erase_pending(h), handled ? 0 : 2,
      'showing an already visible window cannot discard a declined erase');
  }
  const invalidate = e.test_user_thunk(125);
  writeCode(0x4300, successProc([0xff, 0x76, 0x0e, 0x6a, 0, 0x6a, 0, 0x6a, 1,
    0x9a, ...word(invalidate), 0x1f, 0]));
  const renewShow = e.test_window(0x4300);
  e.test_visible(renewShow, 0);
  assert.deepStrictEqual(runShow(renewShow, 1, 0x90), [0x14]);
  assert.strictEqual(e.test_erase_pending(renewShow), 2, 'successful show erase preserves callback reinvalidation');

  const show = e.test_user_thunk(42);
  const innerShow = e.test_window(0x4000); // declines erase
  e.test_visible(innerShow, 0);
  writeCode(0x4400, successProc([0x68, ...word(e.test_narrow(innerShow)), 0x6a, 1,
    0x9a, ...word(show), 0x1f, 0]));
  const outerShow = e.test_window(0x4400);
  e.test_visible(outerShow, 0);
  assert.deepStrictEqual(runShow(outerShow, 1, 0x90), [0x14, 0x14]);
  assert.strictEqual(e.test_erase_pending(innerShow), 2);
  assert.strictEqual(e.test_erase_pending(outerShow), 0, 'nested ShowWindow results remain invocation-owned');

  const showDoomed = e.test_window(0xb00);
  e.test_visible(showDoomed, 0);
  assert.deepStrictEqual(runShow(showDoomed, 1, 0x90), [0x14]);
  assert.strictEqual(e.test_alive(showDoomed), 0);
  assert.strictEqual(e.test_erase_pending(showDoomed), 0, 'ShowWindow cannot rearm a destroyed HWND');

  // TriPeaks calls UpdateWindow on itself between BeginPaint and EndPaint.
  // Its old damage must already be gone or that call recursively enters the
  // same paint until the guest stack is exhausted.
  writeCode(0x4500, paintProc([0xff, 0x76, 0x0e, 0x9a, ...word(update), 0x1f, 0]));
  const updateDuringPaint = e.test_window(0x4500);
  e.test_damage(updateDuringPaint, 0);
  assert.deepStrictEqual(runUpdate(updateDuringPaint, 0x90), [0x0f]);
  assert.strictEqual(e.test_dirty(updateDuringPaint), 0);

  // Reinvalidate precisely the snapshot rectangle during painting. EndPaint
  // must not validate that newer request just because its coordinates match.
  writeCode(0x4600, paintProc([0xff, 0x76, 0x0e, 0x16, 0x68, 0x00, 0x0d,
    0x6a, 0, 0x9a, ...word(invalidate), 0x1f, 0]));
  const invalidateDuringPaint = e.test_window(0x4600);
  e.test_damage(invalidateDuringPaint, 0);
  assert.deepStrictEqual(runUpdate(invalidateDuringPaint, 0x90), [0x0f]);
  assert.strictEqual(e.test_dirty(invalidateDuringPaint), 1);
  const exposedParent = e.test_window(0x200);
  const exposedChild = e.test_window(0x4500);
  e.test_as_child(exposedChild, exposedParent);
  e.test_background(exposedChild, 6); // COLOR_WINDOW + 1 is not permission to bypass its wndproc
  e.test_expose_children(exposedParent);
  assert.strictEqual(e.test_erase_pending(exposedChild), 2,
    'exposure retains erasing for the guest callback even with a class brush');
  console.log('PASS Win16 WINDOWPOS mutation/default processing, nested far calls, destruction and stack lifetime');
})().catch(error => { console.error(error); process.exit(1); });

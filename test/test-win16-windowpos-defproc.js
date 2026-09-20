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
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', extraHostOverrides: {
    get_window_rect: (hwnd, out) => {
      // Deliberately distinct outer and client geometry, including negatives.
      for (const [i, n] of [-20, -30, 200, 300].entries()) view.setInt32(out + i * 4, n, true);
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
  console.log('PASS Win16 DefWindowProc WINDOWPOS layout, flags, client geometry and nested far callbacks');
})().catch(error => { console.error(error); process.exit(1); });

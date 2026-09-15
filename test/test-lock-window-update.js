#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const ROOT = 0x10001;
const CHILD = 0x10002;
const OTHER = 0x10010;
const WS_VISIBLE = 0x10000000;
const WS_CHILD = 0x40000000;
const NULLREGION = 1;
const SIMPLEREGION = 2;
const DCX_LOCKWINDOWUPDATE = 0x400;

const extraWat = String.raw`
  (func (export "test_lock_window_update") (param $hwnd i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (global.get $esp))
    (call $handle_LockWindowUpdate
      (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $esp (local.get $saved_esp))
    (global.get $eax))
  (func (export "test_get_dc_ex")
      (param $hwnd i32) (param $hrgn i32) (param $flags i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (global.get $esp))
    (call $handle_GetDCEx
      (local.get $hwnd) (local.get $hrgn) (local.get $flags)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $esp (local.get $saved_esp))
    (global.get $eax))
  (func (export "test_begin_paint") (param $hwnd i32) (param $ps i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (global.get $esp))
    (call $handle_BeginPaint
      (local.get $hwnd) (local.get $ps) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $esp (local.get $saved_esp))
    (global.get $eax))
  (func (export "test_end_paint") (param $hwnd i32) (param $ps i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (global.get $esp))
    (call $handle_EndPaint
      (local.get $hwnd) (local.get $ps) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.set $esp (local.get $saved_esp))
    (global.get $eax))
  (func (export "test_get_clip_box") (param $hdc i32) (param $rect i32) (result i32)
    (call $gdi_dc_clip_get_box (local.get $hdc) (call $g2w (local.get $rect))))
  (func (export "test_redraw_window") (param $hwnd i32) (param $flags i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (global.get $esp))
    (call $handle_RedrawWindow
      (local.get $hwnd) (i32.const 0) (i32.const 0) (local.get $flags)
      (i32.const 0) (i32.const 0))
    (global.set $esp (local.get $saved_esp))
    (global.get $eax))
  (func (export "test_window_update_target") (result i32)
    (i32.atomic.load (global.get $WINDOW_UPDATE_LOCK)))
  (func (export "test_window_update_damaged") (result i32)
    (i32.atomic.load offset=4 (global.get $WINDOW_UPDATE_LOCK)))
  (func (export "test_clear_window_update") (param $hwnd i32)
    (call $paint_flag_clear_hwnd (local.get $hwnd))
    (call $update_clear_hwnd (local.get $hwnd)))
`;

function installTop(h, hwnd, x) {
  h.renderer.createWindow(hwnd, WS_VISIBLE, x, 8, 80, 60, '', 0,
    h.instance, h.memory);
  h.renderer.windows[hwnd].visible = true;
  h.exports.wnd_table_set(hwnd, 0);
  h.exports.wnd_set_style_export(hwnd, WS_VISIBLE);
  h.exports.ctrl_set_geom(hwnd, x, 8, 80, 60);
  h.exports.test_gdi_client_rect_set(hwnd, 0, 0, 80, 60);
}

(async () => {
  const h = await bootRenderHarness({ extraWat, fonts: 'none', width: 200, height: 100 });
  const e = h.exports;
  const rect = e.guest_alloc(16) >>> 0;
  const fill = e.guest_alloc(16) >>> 0;
  const ps = e.guest_alloc(64) >>> 0;
  e.guest_write32(fill + 0, 0);
  e.guest_write32(fill + 4, 0);
  e.guest_write32(fill + 8, 12);
  e.guest_write32(fill + 12, 10);

  installTop(h, ROOT, 8);
  installTop(h, OTHER, 108);
  e.wnd_table_set(CHILD, 0);
  e.wnd_set_style_export(CHILD, WS_CHILD | WS_VISIBLE);
  e.test_wnd_set_parent(CHILD, ROOT);
  e.ctrl_set_geom(CHILD, 4, 5, 30, 20);
  e.test_gdi_client_rect_set(CHILD, 0, 0, 30, 20);

  const rootDc = e.test_call_GetDC(ROOT) >>> 0;
  const childDc = e.test_call_GetDC(CHILD) >>> 0;
  const otherDc = e.test_call_GetDC(OTHER) >>> 0;
  assert(rootDc && childDc && otherDc);
  assert.strictEqual(e.test_get_clip_box(rootDc, rect), SIMPLEREGION);
  assert.strictEqual(e.test_get_clip_box(childDc, rect), SIMPLEREGION);

  const second = await bootRenderHarness({
    extraWat, fonts: 'none', memory: h.memory, width: 200, height: 100,
  });
  assert.strictEqual(e.test_lock_window_update(0x7fffff00), 0,
    'an invalid HWND must not claim the process lock');
  assert.strictEqual(e.test_lock_window_update(ROOT), 1);
  assert.strictEqual(e.test_window_update_target() >>> 0, ROOT);
  assert.strictEqual(second.exports.test_lock_window_update(OTHER), 0,
    'a different Worker instance observes the active shared lock');
  assert.strictEqual(second.exports.test_lock_window_update(ROOT), 1,
    're-locking the same HWND is idempotent');

  assert.strictEqual(e.test_get_clip_box(rootDc, rect), NULLREGION,
    'retained target DC is clipped when the lock begins');
  assert.strictEqual(e.test_get_clip_box(childDc, rect), NULLREGION,
    'the lock covers WS_CHILD descendants');
  assert.strictEqual(e.test_get_clip_box(otherDc, rect), SIMPLEREGION,
    'an unrelated top-level remains drawable');
  const lateChildDc = e.test_call_GetDC(CHILD) >>> 0;
  assert.strictEqual(e.test_get_clip_box(lateChildDc, rect), NULLREGION,
    'GetDC during the lock returns an empty visible region');
  const bypassDc = e.test_get_dc_ex(CHILD, 0, DCX_LOCKWINDOWUPDATE) >>> 0;
  assert(bypassDc);
  assert.strictEqual(e.test_get_clip_box(bypassDc, rect), SIMPLEREGION,
    'DCX_LOCKWINDOWUPDATE bypasses the update lock');
  const paintDc = e.test_begin_paint(ROOT, ps) >>> 0;
  assert(paintDc);
  assert.strictEqual(e.test_get_clip_box(paintDc, rect), NULLREGION,
    'BeginPaint during the lock receives an empty visible region');
  assert.strictEqual(e.test_end_paint(ROOT, ps), 1);
  assert.strictEqual(e.test_window_update_damaged(), 0,
    'acquiring and inspecting locked DCs is not itself drawing');
  assert.strictEqual(e.wnd_get_style_export(ROOT) & WS_VISIBLE, WS_VISIBLE,
    'locking does not clear WS_VISIBLE');
  assert.strictEqual(e.test_lock_window_update(0), 1);
  assert.strictEqual(e.paint_flag_test(ROOT), 0,
    'unlock without attempted drawing creates no update region');
  assert.strictEqual(e.test_get_clip_box(rootDc, rect), SIMPLEREGION,
    'unlock restores retained DC clipping');

  // Seed a known pixel, then prove an ordinary locked fill is suppressed and
  // converted into deferred repaint damage on unlock.
  assert.strictEqual(e.test_get_dc_ex(ROOT, 0, DCX_LOCKWINDOWUPDATE) >>> 0 > 0, true);
  assert.strictEqual(e.test_call_FillRect(rootDc, fill, 0x30010), 1);
  const before = e.test_call_GetPixel(rootDc, 1, 1) >>> 0;
  e.test_clear_window_update(ROOT);
  e.test_clear_window_update(CHILD);
  assert.strictEqual(e.test_lock_window_update(ROOT), 1);
  assert.strictEqual(e.test_get_clip_box(rootDc, rect), NULLREGION);
  assert.strictEqual(e.test_call_FillRect(rootDc, fill, 0x30012), 1);
  assert.strictEqual(e.test_call_GetPixel(rootDc, 1, 1) >>> 0, before,
    'drawing through the locked DC is fully clipped');
  assert.strictEqual(e.test_window_update_damaged(), 1,
    'the clipped draw records deferred damage');
  assert.strictEqual(e.test_lock_window_update(0), 1);
  assert.strictEqual(e.paint_flag_test(ROOT), 1,
    'unlock queues repaint for the locked window');
  assert.strictEqual(e.paint_flag_test(CHILD), 1,
    'unlock propagates repaint to locked descendants');

  e.test_clear_window_update(ROOT);
  e.test_clear_window_update(CHILD);
  assert.strictEqual(e.test_lock_window_update(ROOT), 1);
  const drawThroughDc = e.test_get_dc_ex(ROOT, 0, DCX_LOCKWINDOWUPDATE) >>> 0;
  assert.strictEqual(e.test_call_FillRect(drawThroughDc, fill, 0x30012), 1);
  assert.strictEqual(e.test_window_update_damaged(), 0,
    'drawing through DCX_LOCKWINDOWUPDATE is immediate, not deferred damage');
  assert.strictEqual(e.test_lock_window_update(0), 1);
  assert.strictEqual(e.paint_flag_test(ROOT), 0);

  assert.strictEqual(e.test_lock_window_update(ROOT), 1);
  assert.strictEqual(e.test_call_FillRect(otherDc, fill, 0x30012), 1);
  assert.strictEqual(e.test_window_update_damaged(), 0,
    'drawing in an unrelated top-level does not damage the locked tree');
  assert.strictEqual(e.test_lock_window_update(0), 1);
  assert.strictEqual(e.test_get_dc_ex(0x7fffff00, 0, 0), 0,
    'GetDCEx rejects an invalid non-NULL HWND');

  e.test_clear_window_update(ROOT);
  assert.strictEqual(e.test_redraw_window(ROOT, 0x180), 1);
  assert.strictEqual(e.paint_flag_test(ROOT), 0,
    'RDW_ALLCHILDREN|RDW_UPDATENOW does not invent an invalidation');
  assert.strictEqual(e.test_redraw_window(ROOT, 0x001), 1);
  assert.strictEqual(e.paint_flag_test(ROOT), 1,
    'RDW_INVALIDATE adds update work');
  assert.strictEqual(e.test_redraw_window(ROOT, 0x008), 1);
  assert.strictEqual(e.paint_flag_test(ROOT), 0,
    'RDW_VALIDATE retires the empty non-main update and its paint flag');

  console.log('PASS LockWindowUpdate shares one lock, clips target/children, honors DCX bypass, and repaints only after attempted drawing');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

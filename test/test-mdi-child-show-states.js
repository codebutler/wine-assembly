#!/usr/bin/env node

'use strict';

// An MDI child's minimize, maximize and restore are USER geometry inside the
// MDI client, and restore must put back the rectangle the child had before.
//
// Maximize used to overwrite that rectangle, so the Restore button did
// nothing. Minimize went to the host, which only knows how to minimize a
// top-level window, and the child simply disappeared. mIRC minimizes through
// SetWindowPlacement(SW_SHOWMINNOACTIVE, WPF_SETMINPOSITION at (-100,-100))
// and restores from its switchbar by asking IsIconic, so the placement has to
// make the child iconic and GetWindowPlacement has to report the normal
// rectangle it will come back to.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');

const extraWat = String.raw`
  (func $tmss_make_window (param $parent i32) (param $class i32) (result i32)
    (local $hwnd i32) (local $slot i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (call $ctrl_table_set (local.get $slot) (local.get $class) (i32.const 0))
    (local.get $hwnd))

  (func (export "tmss_make_frame") (result i32)
    (call $tmss_make_window (i32.const 0) (i32.const 0)))

  (func (export "tmss_make_client") (param $frame i32) (result i32)
    (local $client i32) (local $ccs i32) (local $cs i32) (local $result i32)
    (local.set $client (call $tmss_make_window (local.get $frame) (i32.const 33)))
    (local.set $ccs (call $heap_alloc (i32.const 8)))
    (local.set $cs (call $heap_alloc (i32.const 48)))
    (call $gs32 (local.get $ccs) (i32.const 0))
    (call $gs32 (i32.add (local.get $ccs) (i32.const 4)) (i32.const 0xFF00))
    (call $gs32 (local.get $cs) (local.get $ccs))
    (local.set $result (call $mdiclient_wndproc
      (local.get $client) (i32.const 1) (i32.const 0) (local.get $cs)))
    (call $heap_free (local.get $cs))
    (call $heap_free (local.get $ccs))
    (if (i32.eq (local.get $result) (i32.const -1))
      (then (return (i32.const 0))))
    (local.get $client))

  ;; WS_CHILD | WS_VISIBLE | WS_CAPTION | WS_THICKFRAME | min/max boxes.
  (func (export "tmss_make_child") (param $client i32)
      (param $x i32) (param $y i32) (param $w i32) (param $h i32) (result i32)
    (local $child i32)
    (local.set $child (call $tmss_make_window (local.get $client) (i32.const 0)))
    (drop (call $wnd_set_style (local.get $child) (i32.const 0x50CF0000)))
    (drop (call $mdi_child_message
      (local.get $child) (i32.const 1) (i32.const 0) (i32.const 0)))
    (call $host_move_window (local.get $child)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0x14))
    (call $ctrl_geom_sync (local.get $child)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0x14))
    (local.get $child))

  (func (export "tmss_set_client_rect") (param $hwnd i32) (param $w i32) (param $h i32)
    (call $client_rect_set (local.get $hwnd)
      (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)))

  (func (export "tmss_syscommand") (param $child i32) (param $sc i32) (result i32)
    (call $mdi_child_message (local.get $child) (i32.const 0x0112)
      (local.get $sc) (i32.const 0)))

  (func (export "tmss_set_placement") (param $child i32) (param $wp i32) (result i32)
    (call $mdi_child_set_placement (local.get $child) (call $g2w (local.get $wp))))

  (func (export "tmss_get_placement") (param $child i32) (param $wp i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetWindowPlacement (local.get $child) (local.get $wp)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved)))

  (func (export "tmss_x") (param $h i32) (result i32) (call $ctrl_get_x_s (local.get $h)))
  (func (export "tmss_y") (param $h i32) (result i32) (call $ctrl_get_y_s (local.get $h)))
  (func (export "tmss_wh") (param $h i32) (result i32) (call $ctrl_get_wh_packed (local.get $h)))
  (func (export "tmss_iconic") (param $h i32) (result i32) (call $wnd_min_get (local.get $h)))
  (func (export "tmss_zoomed") (param $h i32) (result i32) (call $wnd_max_get (local.get $h)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      set_window_zorder() {},
      activate_window() { return 1; },
    },
  });

  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes USER state');

  const rect = h => {
    const wh = e.tmss_wh(h) >>> 0;
    return { x: e.tmss_x(h), y: e.tmss_y(h), w: wh & 0xFFFF, h: wh >>> 16 };
  };
  const NORMAL = { x: 30, y: 40, w: 200, h: 120 };

  const frame = e.tmss_make_frame() >>> 0;
  const client = e.tmss_make_client(frame) >>> 0;
  assert(client, 'MDICLIENT WM_CREATE allocated its state');
  e.tmss_set_client_rect(client, 400, 300);
  const child = e.tmss_make_child(client, NORMAL.x, NORMAL.y, NORMAL.w, NORMAL.h) >>> 0;
  const other = e.tmss_make_child(client, 60, 70, 150, 90) >>> 0;
  assert.deepStrictEqual(rect(child), NORMAL);

  // Maximize, then restore.
  assert.strictEqual(e.tmss_syscommand(child, 0xF030), 1, 'SC_MAXIMIZE is MDI work');
  assert.deepStrictEqual(rect(child), { x: 0, y: 0, w: 400, h: 300 },
    'a maximized child fills the MDI client');
  assert.strictEqual(e.tmss_syscommand(child, 0xF120), 1, 'SC_RESTORE is MDI work');
  assert.strictEqual(e.tmss_zoomed(child), 0);
  assert.deepStrictEqual(rect(child), NORMAL,
    'SC_RESTORE puts a maximized child back where it was');

  // Minimize: a title bar along the bottom of the client, one slot per icon.
  assert.strictEqual(e.tmss_syscommand(child, 0xF020), 1, 'SC_MINIMIZE is MDI work');
  assert.strictEqual(e.tmss_iconic(child), 1);
  const icon = rect(child);
  assert.strictEqual(icon.x, 0, 'the first icon takes the leftmost slot');
  assert.strictEqual(icon.w, 160);
  assert.strictEqual(icon.y + icon.h, 300, 'the icon sits on the bottom edge');
  assert.strictEqual(e.tmss_syscommand(other, 0xF020), 1);
  assert.strictEqual(rect(other).x, 160, 'a second icon takes the next slot');
  assert.strictEqual(e.tmss_syscommand(other, 0xF120), 1);
  assert.deepStrictEqual(rect(other), { x: 60, y: 70, w: 150, h: 90 });

  // GetWindowPlacement of an icon reports where it will come back to.
  const wp = e.guest_alloc(44) >>> 0;
  const view = () => new DataView(memory.buffer, e.get_guest_base() + wp - e.get_image_base(), 44);
  e.tmss_get_placement(child, wp);
  let v = view();
  assert.strictEqual(v.getInt32(8, true), 2, 'showCmd is SW_SHOWMINIMIZED');
  assert.deepStrictEqual(
    [v.getInt32(28, true), v.getInt32(32, true), v.getInt32(36, true), v.getInt32(40, true)],
    [30, 40, 230, 160], 'rcNormalPosition is the restore rectangle, not the icon');

  // Restoring an icon.
  assert.strictEqual(e.tmss_syscommand(child, 0xF120), 1);
  assert.strictEqual(e.tmss_iconic(child), 0);
  assert.deepStrictEqual(rect(child), NORMAL, 'SC_RESTORE puts an icon back');

  // mIRC's minimize: SW_SHOWMINNOACTIVE with WPF_SETMINPOSITION off the client.
  v = view();
  v.setUint32(0, 44, true);
  v.setUint32(4, 1, true);            // WPF_SETMINPOSITION
  v.setUint32(8, 7, true);            // SW_SHOWMINNOACTIVE
  v.setInt32(12, -100, true); v.setInt32(16, -100, true);
  v.setInt32(20, -1, true); v.setInt32(24, -1, true);
  v.setInt32(28, 30, true); v.setInt32(32, 40, true);
  v.setInt32(36, 230, true); v.setInt32(40, 160, true);
  assert.strictEqual(e.tmss_set_placement(child, wp), 1, 'an MDI child placement is MDI work');
  assert.strictEqual(e.tmss_iconic(child), 1, 'SW_SHOWMINNOACTIVE makes the child iconic');
  assert.deepStrictEqual([rect(child).x, rect(child).y], [-100, -100],
    'WPF_SETMINPOSITION places the icon at ptMinPosition');

  // Its switchbar then restores it with SW_RESTORE.
  v = view();
  v.setUint32(4, 0, true);
  v.setUint32(8, 9, true);            // SW_RESTORE
  assert.strictEqual(e.tmss_set_placement(child, wp), 1);
  assert.strictEqual(e.tmss_iconic(child), 0);
  assert.deepStrictEqual(rect(child), NORMAL, 'SW_RESTORE returns to rcNormalPosition');

  console.log('PASS  MDI child minimize, maximize and restore keep the normal rectangle');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

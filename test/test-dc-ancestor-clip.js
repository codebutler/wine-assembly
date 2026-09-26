#!/usr/bin/env node
'use strict';

// A DC's visible region is clipped to every ancestor's client area, and a
// window's position is measured from its parent's CLIENT origin. So walking
// up the chain has to add each framed ancestor's client offset (caption and
// border) as well as each position.
//
// The walk used to add positions alone. A control inside a captioned child
// was clipped to its grandparent's client area placed one caption too low --
// invisible while the child sat at (0,0), because the error only pushed the
// clip past the bottom, but a child at (-4,-24) (a maximized MDI child) lost
// its top 23 rows: mIRC's Status text never repainted them.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');

const extraWat = String.raw`
  (func (export "tdac_make") (param $parent i32) (param $style i32)
      (param $x i32) (param $y i32) (param $w i32) (param $h i32) (result i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (call $host_move_window (local.get $hwnd)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0x14))
    (call $ctrl_geom_sync (local.get $hwnd)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0x14))
    (call $defwndproc_do_nccalcsize (local.get $hwnd))
    (local.get $hwnd))

  (func (export "tdac_client_rect") (param $hwnd i32) (param $w i32) (param $h i32)
    (call $client_rect_set (local.get $hwnd) (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)))

  (func (export "tdac_client_l") (param $h i32) (result i32) (call $client_rect_get_l (local.get $h)))
  (func (export "tdac_client_t") (param $h i32) (result i32) (call $client_rect_get_t (local.get $h)))

  (func (export "tdac_clip_box") (param $hdc i32) (param $out i32) (result i32)
    (call $gdi_dc_clip_get_box (local.get $hdc) (local.get $out)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });

  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes USER state');

  const WS_CHILD_VISIBLE = 0x50000000;
  const WS_OVERLAPPEDWINDOW_CHILD = 0x50CF0000; // child | visible | caption | thickframe | boxes

  // A top-level window and a plain container filling its client area.
  const top = e.tdac_make(0, 0x10CF0000, 20, 20, 440, 360) >>> 0;
  const container = e.tdac_make(top, WS_CHILD_VISIBLE, 0, 0, 400, 300) >>> 0;
  e.tdac_client_rect(container, 400, 300);

  // A captioned child placed the way a maximized MDI child is: its frame and
  // caption outside the container, its client area exactly on it.
  const probe = e.tdac_make(container, WS_OVERLAPPEDWINDOW_CHILD, 0, 0, 200, 150) >>> 0;
  const l = e.tdac_client_l(probe), t = e.tdac_client_t(probe);
  assert.ok(l > 0 && t > l, `the captioned child has a frame (${l}) and a caption (${t})`);
  const framed = e.tdac_make(container, WS_OVERLAPPEDWINDOW_CHILD,
    -l, -t, 400 + 2 * l, 300 + t + l) >>> 0;

  // A control inside it, at (1,1) of its client area.
  const control = e.tdac_make(framed, WS_CHILD_VISIBLE, 1, 1, 300, 200) >>> 0;
  e.tdac_client_rect(control, 300, 200);

  const box = e.guest_alloc(16) >>> 0;
  const boxWa = e.get_guest_base() + box - e.get_image_base();
  const readBox = () => {
    const v = new DataView(memory.buffer, boxWa, 16);
    return [v.getInt32(0, true), v.getInt32(4, true), v.getInt32(8, true), v.getInt32(12, true)];
  };

  const hdc = e.test_call_GetDC(control) >>> 0;
  assert.ok(hdc, 'GetDC on the control');
  e.tdac_clip_box(hdc, boxWa);
  assert.deepStrictEqual(readBox(), [0, 0, 300, 200],
    'a control inside a framed child at a negative position keeps its whole client area');

  // The same control with its framed parent at (0,0): the container's client
  // area now ends inside the control's bottom-right, and the clip says so.
  const framed2 = e.tdac_make(container, WS_OVERLAPPEDWINDOW_CHILD, 0, 0, 200, 150) >>> 0;
  const inner = e.tdac_make(framed2, WS_CHILD_VISIBLE, 1, 1, 500, 400) >>> 0;
  e.tdac_client_rect(inner, 500, 400);
  const hdc2 = e.test_call_GetDC(inner) >>> 0;
  e.tdac_clip_box(hdc2, boxWa);
  const [, , r2, b2] = readBox();
  // The parent's own client area stops it first: its client is 200-2l wide.
  assert.strictEqual(r2, 200 - 2 * l - 1, 'clipped to the framed parent\'s client width');
  assert.strictEqual(b2, 150 - t - l - 1, 'and to its client height');

  console.log('PASS  a DC is clipped to each ancestor\'s client area through framed parents');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

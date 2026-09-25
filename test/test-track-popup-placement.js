#!/usr/bin/env node
'use strict';

// TrackPopupMenu anchors the popup to the point by its TPM_*ALIGN flags, flips
// it to the other side of the point where it would cross the screen's right
// or bottom edge, and keeps it on screen. mIRC's tray menu opens at a point on
// the bottom edge; placed below that point it was drawn off the screen.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_place") (param $flags i32) (param $x i32) (param $y i32)
      (param $w i32) (param $h i32) (result i64)
    (call $menu_track_popup_place (local.get $flags) (local.get $x) (local.get $y)
      (local.get $w) (local.get $h))
    (i64.or (i64.extend_i32_u (global.get $menu_open_x))
      (i64.shl (i64.extend_i32_u (global.get $menu_open_y)) (i64.const 32))))
  (func (export "test_screen_w") (result i32) (call $screen_metric_w))
  (func (export "test_screen_h") (result i32) (call $screen_metric_h))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat });
  const sw = e.test_screen_w(), sh = e.test_screen_h();
  assert(sw > 300 && sh > 300, `screen is ${sw}x${sh}`);
  const place = (flags, x, y, w, h) => {
    const v = BigInt.asUintN(64, e.test_place(flags, x, y, w, h));
    return [Number(v & 0xffffffffn) | 0, Number(v >> 32n) | 0];
  };

  assert.deepStrictEqual(place(0, 100, 50, 120, 80), [100, 50],
    'TPM_LEFTALIGN|TPM_TOPALIGN puts the top-left corner at the point');
  assert.deepStrictEqual(place(0x0008 | 0x0020, 200, 150, 120, 80), [80, 70],
    'TPM_RIGHTALIGN|TPM_BOTTOMALIGN puts the bottom-right corner at the point');
  assert.deepStrictEqual(place(0x0004 | 0x0010, 200, 150, 120, 80), [140, 110],
    'TPM_CENTERALIGN|TPM_VCENTERALIGN centres the popup on the point');
  assert.deepStrictEqual(place(0, sw - 40, sh - 10, 180, 344), [sw - 40 - 180, sh - 10 - 344],
    'a popup crossing the bottom-right corner flips above and left of the point');
  assert.deepStrictEqual(place(0, 10, 10, 120, sh + 50), [10, 0],
    'a popup taller than the screen is pinned to its top');
  assert.deepStrictEqual(place(0x0008, 30, 10, 120, 80), [0, 10],
    'a right-aligned popup that would cross the left edge is clamped on screen');

  console.log('PASS  TrackPopupMenu keeps popups on screen');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

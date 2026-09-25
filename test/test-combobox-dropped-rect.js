#!/usr/bin/env node
'use strict';

// CB_GETDROPPEDCONTROLRECT answers in SCREEN coordinates: the combobox's
// top-left, its width, and the bottom of its dropped list. mIRC's Options
// pages re-create each combobox on the dialog from this rect; a window-local
// answer put the copy at the dialog's corner with no height, and mIRC centres
// a page on the bounding box of its controls, so the Sounds page moved off.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_dropped_parent") (result i32)
    (call $ctrl_create_child
      (i32.const 0) (i32.const 3) (i32.const 1)
      (i32.const 40) (i32.const 30) (i32.const 300) (i32.const 200)
      (i32.const 0x50000000) (i32.const 0)))
  (func (export "test_dropped_combo") (param $parent i32) (result i32)
    (call $ctrl_create_child
      (local.get $parent) (i32.const 5) (i32.const 282)
      (i32.const 33) (i32.const 65) (i32.const 100) (i32.const 150)
      (i32.const 0x50210003) (i32.const 0)))
  (func (export "test_screen_x") (param $h i32) (result i32) (call $wnd_window_screen_x (local.get $h)))
  (func (export "test_screen_y") (param $h i32) (result i32) (call $wnd_window_screen_y (local.get $h)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes USER state');
  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;

  const parent = e.test_dropped_parent() >>> 0;
  const combo = e.test_dropped_combo(parent) >>> 0;
  assert(combo, 'combobox created');
  const rect = e.guest_alloc(16) >>> 0;
  assert.strictEqual(e.send_message(combo, 0x0152, 0, rect) | 0, 1, 'CB_GETDROPPEDCONTROLRECT succeeds');
  const v = new DataView(memory.buffer, toWasm(rect), 16);
  const [l, t, r, b] = [0, 4, 8, 12].map(o => v.getInt32(o, true));
  assert.strictEqual(l, e.test_screen_x(combo), 'left is the combo screen x');
  assert.strictEqual(t, e.test_screen_y(combo), 'top is the combo screen y');
  assert.notStrictEqual(l, 0, 'not window-local');
  assert.strictEqual(r - l, 100, 'width is the combo width');
  assert.strictEqual(b - t, 150, 'height reaches the bottom of the dropped list');
  console.log('PASS  CB_GETDROPPEDCONTROLRECT reports the dropped rect in screen coordinates');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

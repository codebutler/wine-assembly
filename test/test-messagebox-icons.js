#!/usr/bin/env node
'use strict';

// MessageBox draws its MB_ICON* icon.
//
// MB_ICONHAND, MB_ICONQUESTION, MB_ICONEXCLAMATION and MB_ICONASTERISK
// (uType 0x10..0x40) name the stock icons IDI_HAND..IDI_ASTERISK. The box
// used to ignore those bits. It now carries an SS_ICON static (id 20, as
// USER's own MessageBox template) holding the stock HICON at the client's
// top left, with the message moved right of it and the box grown to match.
// A box without an icon keeps its old layout.

const assert = require('assert');
const { bootRenderHarness, flushPendingPaints } = require('./render-helper');

const extraWat = String.raw`
  (func (export "tmi_box") (param $text i32) (param $type i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00120000))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x00401000))
    (call $handle_MessageBoxA (i32.const 0) (local.get $text) (i32.const 0)
      (local.get $type) (i32.const 0) (i32.const 0))
    (global.get $modal_dlg_hwnd))
  (func (export "tmi_done") (call $modal_done (i32.const 1)))
  (func (export "tmi_item") (param $dlg i32) (param $id i32) (result i32)
    (call $ctrl_find_by_id (local.get $dlg) (local.get $id)))
  (func (export "tmi_x") (param $h i32) (result i32) (call $ctrl_get_x_s (local.get $h)))
  (func (export "tmi_wh") (param $h i32) (result i32) (call $ctrl_get_wh_packed (local.get $h)))
  (func (export "tmi_style") (param $h i32) (result i32) (call $wnd_get_style (local.get $h)))
  (func (export "tmi_stock") (param $id i32) (result i32)
    (call $icon_intern (global.get $ICON_FROM_STOCK) (local.get $id)))
  (func (export "tmi_first_static_x") (param $dlg i32) (result i32)
    (call $ctrl_get_x_s (call $ctrl_find_by_id (local.get $dlg) (i32.const 0xFFFF))))
`;

(async () => {
  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const e = harness.exports;
  const r = harness.renderer;
  const allocA = text => {
    const p = e.guest_alloc(text.length + 1) >>> 0;
    for (let i = 0; i < text.length; i++) e.guest_write8(p + i, text.charCodeAt(i));
    e.guest_write8(p + text.length, 0);
    return p;
  };
  const text = allocA('Save changes?');

  // Colours inside the icon's 32x32 box, read off the composited screen.
  const inkIn = (dlg, pred) => {
    flushPendingPaints(harness);
    r.repaint();
    const win = r.windows[dlg];
    const ctx = harness.canvas.getContext('2d');
    // The client origin is below the caption; search the dialog's upper left.
    const data = ctx.getImageData(win.x, win.y, 80, 90).data;
    let n = 0;
    for (let i = 0; i < data.length; i += 4) if (pred(data[i], data[i + 1], data[i + 2])) n++;
    return n;
  };
  const yellow = (r, g, b) => r > 200 && g > 170 && b < 90;

  // No icon: the old layout, no id 20.
  const plain = e.tmi_box(text, 0) >>> 0;
  assert(plain, 'MessageBoxA opens a box');
  assert.strictEqual(e.tmi_item(plain, 20), 0, 'MB_OK alone has no icon static');
  assert.strictEqual(e.tmi_first_static_x(plain), 16, 'the message sits at the left margin');
  const plainW = r.windows[plain].w;
  assert.strictEqual(inkIn(plain, yellow), 0, 'and nothing yellow is drawn');
  e.tmi_done();

  const IDS = { 0x10: 32513, 0x20: 32514, 0x30: 32515, 0x40: 32516 };
  for (const [bits, id] of Object.entries(IDS).map(([b, i]) => [Number(b), i])) {
    const dlg = e.tmi_box(text, bits | 1) >>> 0; // MB_OKCANCEL, to keep the buttons unchanged
    const icon = e.tmi_item(dlg, 20) >>> 0;
    assert(icon, `uType 0x${bits.toString(16)} has an icon static`);
    assert.strictEqual(e.tmi_style(icon) & 0xF, 3, 'it is SS_ICON');
    assert.strictEqual(e.send_message(icon, 0x0171, 0, 0) >>> 0, e.tmi_stock(id) >>> 0,
      `STM_GETICON is the stock icon ${id}`);
    assert.strictEqual(e.tmi_x(icon), 16, 'the icon sits at the left margin');
    assert.strictEqual(e.tmi_wh(icon) >>> 0, 0x00200020, 'at 32x32');
    assert.strictEqual(e.tmi_first_static_x(dlg), 64, 'the message moves right of it');
    assert(r.windows[dlg].w >= plainW + 48, 'and the box grows to keep the message width');
    if (bits === 0x30) {
      assert(inkIn(dlg, yellow) > 100, 'MB_ICONEXCLAMATION paints Wine\'s yellow triangle');
    }
    e.tmi_done();
  }

  console.log('PASS  MessageBox draws its MB_ICON* stock icon and moves the message right of it');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

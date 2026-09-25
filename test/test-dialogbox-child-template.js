#!/usr/bin/env node
'use strict';

// DialogBoxParam follows CreateWindow's parent/owner rules: a WS_CHILD
// template makes a child of hWndParent, anything else a top-level window
// owned by it. mIRC builds each Options page with DialogBoxParamA on a
// WS_CHILD template and parents copies of its controls by GetParent(page);
// with the page owned instead of parented, GetParent was NULL and the Options
// dialog came up with an empty right-hand pane.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');
const extraWat = String.raw`
  (func (export "test_make_host") (result i32)
    (local $h i32)
    (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
    (call $wnd_table_set (local.get $h) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x90c800cc)))
    (local.get $h))
  (func (export "test_dialog_box_indirect")
      (param $template i32) (param $parent i32) (param $stack i32) (result i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_DialogBoxIndirectParamA
      (i32.const 0x400000) (local.get $template) (local.get $parent)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (local.get $hwnd))
  (func (export "test_parent") (param $h i32) (result i32)
    (call $wnd_get_parent (local.get $h)))
  (func (export "test_get_parent_api") (param $h i32) (result i32)
    (call $wnd_get_parent_api (local.get $h)))
  (func (export "test_owner") (param $h i32) (result i32)
    (call $wnd_get_owner (local.get $h)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat });
  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'notepad.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes USER state');

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;

  // DLGTEMPLATE: style, exStyle, cdit=0, x, y, cx, cy, then empty menu,
  // class and title (three 0 words).
  function template(style) {
    const t = e.guest_alloc(32) >>> 0;
    const v = new DataView(memory.buffer, toWasm(t), 32);
    v.setUint32(0, style >>> 0, true);
    v.setUint32(4, 0, true);
    v.setUint16(8, 0, true);
    v.setInt16(10, 0, true); v.setInt16(12, 0, true);
    v.setInt16(14, 100, true); v.setInt16(16, 80, true);
    v.setUint16(18, 0, true); v.setUint16(20, 0, true); v.setUint16(22, 0, true);
    return t;
  }
  const stack = () => ((e.guest_alloc(256) >>> 0) + 128) >>> 0;

  const host = e.test_make_host() >>> 0;
  const page = e.test_dialog_box_indirect(template(0x4000004c), host, stack()) >>> 0;
  assert.strictEqual(e.test_parent(page) >>> 0, host,
    'a WS_CHILD modal template is a child of hWndParent');
  assert.strictEqual(e.test_get_parent_api(page) >>> 0, host,
    'GetParent reports hWndParent for the child page');
  assert.strictEqual(e.test_owner(page) >>> 0, 0,
    'a child page has no owner');

  const popup = e.test_dialog_box_indirect(template(0x80c800cc), host, stack()) >>> 0;
  assert.notStrictEqual(popup, page, 'second dialog is a new window');
  assert.strictEqual(e.test_parent(popup) >>> 0, 0,
    'a WS_POPUP modal template stays top-level');
  assert.strictEqual(e.test_owner(popup) >>> 0, host,
    'a WS_POPUP modal template is owned by hWndParent');

  console.log('PASS  DialogBox parents a WS_CHILD template and owns a popup one');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

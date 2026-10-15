#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_window") (param $parent i32) (param $visible i32) (result i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (i32.const 0x401000))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (drop (call $wnd_set_style (local.get $hwnd)
      (i32.or
        (select (i32.const 0x40000000) (i32.const 0) (local.get $parent))
        (select (i32.const 0x10000000) (i32.const 0) (local.get $visible)))))
    (local.get $hwnd))
  (func (export "test_is_window_visible") (param $hwnd i32) (result i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_IsWindowVisible
      (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const parent = e.test_window(0, 0);
  const child = e.test_window(parent, 1);
  const grandchild = e.test_window(child, 1);

  assert.strictEqual(e.test_is_window_visible(parent), 0);
  assert.strictEqual(e.test_is_window_visible(child), 0,
    'WS_VISIBLE on a child does not override a hidden parent');
  assert.strictEqual(e.test_is_window_visible(grandchild), 0,
    'visibility walks every ancestor');

  e.wnd_set_style_export(parent, 0x10000000);
  assert.strictEqual(e.test_is_window_visible(grandchild), 1);
  e.wnd_set_style_export(child, 0x40000000);
  assert.strictEqual(e.test_is_window_visible(grandchild), 0,
    'hiding an intermediate parent hides its descendants');
  assert.strictEqual(e.test_is_window_visible(0x12345), 0,
    'an invalid HWND is not visible');

  console.log('PASS  IsWindowVisible includes the entire parent chain');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

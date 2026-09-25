#!/usr/bin/env node
'use strict';

// The notification area keeps its own copy of an icon. mIRC builds its tray
// icon with CreateIconIndirect, hands it to Shell_NotifyIcon(NIM_ADD) and
// DestroyIcons it on the next line, which is legal on Win98 because the shell
// copied it. A host that drew the handle later drew nothing.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const EXTRA_WAT = String.raw`
  (func (export "test_notify_make_window") (param $hwnd i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_CTRL_NATIVE)))
  (func (export "test_shell_notify") (param $action i32) (param $nid i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_Shell_NotifyIconA
      (local.get $action) (local.get $nid)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_call_CreateIconIndirect") (param $info i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_CreateIconIndirect
      (local.get $info) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_call_DestroyIcon") (param $h i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_DestroyIcon
      (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: e, memory, renderer } = await bootRenderHarness({ extraWat: EXTRA_WAT });
  const dv = new DataView(memory.buffer);
  const u8 = new Uint8Array(memory.buffer);
  const wa = guest => RegionMap.g2w(guest >>> 0, e.get_image_base());
  const alloc = size => e.guest_alloc(size) >>> 0;
  const hwnd = 0x1234;
  e.test_notify_make_window(hwnd);

  // 16x16 monochrome icon: every pixel opaque white (AND 0, XOR 1).
  const stride = 2, H = 16;
  const bits = alloc(stride * H * 2);
  u8.fill(0, wa(bits), wa(bits) + stride * H);
  u8.fill(0xFF, wa(bits) + stride * H, wa(bits) + stride * H * 2);
  const mask = e.test_call_CreateBitmap(16, H * 2, 1, 1, bits) >>> 0;
  const info = alloc(20);
  u8.fill(0, wa(info), wa(info) + 20);
  dv.setUint32(wa(info), 1, true);
  dv.setUint32(wa(info) + 12, mask, true);
  const hIcon = e.test_call_CreateIconIndirect(info) >>> 0;
  assert.ok(hIcon, 'CreateIconIndirect');

  const nid = alloc(88);
  u8.fill(0, wa(nid), wa(nid) + 88);
  dv.setUint32(wa(nid), 88, true);
  dv.setUint32(wa(nid) + 4, hwnd, true);
  dv.setUint32(wa(nid) + 8, 1, true);
  dv.setUint32(wa(nid) + 12, 0x02, true); // NIF_ICON
  dv.setUint32(wa(nid) + 20, hIcon, true);
  assert.strictEqual(e.test_shell_notify(0, nid), 1, 'NIM_ADD');
  assert.strictEqual(e.test_call_DestroyIcon(hIcon), 1, 'DestroyIcon right after NIM_ADD');

  const icon = [...renderer._notifyIcons.values()][0].get(`${hwnd}:1`);
  assert.ok(icon.pixels, 'the notify icon kept a copy of the pixels');
  assert.strictEqual(icon.pixels.width, 16);
  assert.deepStrictEqual([...icon.pixels.data.slice(0, 4)], [255, 255, 255, 255],
    'the copy is the icon as it was drawn');

  console.log('PASS  Shell_NotifyIcon copies the icon it is given');
})().catch(error => {
  console.error(error);
  process.exit(1);
});

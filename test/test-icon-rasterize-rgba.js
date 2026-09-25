#!/usr/bin/env node

'use strict';

// icon_rasterize_rgba: a host that shows a guest's icon outside the guest (a
// notification area) needs it as straight RGBA. The export draws the HICON
// through DrawIconEx's own painter over black and over white; pixels that
// agree are opaque, pixels that follow the background are transparent.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const harness = await bootRenderHarness({
    extraWat: `
    (func (export "test_call_CreateIconIndirect") (param $info i32) (result i32)
      (local $saved_esp i32)
      (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
      (call $handle_CreateIconIndirect
        (local.get $info) (i32.const 0) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
      (i32.load offset=0 (global.get $reg_base)))
    (func (export "test_g2w") (param $ga i32) (result i32) (call $g2w (local.get $ga)))
  ` });
  const wat = harness.exports;
  const alloc = size => wat.guest_alloc(size) >>> 0;

  // 4x4 monochrome icon, AND plane over XOR plane (1bpp, height 8, WORD
  // aligned rows). Row 0: black black white white (opaque). Rows 1-3:
  // transparent.
  const W = 4, H = 4, stride = 2;
  const planes = new Uint8Array(stride * H * 2);
  planes[1 * stride] = 0xF0; planes[2 * stride] = 0xF0; planes[3 * stride] = 0xF0; // AND
  planes[(H + 0) * stride] = 0x30;                                                  // XOR
  const bits = alloc(planes.length);
  planes.forEach((b, i) => wat.guest_write8(bits + i, b));
  const mask = wat.test_call_CreateBitmap(W, H * 2, 1, 1, bits) >>> 0;
  const info = alloc(20);
  wat.guest_write32(info + 0, 1);      // fIcon
  wat.guest_write32(info + 12, mask);  // hbmMask
  wat.guest_write32(info + 16, 0);     // hbmColor: monochrome icon
  const hicon = wat.test_call_CreateIconIndirect(info) >>> 0;
  assert.ok(hicon, 'CreateIconIndirect returned NULL');

  const dst = alloc(W * H * 4);
  assert.strictEqual(wat.icon_rasterize_rgba(hicon, W, wat.test_g2w(dst)), 1,
    'icon_rasterize_rgba failed');
  const px = (x, y) => {
    const o = dst + (y * W + x) * 4;
    return [0, 1, 2, 3].map(i => wat.guest_read8(o + i));
  };
  assert.deepStrictEqual(px(0, 0), [0, 0, 0, 255], 'opaque black');
  assert.deepStrictEqual(px(2, 0), [255, 255, 255, 255], 'opaque white');
  assert.deepStrictEqual(px(1, 2)[3], 0, 'masked pixel is transparent');
  assert.strictEqual(wat.icon_rasterize_rgba(hicon, 2, wat.test_g2w(dst)), 1,
    'a smaller size than the icon is drawn scaled');
  assert.strictEqual(wat.icon_rasterize_rgba(0, W, wat.test_g2w(dst)), 0,
    'a NULL icon is refused');
  console.log('PASS  icon_rasterize_rgba');
})().catch(err => { console.error(err); process.exit(1); });

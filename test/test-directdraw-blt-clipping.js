#!/usr/bin/env node
'use strict';

// IDirectDrawSurface::Blt must clip equal-size copies to both surfaces. An
// over-wide memcpy otherwise wraps pixels into later destination rows and can
// eventually escape the DIB arena, as Little Fighter 2 does when presenting
// its 794-pixel logical frame through a 640-pixel primary surface.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_dx_surface_new") (param $w i32) (param $h i32) (param $pitch i32) (result i32)
    (local $surface i32) (local $entry i32)
    (local.set $surface (call $dx_create_com_obj (i32.const 2) (i32.const 0x52000000)))
    (local.set $entry (call $dx_from_this (local.get $surface)))
    (i32.store16 offset=12 (local.get $entry) (local.get $w))
    (i32.store16 offset=14 (local.get $entry) (local.get $h))
    (i32.store16 offset=16 (local.get $entry) (i32.const 8))
    (i32.store16 offset=18 (local.get $entry) (local.get $pitch))
    (i32.store offset=20 (local.get $entry)
      (call $g2w (call $dib_alloc (i32.mul (local.get $pitch) (local.get $h)))))
    (i32.store offset=28 (local.get $entry) (i32.const 4))
    (local.get $surface))

  (func $test_dx_pixel_wa (param $surface i32) (param $x i32) (param $y i32) (result i32)
    (local $entry i32)
    (local.set $entry (call $dx_from_this (local.get $surface)))
    (i32.add (i32.load offset=20 (local.get $entry))
      (i32.add (i32.mul (local.get $y) (i32.load16_u offset=18 (local.get $entry)))
               (local.get $x))))

  (func (export "test_dx_surface_set")
    (param $surface i32) (param $x i32) (param $y i32) (param $value i32)
    (i32.store8 (call $test_dx_pixel_wa
      (local.get $surface) (local.get $x) (local.get $y)) (local.get $value)))

  (func (export "test_dx_surface_get")
    (param $surface i32) (param $x i32) (param $y i32) (result i32)
    (i32.load8_u (call $test_dx_pixel_wa
      (local.get $surface) (local.get $x) (local.get $y))))

  (func (export "test_dx_surface_blt")
    (param $dst i32) (param $dst_rect i32) (param $src i32) (param $src_rect i32)
    (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_Blt
      (local.get $dst) (local.get $dst_rect) (local.get $src) (local.get $src_rect)
      (i32.const 0x01000000) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_dx_surface_bltfast")
    (param $surface i32) (param $x i32) (param $y i32) (param $rect i32)
    (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $gs32 (i32.const 0x30018) (i32.const 0x10))
    (call $handle_IDirectDrawSurface_BltFast
      (local.get $surface) (local.get $x) (local.get $y)
      (local.get $surface) (local.get $rect) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

function writeRect(wat, address, left, top, right, bottom) {
  wat.guest_write32(address, left);
  wat.guest_write32(address + 4, top);
  wat.guest_write32(address + 8, right);
  wat.guest_write32(address + 12, bottom);
}

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const dst = wat.test_dx_surface_new(4, 4, 4) >>> 0;
  const src = wat.test_dx_surface_new(6, 4, 6) >>> 0;
  const dstRect = 0x410000;
  const srcRect = 0x410020;
  assert(dst && src, 'surface fixtures should allocate');

  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) wat.test_dx_surface_set(dst, x, y, 0xee);
    for (let x = 0; x < 6; x++) wat.test_dx_surface_set(src, x, y, 1 + y * 8 + x);
  }

  writeRect(wat, dstRect, 2, 1, 8, 5);
  writeRect(wat, srcRect, 0, 0, 6, 4);
  assert.strictEqual(wat.test_dx_surface_blt(dst, dstRect, src, srcRect) >>> 0, 0);
  assert.strictEqual(wat.test_dx_surface_get(dst, 2, 1), 1);
  assert.strictEqual(wat.test_dx_surface_get(dst, 3, 1), 2);
  assert.strictEqual(wat.test_dx_surface_get(dst, 2, 3), 17);
  assert.strictEqual(wat.test_dx_surface_get(dst, 3, 3), 18);
  assert.strictEqual(wat.test_dx_surface_get(dst, 0, 2), 0xee,
    'right-edge overflow must not wrap into the next destination row');
  assert.strictEqual(wat.test_dx_surface_get(dst, 0, 0), 0xee,
    'pixels above and left of the clipped destination must remain untouched');

  // A negative destination origin advances the paired source origin.
  writeRect(wat, dstRect, -2, 0, 4, 4);
  writeRect(wat, srcRect, 0, 0, 6, 4);
  assert.strictEqual(wat.test_dx_surface_blt(dst, dstRect, src, srcRect) >>> 0, 0);
  assert.strictEqual(wat.test_dx_surface_get(dst, 0, 0), 3);
  assert.strictEqual(wat.test_dx_surface_get(dst, 3, 0), 6);

  console.log('PASS  DirectDraw Blt clips equal-size source and destination rectangles');

  // Complement the pure-JS source-body suite with actual handler dispatch,
  // metadata/pitch reads and HRESULT once full VM validation is admitted.
  const self = wat.test_dx_surface_new(7, 6, 12) >>> 0;
  assert(self, 'padded same-surface fixture allocates');
  for (const [name, x, y, rect] of [
    ['up-left', 0, 0, [2,1,7,6]],
    ['up-right', 1, 0, [0,2,6,6]],
    ['right', 1, 0, [0,0,6,6]],
    ['down', 0, 1, [0,0,7,5]],
    ['down-right', 1, 1, [0,0,6,5]],
  ]) {
    const before = Array.from({ length: 6 }, (_, row) =>
      Array.from({ length: 12 }, (_, col) => col < 7 ? 1 + row * 16 + col : 0xee));
    const expected = before.map(row => row.slice());
    for (let row = 0; row < 6; row++) for (let col = 0; col < 12; col++)
      wat.test_dx_surface_set(self, col, row, before[row][col]);
    for (let row = 0; row < rect[3] - rect[1]; row++)
      for (let col = 0; col < rect[2] - rect[0]; col++)
        expected[y + row][x + col] = before[rect[1] + row][rect[0] + col];
    writeRect(wat, srcRect, ...rect);
    assert.equal(wat.test_dx_surface_bltfast(self, x, y, srcRect) >>> 0, 0, name);
    for (let row = 0; row < 6; row++) for (let col = 0; col < 12; col++)
      assert.equal(wat.test_dx_surface_get(self, col, row), expected[row][col],
        `${name} at ${col},${row}, including pitch padding`);
  }
  console.log('PASS  DirectDraw BltFast same-surface overlap and padded pitch');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

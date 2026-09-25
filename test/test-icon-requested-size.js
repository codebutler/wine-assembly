#!/usr/bin/env node
'use strict';

// LoadImage(IMAGE_ICON, cx, cy) picks the group image nearest cx x cy, and
// the icon is drawn at that size. mIRC's About box loads its logo at 48x48,
// asks GetIconInfo for the bitmap size and DrawIconEx's it at that size; the
// icon used to come back as the group's first (32x32) image, drawn unscaled.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_best") (param $group i32) (param $cx i32) (param $cy i32) (result i32)
    (i32.sub (call $gdi_icon_group_best_entry (local.get $group) (local.get $cx) (local.get $cy))
      (local.get $group)))
  (func (export "test_intern") (param $hinst i32) (param $resid i32) (param $size i32) (result i32)
    (call $icon_intern_sized (local.get $hinst) (local.get $resid) (local.get $size)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat });
  // GRPICONDIR: reserved, type=1, count, then 14-byte entries
  // {bWidth, bHeight, bColorCount, bReserved, wPlanes, wBitCount, dwBytesInRes, nId}.
  const group = e.get_staging() >>> 0; // wasm-addressed scratch, as the resource walker returns
  const v = new DataView(memory.buffer, group, 256);
  const entries = [[32, 32, 4], [16, 16, 8], [48, 48, 4], [48, 48, 8], [0, 0, 32]];
  v.setUint16(0, 0, true); v.setUint16(2, 1, true); v.setUint16(4, entries.length, true);
  entries.forEach(([w, h, bpp], i) => {
    const o = 6 + i * 14;
    v.setUint8(o, w); v.setUint8(o + 1, h); v.setUint16(o + 4, 1, true);
    v.setUint16(o + 6, bpp, true); v.setUint16(o + 12, 100 + i, true);
  });
  const entry = i => 6 + i * 14;

  assert.strictEqual(e.test_best(group, 16, 16), entry(1), 'exact 16x16 match');
  assert.strictEqual(e.test_best(group, 48, 48), entry(3),
    'exact 48x48 match takes the deeper of two same-size images');
  assert.strictEqual(e.test_best(group, 40, 40), entry(3), 'nearest size wins');
  assert.strictEqual(e.test_best(group, 256, 256), entry(4), 'a zero byte is 256');
  assert.strictEqual(e.test_best(group, 24, 24), entry(1),
    'equally near images (16x16, 32x32) go to the deeper colour');

  const small = e.test_intern(0x400000, 1, 16 | (16 << 16)) >>> 0;
  const large = e.test_intern(0x400000, 1, 48 | (48 << 16)) >>> 0;
  assert.notStrictEqual(small, large, 'one handle per requested size');
  assert.strictEqual(e.test_intern(0x400000, 1, 48 | (48 << 16)) >>> 0, large,
    'a repeat load at one size returns its first handle');
  assert.strictEqual(e.test_intern(0x400000, 1, 0) >>> 0,
    e.test_intern(0x400000, 1, 0) >>> 0, 'LoadIcon keeps one handle per resource');

  console.log('PASS  icons load at the size asked for');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

#!/usr/bin/env node

'use strict';

// WordPad Print Preview establishes MM_ANISOTROPIC and then scales the logical
// window by screen/printer DPI (96/300). A 13px logical font has to come out as
// a ~3px device glyph; when it did not, preview lines overlapped.
//
// This used to check the JS font resolver, which applied the mapping while
// building a CSS font string. There is no JS font resolver any more — the
// mapping is applied in $gdi_bitmap_font_height when a strike is chosen. The
// public TEXTMETRIC result is in logical units, so inspect the internal device
// cell height separately when verifying the rendered glyph size.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
// $GUEST_BASE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const extraWat = String.raw`
  (func (export "test_raw_text_height") (param i32) (result i32)
    (i32.and (call $host_get_text_metrics (local.get 0)) (i32.const 0xffff)))
`;

(async () => {
  const { exports: wat, memory } = await bootRenderHarness({ extraWat });
  const bytes = new Uint8Array(memory.buffer);
  const imageBase = wat.get_image_base() >>> 0;
  const wa = guest => RegionMap.g2w(guest, imageBase);
  const allocZero = size => {
    const pointer = wat.guest_alloc(size) >>> 0;
    bytes.fill(0, wa(pointer), wa(pointer) + size);
    return pointer;
  };
  const writeWide = value => {
    const pointer = allocZero((value.length + 1) * 2);
    [...value].forEach((character, index) =>
      wat.guest_write16(pointer + index * 2, character.charCodeAt(0)));
    return pointer;
  };

  const bmi = allocZero(40);
  wat.guest_write32(bmi, 40);
  wat.guest_write32(bmi + 4, 256);
  wat.guest_write32(bmi + 8, -128);
  wat.guest_write16(bmi + 12, 1);
  wat.guest_write16(bmi + 14, 32);
  const bitsOut = allocZero(4);
  const bitmap = wat.test_call_CreateDIBSection(0, bmi, 0, bitsOut, 0, 0) >>> 0;
  const hdc = wat.test_call_CreateCompatibleDC(0) >>> 0;
  assert(bitmap && hdc);
  wat.test_call_SelectObject(hdc, bitmap);

  const font = wat.test_call_CreateFontW(-13, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, writeWide('Times New Roman')) >>> 0;
  assert(font, 'CreateFontW should return a font handle');
  wat.test_call_SelectObject(hdc, font);

  const tm = allocZero(64);
  const heightOf = () => {
    assert.strictEqual(wat.test_call_GetTextMetricsA(hdc, tm), 1);
    return wat.guest_read32(tm) | 0;
  };
  const deviceHeightOf = () => wat.test_raw_text_height(hdc) | 0;

  // 1:1 mapping first: the unscaled cell for a 13px request.
  const unscaled = deviceHeightOf();
  assert(unscaled >= 8, `unscaled cell should be a usable size, got ${unscaled}`);
  assert.strictEqual(heightOf(), unscaled, 'MM_TEXT metrics use device-pixel units');

  // MM_ANISOTROPIC with WordPad's 96/300 DPI window, applied to the Y extents
  // that $gdi_bitmap_font_height reads (DC offsets 52 and 68).
  assert.strictEqual(wat.test_call_SetMapMode(hdc, 8), 1);
  wat.test_gdi_dc_set_field(hdc, 52, 5242, 1);   // 16384 * 96 / 300
  wat.test_gdi_dc_set_field(hdc, 68, 1058, 1);
  const scaled = deviceHeightOf();
  assert(scaled > 0 && scaled < unscaled,
    `anisotropic mapping must shrink the device glyph: ${unscaled} -> ${scaled}`);
  assert(scaled <= 4,
    `a 13px logical font at 1058/5242 should land near 3px, got ${scaled}`);
  assert(heightOf() >= scaled,
    'the public metric converts the rasterized glyph back to logical units');

  console.log('PASS  anisotropic text mapping scales logical fonts into device pixels');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

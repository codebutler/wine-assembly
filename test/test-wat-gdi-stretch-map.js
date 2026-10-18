#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

(async () => {
  const { exports: wat, memory } = await bootRenderHarness();
  const bytes = new Uint8Array(memory.buffer);
  const imageBase = wat.get_image_base() >>> 0;
  const bmi = wat.guest_alloc(40) >>> 0;
  const bitsOut = wat.guest_alloc(4) >>> 0;
  wat.guest_write32(bmi, 40);
  wat.guest_write32(bmi + 4, 20);
  wat.guest_write32(bmi + 8, -20);
  wat.guest_write16(bmi + 12, 1);
  wat.guest_write16(bmi + 14, 32);
  const bitmap = wat.test_call_CreateDIBSection(0, bmi, 0, bitsOut, 0, 0) >>> 0;
  const hdc = wat.test_call_CreateCompatibleDC(0) >>> 0;
  assert(bitmap && hdc);
  wat.test_call_SelectObject(hdc, bitmap);
  const bitmapBits = RegionMap.BASE.DIB_BACKING_BASE + (wat.guest_read32(bitsOut) - 0x50000000);
  const rgb = (x, y) => {
    const offset = bitmapBits + (y * 20 + x) * 4;
    return [bytes[offset + 2], bytes[offset + 1], bytes[offset]];
  };

  const sourceBmi = wat.guest_alloc(40) >>> 0;
  const sourceBits = wat.guest_alloc(16) >>> 0;
  wat.guest_write32(sourceBmi, 40);
  wat.guest_write32(sourceBmi + 4, 2);
  wat.guest_write32(sourceBmi + 8, -2);
  wat.guest_write16(sourceBmi + 12, 1);
  wat.guest_write16(sourceBmi + 14, 24);
  const sourceBitsWa = RegionMap.g2w(sourceBits, imageBase);
  // Top-down rows: red/green, blue/white, each with an 8-byte stride.
  bytes.set([0, 0, 255, 0, 255, 0, 0, 0, 255, 0, 0, 255, 255, 255, 0, 0], sourceBitsWa);
  assert.strictEqual(wat.test_call_SetMapMode(hdc, 6), 1);
  assert.strictEqual(wat.test_gdi_stretch_dibits(
    hdc, 0, 0, 240, -240, 0, 0, 2, 2,
    sourceBitsWa, RegionMap.g2w(sourceBmi, imageBase), 0, 0x00CC0020), 2);
  assert.deepStrictEqual(rgb(0, 0), [255, 0, 0]);
  assert.deepStrictEqual(rgb(15, 0), [0, 255, 0]);
  assert.deepStrictEqual(rgb(0, 15), [0, 0, 255]);
  assert.deepStrictEqual(rgb(15, 15), [255, 255, 255]);
  assert.deepStrictEqual(rgb(16, 16), [0, 0, 0]);
  console.log('PASS  StretchDIBits maps upward-Y MM_TWIPS destination extents');
})().catch(error => { console.error(error); process.exitCode = 1; });

#!/usr/bin/env node

'use strict';

// A raster font has no bold or underline of its own; GDI makes both.
//
// Bold (lfWeight 600 and up) on a strike that is not bold is Windows'
// simulated bold: every glyph is drawn again one pixel to its right, every
// advance grows by one, and TEXTMETRIC reports the weight asked for with
// tmOverhang 1. MS Sans Serif ships no bold strike, so Win98's captions are
// exactly this: a Windows 98 capture of PuTTY's caption is the regular face
// overstruck, one pixel wider per character (bar one hand-tuned pixel in "g").
//
// Underline (lfUnderline) is a line under every glyph on the cell's row
// ascent + 1 -- the row a Windows 98 capture of mIRC's About link puts it on,
// and the row DrawText's & prefix underline already used. It reaches
// GetObject's LOGFONT and TEXTMETRIC's tmUnderlined too. lfStrikeOut is
// carried the same way but not drawn: no capture places it yet.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const extraWat = String.raw`
  (func (export "tbu_create_font_indirect") (param $lf i32) (result i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_CreateFontIndirectA (local.get $lf)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: wat, memory } = await bootRenderHarness({ fonts: 'bitmap', extraWat });
  const bytes = new Uint8Array(memory.buffer);
  const imageBase = wat.get_image_base() >>> 0;
  const wa = guest => RegionMap.g2w(guest, imageBase);
  const allocZero = size => {
    const pointer = wat.guest_alloc(size) >>> 0;
    bytes.fill(0, wa(pointer), wa(pointer) + size);
    return pointer;
  };
  const ansi = value => {
    const pointer = allocZero(value.length + 1);
    bytes.set(Buffer.from(value + '\0', 'latin1'), wa(pointer));
    return pointer;
  };

  const W = 160, H = 24;
  const bmi = allocZero(40);
  wat.guest_write32(bmi, 40);
  wat.guest_write32(bmi + 4, W);
  wat.guest_write32(bmi + 8, -H);
  wat.guest_write16(bmi + 12, 1);
  wat.guest_write16(bmi + 14, 32);
  const bitsOut = allocZero(4);
  const bitmap = wat.test_call_CreateDIBSection(0, bmi, bitsOut) >>> 0;
  const hdc = wat.test_call_CreateCompatibleDC(0) >>> 0;
  assert(bitmap && hdc);
  wat.test_call_SelectObject(hdc, bitmap);
  // DIB pixels live in the DIB backing region, not at their guest address.
  const bits = RegionMap.BASE.DIB_BACKING_BASE + ((wat.guest_read32(bitsOut) >>> 0) - 0x50000000);

  const font = ({ weight = 400, underline = 0, strikeout = 0 } = {}) => {
    const lf = allocZero(60);
    wat.guest_write32(lf, -11 >>> 0);           // lfHeight: the 13px cell
    wat.guest_write32(lf + 16, weight);          // lfWeight
    bytes[wa(lf + 21)] = underline;              // lfUnderline
    bytes[wa(lf + 22)] = strikeout;              // lfStrikeOut
    bytes.set(Buffer.from('MS Sans Serif\0', 'latin1'), wa(lf + 28));
    const handle = wat.tbu_create_font_indirect(lf) >>> 0;
    assert(handle, 'CreateFontIndirectA');
    return handle;
  };
  // Draw text black on white (the DC defaults, opaque) into a clean bitmap
  // and return which pixels are ink.
  const draw = (handle, text) => {
    assert.strictEqual(wat.test_call_PatBlt(hdc, 0, 0, W, H, 0x00FF0062), 1); // WHITENESS
    wat.test_call_SelectObject(hdc, handle);
    assert.strictEqual(wat.test_call_TextOutA(hdc, 0, 0, ansi(text), text.length), 1);
    const ink = [];
    for (let y = 0; y < H; y++) {
      ink.push([]);
      for (let x = 0; x < W; x++) ink[y].push(bytes[bits + (y * W + x) * 4] < 0x80);
    }
    return ink;
  };
  const extent = (handle, text) => {
    wat.test_call_SelectObject(hdc, handle);
    const size = allocZero(8);
    assert.strictEqual(wat.test_call_GetTextExtentPoint32A(hdc, ansi(text), text.length, size), 1);
    return wat.guest_read32(size);
  };
  const tm = handle => {
    wat.test_call_SelectObject(hdc, handle);
    const out = allocZero(64);
    assert.strictEqual(wat.test_call_GetTextMetricsA(hdc, out), 1);
    return {
      ascent: wat.guest_read32(out + 4), ave: wat.guest_read32(out + 20),
      weight: wat.guest_read32(out + 28), overhang: wat.guest_read32(out + 32),
      underlined: bytes[wa(out + 49)], struck: bytes[wa(out + 50)],
    };
  };

  const regular = font();
  const bold = font({ weight: 700 });
  const text = 'mIRC';

  // Advances: one pixel more per character.
  assert.strictEqual(extent(bold, text), extent(regular, text) + text.length,
    'simulated bold widens every advance by one');
  assert.strictEqual(extent(0x30022, text), extent(bold, text),
    'the caption stock font is MS Sans Serif simulated bold');

  // Ink: each glyph is its regular self overstruck one pixel right.
  const r = draw(regular, 'l'), b = draw(bold, 'l');
  assert(r.flat().some(Boolean), 'the regular "l" drew ink (the checks below are not vacuous)');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < 8; x++) {
      const expect = r[y][x] || (x > 0 && r[y][x - 1]);
      assert.strictEqual(b[y][x], expect, `bold "l" pixel ${x},${y}`);
    }
  }

  // TEXTMETRIC tells the program so.
  assert.deepStrictEqual([tm(regular).weight, tm(regular).overhang], [400, 0]);
  const tb = tm(bold);
  assert.deepStrictEqual([tb.weight, tb.overhang, tb.ave], [700, 1, tm(regular).ave + 1],
    'bold TEXTMETRIC: weight asked for, tmOverhang 1, one wider on average');

  // Underline: the row under the descenders, across the whole string.
  const underlined = font({ underline: 1 });
  const t = tm(underlined);
  assert.strictEqual(t.underlined, 1, 'tmUnderlined');
  const u = draw(underlined, text), plain = draw(regular, text);
  const row = t.ascent + 1;
  const width = extent(underlined, text);
  for (let x = 0; x < width; x++) assert(u[row][x], `underline at ${x},${row}`);
  assert(!u[row][width], 'the underline ends with the text');
  for (let y = 0; y < H; y++) {
    if (y === row) continue;
    for (let x = 0; x < W; x++) assert.strictEqual(u[y][x], plain[y][x], `glyphs unchanged at ${x},${y}`);
  }
  assert.strictEqual(plain[row].slice(0, width).some(Boolean), false,
    'nothing is on that row without the underline');

  // GetObject gives the LOGFONT's decorations back; strike-out is carried.
  const struck = font({ strikeout: 1 });
  const lfOut = allocZero(60);
  assert(wat.test_call_GetObjectA(underlined, 60, lfOut) > 0);
  assert.deepStrictEqual([bytes[wa(lfOut + 21)], bytes[wa(lfOut + 22)]], [1, 0], 'lfUnderline');
  assert(wat.test_call_GetObjectA(struck, 60, lfOut) > 0);
  assert.deepStrictEqual([bytes[wa(lfOut + 21)], bytes[wa(lfOut + 22)]], [0, 1], 'lfStrikeOut');
  assert.strictEqual(tm(struck).struck, 1, 'tmStruckOut');

  console.log('PASS  raster fonts: simulated bold and lfUnderline as Win98 draws them');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

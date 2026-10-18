#!/usr/bin/env node
'use strict';

// GDI reports text extents and TEXTMETRIC dimensions in the DC's logical
// units. Comic Chat lays out 2,300-twip panels from these values; returning
// device pixels made a 324px title look 15 times narrower to the guest.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const { fontMounts } = require('../lib/font-substitutions');

const extraWat = String.raw`
  (func (export "test_raw_text_width") (param i32 i32 i32) (result i32)
    (call $host_measure_text (local.get 0) (call $g2w (local.get 1))
      (local.get 2) (i32.const 0)))
  (func (export "test_raw_text_height") (param i32) (result i32)
    (i32.and (call $host_get_text_metrics (local.get 0)) (i32.const 0xffff)))
`;

(async () => {
  const { exports: wat, memory, hostCtx } = await bootRenderHarness({ extraWat });
  const repo = path.join(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(repo, 'fonts', 'substitutions.json'), 'utf8'));
  hostCtx.vfs.dirs.add('c:\\windows');
  hostCtx.vfs.dirs.add('c:\\windows\\fonts');
  for (const mount of fontMounts(manifest, { subset: true })) {
    hostCtx.vfs.files.set(mount.vfsPath, {
      data: new Uint8Array(fs.readFileSync(path.join(repo, 'fonts', mount.file))),
      attrs: 0x20,
    });
  }
  const bytes = new Uint8Array(memory.buffer);
  const wa = guest => wat.guest_to_wasm(guest) >>> 0;
  const alloc = size => {
    const pointer = wat.guest_alloc(size) >>> 0;
    bytes.fill(0, wa(pointer), wa(pointer) + size);
    return pointer;
  };
  const ansi = value => {
    const pointer = alloc(value.length + 1);
    bytes.set(Buffer.from(value, 'latin1'), wa(pointer));
    return pointer;
  };
  const wide = value => {
    const pointer = alloc(value.length * 2 + 2);
    [...value].forEach((ch, index) => wat.guest_write16(pointer + index * 2, ch.charCodeAt(0)));
    return pointer;
  };

  const hdc = wat.test_call_CreateCompatibleDC(0) >>> 0;
  assert(hdc);
  assert.strictEqual(wat.test_call_SetMapMode(hdc, 6), 1); // MM_TWIPS at 96 DPI
  const font = wat.test_call_CreateFontW(-480, 0, 0, 0, 400, 0, 0, 0, 0, 0, 0, 0, 0, wide('Comic Sans MS')) >>> 0;
  assert(font);
  wat.test_call_SelectObject(hdc, font);

  const title = 'YOU SHOULDA BEEN THERE';
  const titlePtr = ansi(title);
  const rawWidth = wat.test_raw_text_width(hdc, titlePtr, title.length) | 0;
  const rawHeight = wat.test_raw_text_height(hdc) | 0;
  assert(rawWidth > 0 && rawHeight > 0);
  const size = alloc(8);
  assert.strictEqual(wat.test_call_GetTextExtentPoint32A(hdc, titlePtr, title.length, size), 1);
  const width = wat.guest_read32(size) | 0;
  const height = wat.guest_read32(size + 4) | 0;
  assert.strictEqual(width, rawWidth * 15,
    `GetTextExtentPoint32A must convert device-pixel width ${rawWidth} to twips`);
  assert.strictEqual(height, rawHeight * 15,
    `GetTextExtentPoint32A must convert device-pixel height ${rawHeight} to twips`);

  const metrics = alloc(56);
  assert.strictEqual(wat.test_call_GetTextMetricsA(hdc, metrics), 1);
  assert.strictEqual(wat.guest_read32(metrics) | 0, rawHeight * 15,
    'TEXTMETRICA.tmHeight must convert device pixels to twips');
  console.log('PASS MM_TWIPS text extents and metrics are logical units');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

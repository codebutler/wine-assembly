#!/usr/bin/env node

// WGL layer planes and glVertex4f, from MDK2's demo. Its GL loader resolves
// wglDescribeLayerPlane / wgl{Get,Set}LayerPaletteEntries / wglRealizeLayerPalette
// through GetProcAddress and abandons OpenGL if one is missing; it never calls
// them. Our one pixel format has no overlay or underlay planes (bReserved 0),
// so each answers from that descriptor: FALSE or 0 with ERROR_INVALID_PARAMETER
// for a plane that does not exist, ERROR_INVALID_HANDLE for a bad DC.
// glVertex4f with w = 1.0 is glVertex3f; any other w is projective and must
// fail fast (the packed vertex carries no w), never be divided through.

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00300000;
const call = (name, handler, params) => {
  const args = params.map(p => `(local.get $${p})`);
  while (args.length < 5) args.push('(i32.const 0)');
  return String.raw`
  (func (export "t_${name}") ${params.map(p => `(param $${p} i32)`).join(' ')} (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0x7e7e7e7e))
    (global.set $last_error (i32.const 0))
    ${params.map((p, i) => `(call $gs32 (i32.const ${STACK + 4 + 4 * i}) (local.get $${p}))`).join('\n    ')}
    (call $handle_${handler} ${args.join(' ')} (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))`;
};

const extraWat = String.raw`
  (func (export "t_init")
    (global.set $image_base (i32.const 0))
    (global.set $thunk_guest_base (i32.sub (global.get $THUNK_BASE) (global.get $GUEST_BASE))))
  (func (export "t_last_error") (result i32) (global.get $last_error))
  ${call('GetDC', 'GetDC', ['hwnd'])}
  ${call('wglDescribeLayerPlane', 'wglDescribeLayerPlane', ['hdc', 'fmt', 'plane', 'bytes', 'out'])}
  ${call('wglGetLayerPaletteEntries', 'wgl_layer_palette_entries', ['hdc', 'plane', 'start', 'count', 'out'])}
  ${call('wglRealizeLayerPalette', 'wglRealizeLayerPalette', ['hdc', 'plane', 'realize'])}
  ${call('glVertex4f', 'glVertex4f', ['x', 'y', 'z', 'w'])}
`;

(async () => {
  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const e = harness.exports;
  e.t_init();
  const esp = () => e.get_esp() >>> 0;
  const hdc = e.t_GetDC(0) >>> 0;
  assert.notStrictEqual(hdc, 0, 'GetDC(NULL) gives a screen DC');
  const OUT = 0x2000;

  for (const plane of [1, -1, 0]) {
    assert.strictEqual(e.t_wglDescribeLayerPlane(hdc, 1, plane, 32, OUT), 0,
      `wglDescribeLayerPlane(plane ${plane}): no such layer plane`);
    assert.strictEqual(e.t_last_error(), 87, 'ERROR_INVALID_PARAMETER');
    assert.strictEqual(esp(), STACK + 24, 'pops 5 arguments');
  }
  assert.strictEqual(e.t_wglGetLayerPaletteEntries(hdc, 1, 0, 16, OUT), 0, 'no layer palette entries');
  assert.strictEqual(e.t_last_error(), 87);
  assert.strictEqual(esp(), STACK + 24);
  assert.strictEqual(e.t_wglRealizeLayerPalette(hdc, 1, 1), 0, 'no layer palette to realize');
  assert.strictEqual(e.t_last_error(), 87);
  assert.strictEqual(esp(), STACK + 16, 'pops 3 arguments');
  assert.strictEqual(e.t_wglDescribeLayerPlane(0x1234, 1, 1, 32, OUT), 0, 'a bad DC is FALSE');
  assert.strictEqual(e.t_last_error(), 6, 'ERROR_INVALID_HANDLE');

  // A projective vertex is not silently divided through.
  assert.throws(() => e.t_glVertex4f(0x3f800000, 0, 0, 0x40000000), /unreachable|RuntimeError/,
    'glVertex4f with w = 2 fails fast');
  assert.throws(() => e.t_glVertex4f(0x3f800000, 0, 0, 0), /unreachable|RuntimeError/,
    'glVertex4f with w = 0 fails fast');

  console.log('PASS  WGL layer planes answer from the pixel format; projective glVertex4f fails fast');
})().catch(error => {
  console.error(error);
  process.exit(1);
});

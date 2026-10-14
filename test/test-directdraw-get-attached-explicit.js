#!/usr/bin/env node

'use strict';

// GetAttachedSurface must find surfaces attached with AddAttachedSurface, not
// only the flip-chain link in misc0. Giants: Citizen Kabuto attaches its
// Z-buffer to the back buffer with AddAttachedSurface and later asks the
// render target for DDSCAPS_ZBUFFER; DDERR_NOTFOUND (0x887600FF) there ended
// the demo at its "DXErr 887600FF" error screen.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const CAPS = 0x00300100;
const OUT = 0x00300200;

const extraWat = String.raw`
  (func (export "test_dd_surface") (param $caps i32) (result i32)
    (local $s i32)
    (local.set $s (call $dx_create_com_obj (i32.const 2) (i32.const 0x54000000)))
    (i32.store (call $dx_surf_meta_ptr (call $dx_from_this (local.get $s))) (local.get $caps))
    (local.get $s))

  (func (export "test_dd_add") (param $parent i32) (param $child i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_IDirectDrawSurface_AddAttachedSurface
      (local.get $parent) (local.get $child) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_dd_link") (param $parent i32) (param $child i32)
    (store.field DxObject misc0 (call $dx_from_this (local.get $parent)) (local.get $child)))

  (func (export "test_dd_get") (param $surface i32) (param $caps i32) (result i32)
    (call $gs32 (i32.const ${CAPS}) (local.get $caps))
    (call $gs32 (i32.const ${OUT}) (i32.const 0x12345678))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_IDirectDrawSurface_GetAttachedSurface
      (local.get $surface) (i32.const ${CAPS}) (i32.const ${OUT})
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_dd_out") (result i32) (call $gl32 (i32.const ${OUT})))

  (func (export "test_dd_ref") (param $surface i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $surface))))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const DD_OK = 0;
  const DDERR_NOTFOUND = 0x887600ff;
  const DDSCAPS_BACKBUFFER = 0x4;
  const DDSCAPS_ZBUFFER = 0x20000;
  const DDSCAPS_TEXTURE = 0x1000;

  // A primary whose flip chain holds the back buffer, and a Z-buffer attached
  // to that back buffer explicitly -- Giants' setup.
  const primary = e.test_dd_surface(0x200) >>> 0;
  const back = e.test_dd_surface(DDSCAPS_BACKBUFFER) >>> 0;
  const zbuf = e.test_dd_surface(DDSCAPS_ZBUFFER) >>> 0;
  e.test_dd_link(primary, back);
  assert.strictEqual(e.test_dd_add(back, zbuf) >>> 0, DD_OK);
  const zRefs = e.test_dd_ref(zbuf);

  // The flip-chain link still answers as before.
  assert.strictEqual(e.test_dd_get(primary, DDSCAPS_BACKBUFFER) >>> 0, DD_OK);
  assert.strictEqual(e.test_dd_out() >>> 0, back, 'primary -> back buffer');
  assert.strictEqual(e.get_esp(), 0x00300010, 'GetAttachedSurface pops this, caps, out');

  // The explicit attachment is found by its caps and AddRef'd for the caller.
  assert.strictEqual(e.test_dd_get(back, DDSCAPS_ZBUFFER) >>> 0, DD_OK,
    'back buffer -> Z-buffer attached with AddAttachedSurface');
  assert.strictEqual(e.test_dd_out() >>> 0, zbuf);
  assert.strictEqual(e.test_dd_ref(zbuf), zRefs + 1, 'the caller owns one more reference');

  // Caps no attachment has still fail, and clear the out pointer.
  assert.strictEqual(e.test_dd_get(back, DDSCAPS_TEXTURE) >>> 0, DDERR_NOTFOUND);
  assert.strictEqual(e.test_dd_out(), 0, 'NOTFOUND zeroes the out pointer');
  // An unrelated surface does not see another surface's attachment.
  assert.strictEqual(e.test_dd_get(primary, DDSCAPS_ZBUFFER) >>> 0, DDERR_NOTFOUND,
    'the Z-buffer is attached to the back buffer, not the primary');

  console.log('PASS  GetAttachedSurface finds AddAttachedSurface children by caps');
})().catch(error => { console.error(error); process.exit(1); });

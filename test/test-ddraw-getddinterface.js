#!/usr/bin/env node
'use strict';

// IDirectDrawSurface::GetDDInterface returns the DirectDraw interface the
// surface was created through, AddRef'd. Tachyon: The Fringe's hw_d3d.dll
// creates its flip chain on an IDirectDraw4, asks the back buffer for its
// DirectDraw and calls slot 27 (IDirectDraw4::GetDeviceIdentifier) on the
// answer. Handing back the v1 interface sent that call into the wrong table,
// the renderer saw no device identity and the game quit at startup.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_gi_seed") (param $ddraw_vtbl i32) (param $ddraw4_vtbl i32) (param $surface_vtbl i32)
    (global.set $DX_VTBL_DDRAW (local.get $ddraw_vtbl))
    (global.set $DX_VTBL_DDRAW4 (local.get $ddraw4_vtbl))
    (global.set $DX_VTBL_DDSURF2 (local.get $surface_vtbl)))
  (func (export "test_gi_ddraw") (result i32)
    (local $dd i32)
    (local.set $dd (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
    (global.set $dx_ddraw_this (local.get $dd))
    (local.get $dd))
  (func (export "test_gi_qi") (param $dd i32) (param $iid i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_QueryInterface (local.get $dd) (local.get $iid) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_gi_create") (param $dd i32) (param $desc i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_CreateSurface (local.get $dd) (local.get $desc) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_gi_attached") (param $surface i32) (param $caps i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface_GetAttachedSurface (local.get $surface) (local.get $caps) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_gi_getdd") (param $surface i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDrawSurface2_GetDDInterface (local.get $surface) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_gi_addref") (param $this i32) (result i32)
    (call $dx_com_addref (local.get $this)))
  (func (export "test_gi_release") (param $this i32) (result i32)
    (call $dx_com_release_basic (local.get $this)))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat });
  const desc = 0x410000, out = 0x410100, caps = 0x410200, got = 0x410300, iid = 0x410400;
  wat.test_gi_seed(0x51000000, 0x54000000, 0x52000000);
  const ddraw = wat.test_gi_ddraw() >>> 0;

  // IID_IDirectDraw4 {9c59509a-39bd-11d1-8c4a-00c04fd930c5}
  [0x9c59509a, 0x11d139bd, 0xc0004a8c, 0xc530d94f].forEach((v, i) => wat.guest_write32(iid + i * 4, v));
  assert.strictEqual(wat.test_gi_qi(ddraw, iid, got) >>> 0, 0, 'QI for IDirectDraw4');
  const ddraw4 = wat.guest_read32(got) >>> 0;
  assert.notStrictEqual(ddraw4, ddraw, 'IDirectDraw4 is a distinct interface pointer');

  function describe(flags, w, h, count, capsBits) {
    for (let i = 0; i < 108; i += 4) wat.guest_write32(desc + i, 0);
    wat.guest_write32(desc, 108);
    wat.guest_write32(desc + 4, flags);
    wat.guest_write32(desc + 8, h);
    wat.guest_write32(desc + 12, w);
    wat.guest_write32(desc + 20, count);
    wat.guest_write32(desc + 104, capsBits);
  }
  function getDD(surface) {
    wat.guest_write32(got, 0);
    assert.strictEqual(wat.test_gi_getdd(surface, got) >>> 0, 0, 'GetDDInterface succeeds');
    return wat.guest_read32(got) >>> 0;
  }
  function attachment(surface, capsBits) {
    wat.guest_write32(caps, capsBits);
    assert.strictEqual(wat.test_gi_attached(surface, caps, got) >>> 0, 0, 'implicit attachment found');
    return wat.guest_read32(got) >>> 0;
  }

  // Tachyon's chain: PRIMARY|FLIP|COMPLEX with one back buffer, made on IDirectDraw4.
  describe(0x21, 0, 0, 1, 0x200 | 0x10 | 0x8);
  assert.strictEqual(wat.test_gi_create(ddraw4, desc, out) >>> 0, 0);
  const front = wat.guest_read32(out) >>> 0;
  const back = attachment(front, 0x4);
  assert.strictEqual(getDD(front), ddraw4, 'primary made on IDirectDraw4 answers IDirectDraw4');
  assert.strictEqual(getDD(back), ddraw4, 'its back buffer answers IDirectDraw4, not the v1 interface');

  // A mip pyramid made on IDirectDraw4: every level answers the same interface.
  describe(0x7 | 0x20000, 64, 64, 3, 0x1000 | 0x400000 | 0x8);
  assert.strictEqual(wat.test_gi_create(ddraw4, desc, out) >>> 0, 0);
  const top = wat.guest_read32(out) >>> 0;
  const level1 = attachment(top, 0x1000 | 0x400000);
  assert.notStrictEqual(level1, top);
  assert.strictEqual(getDD(level1), ddraw4, 'a mip level answers its parent\'s interface');

  // A surface made on the v1 interface keeps answering v1 (flip3dtl).
  describe(0x7, 32, 32, 0, 0x40);
  assert.strictEqual(wat.test_gi_create(ddraw, desc, out) >>> 0, 0);
  const plain = wat.guest_read32(out) >>> 0;
  assert.strictEqual(getDD(plain), ddraw, 'a surface made on IDirectDraw answers IDirectDraw');

  // The returned interface is AddRef'd: one more reference per call.
  const before = wat.test_gi_addref(ddraw4);
  wat.test_gi_release(ddraw4);
  getDD(back);
  const after = wat.test_gi_addref(ddraw4);
  wat.test_gi_release(ddraw4);
  assert.strictEqual(after, before + 1, 'GetDDInterface AddRefs the interface it returns');

  // A NULL out pointer is rejected rather than written through.
  assert.strictEqual(wat.test_gi_getdd(back, 0) >>> 0, 0x80070057, 'NULL lplpDD is DDERR_INVALIDPARAMS');

  console.log('PASS test-ddraw-getddinterface');
})().catch(err => { console.error(err); process.exit(1); });

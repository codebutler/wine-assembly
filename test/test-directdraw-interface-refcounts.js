#!/usr/bin/env node
'use strict';

// DirectDraw counts references per interface. After
// QueryInterface(IID_IDirectDraw2) the IDirectDraw and IDirectDraw2 pointers
// each hold their own count, and IDirectDraw::Release returns IDirectDraw's --
// 0 in the "QI for v2, release v1" idiom -- while the object lives on through
// IDirectDraw2. Outwars' driver enumeration (owtrial.exe 0x4f2219) skips any
// driver whose IDirectDraw::Release does not return 0, finds none, and exits.
// The object's total still decides when it is freed.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t_create") (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_DirectDrawCreate (i32.const 0) (local.get $out) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "t_query") (param $obj i32) (param $iid i32) (param $out i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectDraw_QueryInterface (local.get $obj) (local.get $iid) (local.get $out)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "t_addref") (param $obj i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_dx_com_addref (local.get $obj) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "t_release") (param $obj i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_dx_com_release_basic (local.get $obj) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "t_total") (param $obj i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $obj))))
  (func (export "t_type") (param $obj i32) (result i32)
    (load.field DxObject type (call $dx_from_this (local.get $obj))))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const exe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging());
  assert(e.load_pe(exe.length)); e.init_dx_com_thunks();
  const out = e.guest_alloc(8) >>> 0;
  const iidDD2 = e.guest_alloc(16) >>> 0;
  [0xB3A6F3E0, 0x11CF2B43, 0xAA00DEA2, 0x5633B900].forEach((w, i) => e.guest_write32(iidDD2 + i * 4, w));

  // A lone IDirectDraw: AddRef/Release return the plain count, as before.
  assert.strictEqual(e.t_create(out), 0, 'DirectDrawCreate');
  const solo = e.guest_read32(out) >>> 0;
  assert.strictEqual(e.t_addref(solo), 2);
  assert.strictEqual(e.t_release(solo), 1);
  assert.strictEqual(e.t_release(solo), 0, 'last release');

  // QI for IDirectDraw2, then release IDirectDraw: 0, object alive.
  assert.strictEqual(e.t_create(out), 0);
  const dd = e.guest_read32(out) >>> 0;
  assert.strictEqual(e.t_query(dd, iidDD2, out + 4), 0, 'QI IDirectDraw2');
  const dd2 = e.guest_read32(out + 4) >>> 0;
  assert.notStrictEqual(dd2, dd, 'a distinct IDirectDraw2 pointer');
  assert.strictEqual(e.t_total(dd), 2, 'object holds both references');
  assert.strictEqual(e.t_release(dd), 0, 'IDirectDraw::Release returns its own count, 0');
  assert.notStrictEqual(e.t_type(dd2), 0, 'the object lives on through IDirectDraw2');
  assert.strictEqual(e.t_total(dd2), 1);
  // IDirectDraw2 keeps its own count.
  assert.strictEqual(e.t_addref(dd2), 2, 'IDirectDraw2::AddRef');
  assert.strictEqual(e.t_release(dd2), 1);
  assert.strictEqual(e.t_release(dd2), 0, 'IDirectDraw2 last release');
  assert.strictEqual(e.t_type(dd2), 0, 'object freed with its last interface reference');

  // A new object in the same slot starts with clean interface counts.
  assert.strictEqual(e.t_create(out), 0);
  const fresh = e.guest_read32(out) >>> 0;
  assert.strictEqual(e.t_query(fresh, iidDD2, out + 4), 0);
  const fresh2 = e.guest_read32(out + 4) >>> 0;
  assert.strictEqual(e.t_release(fresh2), 0, 'fresh IDirectDraw2 count is 1, not carried over');
  assert.strictEqual(e.t_release(fresh), 0);
  console.log('PASS DirectDraw interfaces keep their own reference counts');
})().catch(error => { console.error(error.stack || error); process.exit(1); });

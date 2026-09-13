#!/usr/bin/env node
'use strict';
const assert = require('assert');
const table = require('../src/api_table.json');
const { interfaces } = require('../tools/d3d8-methods');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const methods = interfaces[0].methods;
  assert.deepStrictEqual(methods.map(m => m.name), [
    'QueryInterface', 'AddRef', 'Release', 'RegisterSoftwareDevice',
    'GetAdapterCount', 'GetAdapterIdentifier', 'GetAdapterModeCount',
    'EnumAdapterModes', 'GetAdapterDisplayMode', 'CheckDeviceType',
    'CheckDeviceFormat', 'CheckDeviceMultiSampleType', 'CheckDepthStencilMatch',
    'GetDeviceCaps', 'GetAdapterMonitor', 'CreateDevice',
  ], 'the spec preserves the 16-slot IDirect3D8 ABI');
  const rows = methods.map(m => table.find(a => a.name === `IDirect3D8_${m.name}`));
  assert(rows.every(Boolean));
  assert(rows.every((row, i) => row.id === rows[0].id + i),
    'IDirect3D8 API IDs are contiguous in vtable order');
  assert.deepStrictEqual(rows.map(r => r.nargs), methods.map(m => m.nargs));

  const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat: `
    (func (export "d3d8_create") (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_Direct3DCreate8 (i32.const 220) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_caps") (param $p i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_IDirect3D8_GetDeviceCaps (i32.const 0) (i32.const 0)
        (i32.const 1) (local.get $p) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_identifier") (param $p i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_IDirect3D8_GetAdapterIdentifier (i32.const 0) (i32.const 0)
        (i32.const 2) (local.get $p) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_qi") (param $this i32) (param $iid i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_IDirect3D8_QueryInterface (local.get $this) (local.get $iid)
        (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_check_format") (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_d3d8_not_available_7 (i32.const 0) (i32.const 0)
        (i32.const 1) (i32.const 22) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_create_device") (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_d3d8_not_available_7 (i32.const 0) (i32.const 0)
        (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 0)) (global.get $eax))
  ` });

  e.init_dx_com_thunks();
  const factory = e.d3d8_create() >>> 0;
  assert(factory, 'Direct3DCreate8 returns a capability object');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff008);
  const p = 0x00409000;
  e.guest_write32(p, 0); e.guest_write32(p + 4, 0);
  e.guest_write32(p + 8, 0x000000c0); e.guest_write32(p + 12, 0x46000000);
  e.guest_write32(p + 16, 0xdeadbeef);
  assert.strictEqual(e.d3d8_qi(factory, p, p + 16), 0, 'IUnknown QI succeeds');
  assert.strictEqual(e.guest_read32(p + 16) >>> 0, factory);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff010);
  for (let i = -4; i <= 0x42c; i += 4) e.guest_write32(p + i, 0xdeadbeef);
  assert.strictEqual(e.d3d8_identifier(p), 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff014);
  assert.strictEqual(e.guest_read32(p - 4) >>> 0, 0xdeadbeef);
  assert.ok(Array.from({ length: 0x42c }, (_, i) => e.guest_read8(p + i)).every(v => v === 0));
  assert.strictEqual(e.guest_read32(p + 0x42c) >>> 0, 0xdeadbeef);
  e.guest_write32(p - 4, 0xdeadbeef); e.guest_write32(p + 0xd4, 0xdeadbeef);
  assert.strictEqual(e.d3d8_caps(p), 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff014);
  assert.strictEqual(e.guest_read32(p), 1);
  assert.strictEqual(e.guest_read32(p + 0x94), 8);
  assert.strictEqual(e.guest_read32(p + 0x98), 8);
  assert.strictEqual(e.guest_read32(p + 0xbc), 8, 'MaxStreams satisfies UE2');
  assert.strictEqual(e.guest_read32(p - 4) >>> 0, 0xdeadbeef);
  assert.strictEqual(e.guest_read32(p + 0xd4) >>> 0, 0xdeadbeef);
  assert.strictEqual(e.d3d8_check_format() >>> 0, 0x8876086a);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff020);
  assert.strictEqual(e.d3d8_create_device() >>> 0, 0x8876086a);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff020);
  console.log('PASS  Direct3D8 capability facade ABI, caps bounds, probe methods and explicit device failure');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });

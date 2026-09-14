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
  const deviceMethods = interfaces[1].methods;
  assert.strictEqual(deviceMethods.length, 97, 'IDirect3DDevice8 has its exact 97-slot ABI');
  assert.strictEqual(deviceMethods[71].name, 'DrawIndexedPrimitive');
  assert.strictEqual(deviceMethods[71].handler, undefined,
    'D3D8 DrawIndexedPrimitive uses its base-vertex-aware adapter');
  assert.strictEqual(deviceMethods[76].name, 'SetVertexShader');
  assert.strictEqual(deviceMethods[76].handler, undefined,
    'D3D8 SetVertexShader uses its ABI-aware FVF wrapper');
  assert.strictEqual(deviceMethods[16].handler, undefined,
    'D3D8 GetBackBuffer inserts the implicit D3D9 swap-chain index');
  const deviceRows = deviceMethods.map(m => table.find(a => a.name === `IDirect3DDevice8_${m.name}`));
  assert(deviceRows.every(Boolean));
  assert(deviceRows.every((row, i) => row.id === deviceRows[0].id + i),
    'IDirect3DDevice8 API IDs are contiguous in vtable order');
  const textureMethods = interfaces[2].methods;
  assert.strictEqual(textureMethods.length, 19, 'IDirect3DTexture8 has its exact 19-slot ABI');
  assert.strictEqual(textureMethods[14].name, 'GetLevelDesc');
  assert.strictEqual(textureMethods[16].name, 'LockRect');
  const textureRows = textureMethods.map(m => table.find(a => a.name === `IDirect3DTexture8_${m.name}`));
  assert(textureRows.every(Boolean));
  assert(textureRows.every((row, i) => row.id === textureRows[0].id + i),
    'IDirect3DTexture8 API IDs are contiguous in vtable order');

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
      (call $handle_IDirect3D8_CheckDeviceFormat (i32.const 0) (i32.const 0)
        (i32.const 1) (i32.const 22) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_create_device") (param $pp i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $pp))
      (call $gs32 (i32.const 0x074ff01c) (local.get $out))
      (call $handle_IDirect3D8_CreateDevice (i32.const 0) (i32.const 0)
        (i32.const 1) (i32.const 0) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_set_vertex_shader") (param $dev i32) (param $fvf i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_SetVertexShader (local.get $dev) (local.get $fvf)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_clear_stream") (param $dev i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_SetStreamSource (local.get $dev) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_set_indices") (param $dev i32) (param $buffer i32) (param $base i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_SetIndices (local.get $dev) (local.get $buffer)
        (local.get $base) (i32.const 0) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_index_base") (param $dev i32) (result i32)
      (local $state i32)
      (local.set $state (call $d3d9_program_state (local.get $dev)))
      (if (result i32) (local.get $state)
        (then (call $gl32 (i32.add (local.get $state) (i32.const 1692))))
        (else (i32.const 0))))
    (func (export "d3d8_get_render_target") (param $dev i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_GetRenderTarget (local.get $dev) (local.get $out)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_get_back_buffer") (param $dev i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_GetBackBuffer (local.get $dev) (i32.const 0)
        (i32.const 0) (local.get $out) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_create_texture") (param $dev i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (i32.const 21))
      (call $gs32 (i32.const 0x074ff01c) (i32.const 1))
      (call $gs32 (i32.const 0x074ff020) (local.get $out))
      (call $handle_IDirect3DDevice8_CreateTexture (local.get $dev) (i32.const 8)
        (i32.const 8) (i32.const 1) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_create_vertex_buffer") (param $dev i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $out))
      (call $handle_IDirect3DDevice8_CreateVertexBuffer (local.get $dev) (i32.const 240)
        (i32.const 0x18) (i32.const 0) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_create_index_buffer") (param $dev i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $gs32 (i32.const 0x074ff018) (local.get $out))
      (call $handle_IDirect3DDevice8_CreateIndexBuffer (local.get $dev) (i32.const 48)
        (i32.const 0x08) (i32.const 101) (i32.const 0) (i32.const 0)) (global.get $eax))
    (func (export "d3d8_create_vertex_decl") (param $dev i32) (param $tokens i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $handle_IDirect3DDevice8_CreateVertexShader (local.get $dev) (local.get $tokens)
        (i32.const 0) (local.get $out) (i32.const 0x10) (i32.const 0)) (global.get $eax))
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
  assert.strictEqual(e.guest_read32(p + 0xa0), 8);
  assert.strictEqual(e.guest_read32(p + 0xb4), 1048575);
  assert.strictEqual(e.guest_read32(p + 0xb8), 1048575);
  assert.strictEqual(e.guest_read32(p + 0xbc), 8, 'MaxStreams satisfies UE2');
  assert.strictEqual(e.guest_read32(p + 0xc8), 96);
  assert.strictEqual(e.guest_read32(p - 4) >>> 0, 0xdeadbeef);
  assert.strictEqual(e.guest_read32(p + 0xd4) >>> 0, 0xdeadbeef);
  assert.strictEqual(e.d3d8_check_format() >>> 0, 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff020);
  const pp = p + 0x500;
  const out = pp + 0x80;
  for (let i = 0; i < 13; i++) e.guest_write32(pp + i * 4, 0);
  e.guest_write32(pp, 320);
  e.guest_write32(pp + 4, 240);
  e.guest_write32(pp + 8, 22);
  e.guest_write32(pp + 12, 1);
  e.guest_write32(pp + 20, 1);
  e.guest_write32(pp + 28, 1);
  e.guest_write32(out, 0xdeadbeef);
  assert.strictEqual(e.d3d8_create_device(pp, out) >>> 0, 0);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff020);
  const device = e.guest_read32(out) >>> 0;
  assert(device, 'CreateDevice returns an IDirect3DDevice8 wrapper');
  const vtbl = e.guest_read32(device) >>> 0;
  const firstThunk = e.guest_read32(vtbl) >>> 0;
  assert.strictEqual(e.guest_read32(firstThunk + 4) >>> 0, deviceRows[0].id,
    'returned wrapper uses the D3D8 device vtable, not D3D9 slot order');
  assert.strictEqual(e.d3d8_set_vertex_shader(device, 2) >>> 0, 0,
    'D3D8 fixed-function SetVertexShader translates to D3D9 SetFVF');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c);
  assert.strictEqual(e.d3d8_clear_stream(device) >>> 0, 0,
    'D3D8 SetStreamSource inserts D3D9 offset zero');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff014);
  assert.strictEqual(e.d3d8_set_indices(device, 0, 0) >>> 0, 0,
    'D3D8 SetIndices clears the D3D9 index binding at base zero');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff010);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_get_render_target(device, out) >>> 0, 0,
    'D3D8 GetRenderTarget inserts D3D9 render-target index zero');
  assert(e.guest_read32(out), 'D3D8 GetRenderTarget returns the implicit backbuffer');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_get_back_buffer(device, out) >>> 0, 0,
    'D3D8 GetBackBuffer inserts implicit swap-chain zero');
  assert(e.guest_read32(out), 'D3D8 GetBackBuffer returns the implicit backbuffer');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff014);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_texture(device, out) >>> 0, 0,
    'D3D8 CreateTexture reuses the D3D9 resource allocator without a shared handle');
  const texture = e.guest_read32(out) >>> 0;
  assert(texture, 'D3D8 CreateTexture returns a texture object');
  const textureVtbl = e.guest_read32(texture) >>> 0;
  const textureFirstThunk = e.guest_read32(textureVtbl) >>> 0;
  assert.strictEqual(e.guest_read32(textureFirstThunk + 4) >>> 0, textureRows[0].id,
    'returned texture uses D3D8 slot order rather than the shifted D3D9 vtable');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff024);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_vertex_buffer(device, out) >>> 0, 0,
    'D3D8 CreateVertexBuffer reuses the D3D9 buffer allocator without a shared handle');
  assert(e.guest_read32(out), 'D3D8 CreateVertexBuffer returns a buffer object');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff01c);
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_index_buffer(device, out) >>> 0, 0,
    'D3D8 CreateIndexBuffer reuses the D3D9 buffer allocator without a shared handle');
  const indexBuffer = e.guest_read32(out) >>> 0;
  assert(indexBuffer, 'D3D8 CreateIndexBuffer returns a buffer object');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff01c);
  assert.strictEqual(e.d3d8_set_indices(device, indexBuffer, 0x1e5) >>> 0, 0,
    'D3D8 SetIndices accepts and retains a nonzero BaseVertexIndex');
  assert.strictEqual(e.d3d8_index_base(device) >>> 0, 0x1e5);
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff010);
  const tokens = pp + 0x200;
    [536870912, 0x40020000, 0x40020003, 0x40010007, 0x40010008, 0xffffffff]
    .forEach((token, i) => e.guest_write32(tokens + i * 4, token));
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_vertex_decl(device, tokens, out) >>> 0, 0,
    'D3D8 declaration tokens translate to a D3D9 vertex declaration');
  const declaration = e.guest_read32(out) >>> 0;
  assert(declaration, 'D3D8 CreateVertexShader returns an opaque declaration handle');
  assert.strictEqual(e.get_esp() >>> 0, 0x074ff018);
  assert.strictEqual(e.d3d8_set_vertex_shader(device, declaration) >>> 0, 0,
    'D3D8 SetVertexShader binds an opaque translated declaration handle');
    [536870912, 0x40020000, 536870913, 0x40040006, 536870915,
    0x40010007, 0xffffffff]
    .forEach((token, i) => e.guest_write32(tokens + i * 4, token));
  e.guest_write32(out, 0);
  assert.strictEqual(e.d3d8_create_vertex_decl(device, tokens, out) >>> 0, 0,
    'D3D8 accepts UE2 software declarations split over streams 0..3');
  assert(e.guest_read32(out), 'multi-stream compatibility declaration returns a handle');
  console.log('PASS  Direct3D8 factory/device ABI, caps bounds and D3D9-backed device creation');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });

#!/usr/bin/env node
'use strict';
// A full DIB arena must not make a plain texture fail.
//
// Every arena surface costs whole 4K pages, so Slave Zero's demo level, which
// keeps ~10000 tiny textures live, filled all 63 MB. CreateSurface then failed
// (its renderer died in the error path), and once level 0 had storage the mip
// chain was truncated -- the game asks for exactly dwMipMapCount levels and
// Locks each one it walks to, so a missing level was a NULL it called through.
// Plain textures (and their levels) now fall back to heap storage; surfaces
// that are scanned out still report DDERR_OUTOFVIDEOMEMORY.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

const extraWat = String.raw`
 (func (export "t_create") (param $dd i32) (param $desc i32) (param $out i32) (result i32)
  (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
  (call $handle_IDirectDraw_CreateSurface (local.get $dd) (local.get $desc) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load offset=0 (global.get $reg_base)))
 (func (export "t_dd") (result i32) (call $dx_create_com_obj (i32.const 1) (global.get $DX_VTBL_DDRAW)))
 (func (export "t_attached") (param $surface i32) (param $caps i32) (param $out i32) (result i32)
  (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
  (call $handle_IDirectDrawSurface_GetAttachedSurface (local.get $surface) (local.get $caps) (local.get $out) (i32.const 0) (i32.const 0) (i32.const 0))
  (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const wasm = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + extraWat : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({ getMemory: () => memory.buffer, renderer: null, resourceJson: {} });
  Object.assign(imports.host, { memory, create_thread: () => 0, exit_thread: () => 0,
    terminate_thread: () => 0, create_event: () => 0, set_event: () => 0,
    reset_event: () => 0, wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80004002 });
  const { instance } = await WebAssembly.instantiate(wasm, imports), e = instance.exports;
  const exe = fs.readFileSync(path.join(__dirname, 'binaries/calc.exe'));
  new Uint8Array(memory.buffer).set(exe, e.get_staging()); assert(e.load_pe(exe.length)); e.init_dx_com_thunks();

  const dd = e.t_dd() >>> 0;
  const desc = e.guest_alloc(124) >>> 0, out = e.guest_alloc(4) >>> 0, caps = e.guest_alloc(16) >>> 0;
  // dwFlags CAPS|HEIGHT|WIDTH|PIXELFORMAT (+MIPMAPCOUNT), 16-bit 1555 pixel format.
  function describe(w, h, ddsCaps, mips = 0) {
    for (let i = 0; i < 124; i += 4) e.guest_write32(desc + i, 0);
    e.guest_write32(desc, 124); e.guest_write32(desc + 4, 0x1007 | (mips ? 0x20000 : 0));
    e.guest_write32(desc + 8, h); e.guest_write32(desc + 12, w);
    if (mips) e.guest_write32(desc + 24, mips);
    e.guest_write32(desc + 72, 32); e.guest_write32(desc + 76, 0x41); e.guest_write32(desc + 84, 16);
    e.guest_write32(desc + 88, 0x7c00); e.guest_write32(desc + 92, 0x3e0); e.guest_write32(desc + 96, 0x1f); e.guest_write32(desc + 100, 0x8000);
    e.guest_write32(desc + 104, ddsCaps);
  }
  const create = () => { e.guest_write32(out, 0); return e.t_create(dd, desc, out) >>> 0; };

  // Fill the arena with 256x256 video-memory offscreen surfaces (128 KB each).
  describe(256, 256, 0x4040);
  let filled = 0;
  while (create() === 0) { assert(++filled < 2000, 'arena never filled'); }
  assert.equal(create(), 0x8876017C, 'arena full: offscreen plain still reports OUTOFVIDEOMEMORY');
  console.log(`  ok   arena full after ${filled} offscreen surfaces`);

  // Plain textures: many, all succeed with storage.
  describe(2, 2, 0x5000); // TEXTURE|VIDEOMEMORY
  for (let i = 0; i < 2000; i++) {
    assert.equal(create(), 0, `texture ${i} created on heap storage`);
    assert.notEqual(e.guest_read32(out) >>> 0, 0);
  }
  console.log('  ok   2000 textures after the arena filled');

  // A mipmapped texture with an explicit level count gets every level.
  describe(64, 64, 0x405008, 7); // COMPLEX|TEXTURE|VIDEOMEMORY|MIPMAP
  assert.equal(create(), 0, 'mipmapped texture created');
  let level = e.guest_read32(out) >>> 0, levels = 1;
  for (;;) {
    for (let i = 0; i < 16; i += 4) e.guest_write32(caps + i, 0);
    e.guest_write32(caps, 0x401000); // TEXTURE|MIPMAP
    e.guest_write32(out, 0);
    if (e.t_attached(level, caps, out) >>> 0) break;
    level = e.guest_read32(out) >>> 0; assert.notEqual(level, 0); levels++;
  }
  assert.equal(levels, 7, 'all dwMipMapCount levels exist with the arena full');
  console.log('  ok   7-level mip chain with the arena full');

  // Scanned-out surfaces do not take the fallback.
  describe(64, 64, 0x6000); // 3DDEVICE|VIDEOMEMORY (+ texture-less)
  assert.equal(create(), 0x8876017C, '3D render target still OUTOFVIDEOMEMORY');
  describe(64, 64, 0x7000); // TEXTURE|3DDEVICE|VIDEOMEMORY
  assert.equal(create(), 0x8876017C, 'texture render target still OUTOFVIDEOMEMORY');
  console.log('PASS full DIB arena: plain textures and their mip levels fall back to heap storage');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });

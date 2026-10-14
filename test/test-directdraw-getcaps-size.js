#!/usr/bin/env node
'use strict';
// IDirectDraw::GetCaps honours each DDCAPS dwSize, and a dwSize that is no
// DDCAPS size at all is DDERR_INVALIDPARAMS with nothing written.
//
// It used to treat such a size as 380 and write 380 bytes. Interstate '76
// Nitro never sets dwSize on its two stack DDCAPS: on Windows the call fails
// and it logs stack garbage, while the 380-byte write ran over its frame and
// the function returned into the CRT exit (docs/re-notes/interstate76-arsenal-demo.md).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');

const extraWat = String.raw`
 (func (export "test_getcaps") (param $hal i32) (param $hel i32) (result i32)
  (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
  (call $handle_IDirectDraw_GetCaps (i32.const 0) (local.get $hal) (local.get $hel) (i32.const 0) (i32.const 0) (i32.const 0))
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

  const SPAN = 512, GUARD = 0xa5a5a5a5;
  const hal = e.guest_alloc(SPAN) >>> 0, hel = e.guest_alloc(SPAN) >>> 0;
  const fill = (p, size) => { for (let i = 0; i < SPAN; i += 4) e.guest_write32(p + i, GUARD); e.guest_write32(p, size); };
  const firstDirty = (p, from) => { for (let i = from; i < SPAN; i += 4) if ((e.guest_read32(p + i) >>> 0) !== GUARD) return i; return -1; };

  // Valid sizes: filled up to dwSize and not one byte further, both structures.
  for (const size of [316, 364, 380]) {
    fill(hal, size); fill(hel, size);
    assert.equal(e.test_getcaps(hal, hel) >>> 0, 0, `DD_OK for dwSize ${size}`);
    assert.equal(e.get_esp() >>> 0, 0x300010, 'stdcall pops this + two pointers + return');
    for (const p of [hal, hel]) {
      assert.equal(e.guest_read32(p) >>> 0, size, 'dwSize preserved');
      assert.equal(e.guest_read32(p + 4) & 1, 1, 'DDCAPS_3D reported');
      assert.equal(firstDirty(p, size), -1, `nothing written past dwSize ${size}`);
    }
  }
  // Only one structure requested.
  fill(hal, 316);
  assert.equal(e.test_getcaps(hal, 0) >>> 0, 0, 'driver caps alone');
  assert.equal(firstDirty(hal, 316), -1);

  // Invalid sizes: DDERR_INVALIDPARAMS and neither structure touched, even when
  // only one of the two is bad.
  for (const [halSize, helSize] of [[0, 0], [0, 380], [380, 0], [0xa5a5a5a5, 316], [12, 380], [1024, 380]]) {
    fill(hal, halSize); fill(hel, helSize);
    assert.equal(e.test_getcaps(hal, hel) >>> 0, 0x80070057, `INVALIDPARAMS for ${halSize}/${helSize}`);
    assert.equal(e.get_esp() >>> 0, 0x300010, 'stdcall cleanup on failure too');
    assert.equal(firstDirty(hal, 4), -1, 'driver caps untouched');
    assert.equal(firstDirty(hel, 4), -1, 'HEL caps untouched');
    assert.equal(e.guest_read32(hal) >>> 0, halSize >>> 0);
  }
  console.log('PASS IDirectDraw::GetCaps dwSize validation');
})().catch(err => { console.error(err); process.exit(1); });

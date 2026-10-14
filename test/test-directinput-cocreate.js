#!/usr/bin/env node
'use strict';

// Evolva's demo creates DirectInput through COM -- CoCreateInstance(
// CLSID_DirectInput, IID_IUnknown), QueryInterface(IDirectInputA), then
// IDirectInput::Initialize(hinst, 0x0700) -- instead of DirectInputCreate.
// CoCreateInstance did not know the class, and Initialize popped 20 bytes for
// its 3 arguments, so the EBP-framed caller restored EBX/ESI/EDI from slots four
// bytes off and its next CreateDevice got a NULL out pointer.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const apiTable = require('../src/api_table.json');

const extraWat = String.raw`
  (func (export "test_cocreate")
      (param $clsid i32) (param $iid i32) (param $outer i32) (param $out i32)
      (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_CoCreateInstance
      (local.get $clsid) (local.get $outer) (i32.const 1) (local.get $iid)
      (local.get $out) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_initialize")
      (param $this i32) (param $hinst i32) (param $version i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x30000))
    (call $handle_IDirectInput_Initialize
      (local.get $this) (local.get $hinst) (local.get $version)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_esp") (result i32) (i32.load offset=16 (global.get $reg_base)))

  (func (export "test_refcount") (param $this i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $this))))

  (func (export "test_version") (param $this i32) (result i32)
    (load.field DxObject misc0 (call $dx_from_this (local.get $this))))
`;

function writeGuid(wat, at, words) {
  words.forEach((w, i) => wat.guest_write32(at + i * 4, w));
}

(async () => {
  let hostCreates = 0;
  const { exports: wat, memory } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      com_create_instance: () => { hostCreates++; return 0x80040154; },
    },
  });
  const exe = fs.readFileSync(path.join(__dirname, 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(exe, wat.get_staging());
  assert(wat.load_pe(exe.length), 'fixture PE initializes the DirectX vtables');
  wat.init_dx_com_thunks();

  const clsid = wat.guest_alloc(16) >>> 0;
  const iunknown = wat.guest_alloc(16) >>> 0;
  const idi7 = wat.guest_alloc(16) >>> 0;
  const idi8 = wat.guest_alloc(16) >>> 0;
  const out = wat.guest_alloc(4) >>> 0;
  writeGuid(wat, clsid, [0x25e609e0, 0x11cfb259, 0x4544c7bf, 0x00005453]); // CLSID_DirectInput
  writeGuid(wat, iunknown, [0, 0, 0x000000c0, 0x46000000]);
  writeGuid(wat, idi7, [0x9a4cb684, 0x11d3236d, 0xc0009d8e, 0xae44684f]); // IID_IDirectInput7A
  writeGuid(wat, idi8, [0xbf798030, 0x4da2483a, 0x645d99aa, 0x009736ed]); // IID_IDirectInput8A

  assert.strictEqual(wat.test_cocreate(clsid, iunknown, 0, out) >>> 0, 0,
    'CoCreateInstance(CLSID_DirectInput, IID_IUnknown) succeeds');
  assert.strictEqual(hostCreates, 0, 'DirectInput is created natively, not through the host');
  assert.strictEqual(wat.test_esp() >>> 0, 0x30018, 'CoCreateInstance pops ret + 5 args');
  const di = wat.guest_read32(out) >>> 0;
  assert(di, 'an IDirectInput object comes back');
  assert.strictEqual(wat.test_refcount(di), 1, 'exactly one caller-owned reference');
  assert.strictEqual(wat.test_version(di), 0, 'not initialized until Initialize');

  // IDirectInput::Initialize(this, hinst, dwVersion): 3 args + return = 16 bytes.
  const initId = apiTable.find(a => a.name === 'IDirectInput_Initialize');
  assert.strictEqual(initId.nargs, 3, 'api_table: Initialize takes this, hinst, dwVersion');
  assert.strictEqual(wat.test_initialize(di, 0x400000, 0x0700) >>> 0, 0);
  assert.strictEqual(wat.test_esp() >>> 0, 0x30010, 'Initialize pops ret + 3 args, not 4');
  assert.strictEqual(wat.test_version(di), 0x0700, 'Initialize records the version');

  wat.guest_write32(out, 0);
  assert.strictEqual(wat.test_cocreate(clsid, idi7, 0, out) >>> 0, 0,
    'the class also answers IDirectInput7A directly');
  assert(wat.guest_read32(out) >>> 0, 'IDirectInput7 wrapper returned');

  wat.guest_write32(out, 0xfeedface);
  assert.strictEqual(wat.test_cocreate(clsid, idi8, 0, out) >>> 0, 0x80004002,
    'CLSID_DirectInput is the pre-8 class: IDirectInput8 is E_NOINTERFACE');
  assert.strictEqual(wat.guest_read32(out) >>> 0, 0, 'a refused query clears the output');

  console.log('PASS  CoCreateInstance(CLSID_DirectInput) + IDirectInput::Initialize pops 16 (Evolva)');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

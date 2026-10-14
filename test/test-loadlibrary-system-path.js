#!/usr/bin/env node
'use strict';

// LoadLibrary of a built-in module by its full system-directory path. Win98's
// loader finds C:\WINDOWS\SYSTEM\kernel32.dll already mapped and returns the
// handle; the Die Hard: Nakatomi Plaza demo's Wise setup loads kernel32 by
// exactly that path on its Destination page and aborts with "Could not load
// the DLL library" when the answer is NULL. A path anywhere else still names a
// file on disk, and with no such file the load still fails.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  ;; The harness loads no PE, and a built-in module's handle is the program's
  ;; image base, so give it a real one.
  (func (export "test_set_image_base") (param $base i32)
    (global.set $image_base (local.get $base)))

  (func (export "test_call_LoadLibraryA") (param $name i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_LoadLibraryA (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load offset=0 (global.get $reg_base)))
`;

async function main() {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.test_set_image_base(0x00400000);
  const bytes = new Uint8Array(memory.buffer);
  const guestToWasm = guest =>
    (guest - (e.get_image_base() >>> 0) + (e.get_guest_base() >>> 0)) >>> 0;
  const load = value => {
    const guest = e.guest_alloc(value.length + 1) >>> 0;
    const wasm = guestToWasm(guest);
    for (let i = 0; i < value.length; i++) bytes[wasm + i] = value.charCodeAt(i);
    bytes[wasm + value.length] = 0;
    return e.test_call_LoadLibraryA(guest) >>> 0;
  };

  const bare = load('kernel32.dll');
  assert(bare, 'the bare built-in name loads');
  assert.strictEqual(load('C:\\WINDOWS\\SYSTEM\\kernel32.dll'), bare,
    'the Wise setup spelling: full system-directory path');
  assert.strictEqual(load('c:/windows/system/KERNEL32.DLL'), bare,
    'case and forward slashes do not matter');
  assert.strictEqual(load('C:\\WINDOWS\\kernel32.dll'), bare,
    'the Windows directory is on the search path too');

  const ddraw = load('ddraw.dll');
  assert.strictEqual(load('C:\\WINDOWS\\SYSTEM\\ddraw.dll'), ddraw,
    'a statically dispatched DirectX module keeps its own handle by path');

  assert.strictEqual(load('C:\\Games\\kernel32.dll'), 0,
    'a path outside the system directories still names a missing file');
  assert.strictEqual(load('C:\\WINDOWS\\SYSTEM\\SUB\\kernel32.dll'), 0,
    'a subdirectory of the system directory is not the system directory');

  // Optional modules a stock Win98 box lacks fail to load, so a probe takes
  // the "not installed" path: Trespasser's A3D probe called through NULL when
  // it got a handle with no A3dCreate in it.
  assert.strictEqual(load('A3d.dll'), 0, 'Aureal A3D is not installed');
  assert.strictEqual(load('C:\\WINDOWS\\SYSTEM\\a3d.dll'), 0, 'not by system path either');
  assert.strictEqual(load('msi.dll'), 0, 'Windows Installer is not installed');
  assert(load('d3d9.dll'), 'a component we dispatch by API name still loads by bare name');

  console.log('PASS test-loadlibrary-system-path');
}

main().catch(err => { console.error(err); process.exit(1); });

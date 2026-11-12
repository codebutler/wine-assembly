'use strict';
// Compiled handler/ABI fixture. Requires the normal render harness; this is
// deliberately separate from the allocation-light JavaScript VFS regression.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const extraWat = `
  (func (export "test_lock_error") (result i32) (global.get $last_error))
  (func (export "test_lock") (param $h i32) (param $lo i32) (param $hi i32)
    (param $nlo i32) (param $nhi i32) (param $unlock i32) (result i32)
    (global.set $last_error (i32.const 0x1234))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (if (local.get $unlock)
      (then (call $handle_UnlockFile (local.get $h) (local.get $lo) (local.get $hi)
        (local.get $nlo) (local.get $nhi) (i32.const 0)))
      (else (call $handle_LockFile (local.get $h) (local.get $lo) (local.get $hi)
        (local.get $nlo) (local.get $nhi) (i32.const 0))))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const 0x074ff018))
      (then (unreachable)))
    (i32.load (global.get $reg_base)))
  (func (export "test_lock_dup") (param $h i32) (param $process i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $gs32 (i32.const 0x074ff018) (i32.const 0))
    (call $gs32 (i32.const 0x074ff01c) (i32.const 2))
    (call $handle_DuplicateHandle (i32.const -1) (local.get $h) (local.get $process)
      (i32.const 0x00490000) (i32.const 0) (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const 0x074ff020))
      (then (unreachable)))
    (if (i32.eqz (i32.load (global.get $reg_base))) (then (return (i32.const 0))))
    (call $gl32 (i32.const 0x00490000)))
  (func (export "test_lock_crt_dup") (param $h i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle__dup (local.get $h) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (if (i32.ne (i32.load offset=16 (global.get $reg_base)) (i32.const 0x074ff004))
      (then (unreachable)))
    (i32.load (global.get $reg_base)))
`;
(async () => {
  const tailCalls = !process.argv.includes('--compat');
  const { exports: wat, hostCtx, memory } = await bootRenderHarness({ extraWat, tailCalls, fonts: 'none' });
  // Load the existing deterministic PE, then use its real imported APIs and
  // execute the returned public export thunks through the interpreter.
  const { makeFixture, iat } = require('../tools/kernel32-native-fixture');
  const fixture = makeFixture();
  new Uint8Array(memory.buffer).set(fixture, wat.get_staging());
  assert(wat.load_pe(fixture.length));
  const dv = new DataView(memory.buffer);
  const wa = p => wat.guest_to_wasm(p) >>> 0;
  const string = text => {
    const p = wat.guest_alloc(text.length + 1) >>> 0;
    assert(p); new Uint8Array(memory.buffer).set(Buffer.from(text + '\0'), wa(p)); return p;
  };
  const stack = wat.guest_alloc(65536) + 65520;
  const call = (address, args) => {
    wat.set_esp(stack);
    wat.call_func(address, ...Array.from({ length: 4 }, (_, i) => args[i] || 0));
    const before = wat.get_esp() >>> 0;
    for (let i = 4; i < args.length; i++) dv.setUint32(wa(before + 4 * (i + 1)), args[i] >>> 0, true);
    for (let i = 0; i < 20000 && wat.get_eip(); i++) {
      wat.run(100);
      assert.equal(wat.get_yield_reason(), 0, 'file API must complete without parking');
    }
    assert.equal(wat.get_eip(), 0, 'bounded public dispatch');
    assert.equal(wat.get_esp() >>> 0, before + 4 * (args.length + 1), 'public stdcall cleanup');
    return wat.get_eax() >>> 0;
  };
  const api = (name, args) => call(dv.getUint32(wa(iat(name)), true), args);
  const kernel = api('GetModuleHandleA', [string('kernel32.dll')]);
  assert(kernel && kernel !== 0x400000);
  const publicLock = api('GetProcAddress', [kernel, string('LockFile')]);
  const publicUnlock = api('GetProcAddress', [kernel, string('UnlockFile')]);
  assert(publicLock && publicUnlock && publicLock !== publicUnlock);
  assert.equal(api('GetProcAddress', [kernel, 591]), publicLock);
  assert.equal(api('GetProcAddress', [kernel, 592]), publicUnlock);
  assert.equal(api('GetProcAddress', [kernel, string('lockfile')]), 0, 'names are case sensitive');
  const vfs = hostCtx.vfs;
  const a = vfs.createFile('c:\\lock-abi.bin', 0xc0000000, 2);
  const b = vfs.createFile('c:\\lock-abi.bin', 0xc0000000, 3);
  assert.equal(call(publicLock, [a, 3, 0x200000, 4, 1]), 1, 'both 64-bit halves cross public ABI');
  assert.equal(call(publicLock, [b, 4, 0x200001, 1, 0]), 0);
  assert.equal(api('GetLastError', []), 33);
  assert.equal(call(publicUnlock, [b, 3, 0x200000, 4, 1]), 0, 'wrong owner');
  assert.equal(api('GetLastError', []), 158);
  assert.equal(call(publicUnlock, [a, 3, 0x200000, 4, 1]), 1);
  assert.equal(call(publicLock, [-1, 0, 0, 1, 0]), 0);
  assert.equal(api('GetLastError', []), 6);
  // Wine's Windows conformance test test_LockFile checks zero-byte success,
  // exact unlock and the left-adjacent range unconditionally. Interior/right
  // conflicts are conditional on !limited_LockFile (legacy Windows differs).
  // Do not turn that conditional observation into a universal Win98 assertion.
  assert.equal(call(publicLock, [a, 100, 0, 0, 0]), 1);
  assert.equal(call(publicLock, [a, 90, 0, 10, 0]), 1);
  assert.equal(call(publicUnlock, [a, 90, 0, 10, 0]), 1);
  assert.equal(call(publicUnlock, [a, 100, 0, 10, 0]), 0);
  assert.equal(call(publicUnlock, [a, 100, 0, 0, 0]), 1);
  assert.equal(wat.test_lock(a, 3, 0x200000, 4, 0, 0), 1);
  assert.equal(wat.test_lock_error(), 0x1234, 'success preserves last error');
  assert.equal(wat.test_lock(b, 4, 0x200000, 1, 0, 0), 0);
  assert.equal(wat.test_lock_error(), 33);
  const duplicate = wat.test_lock_dup(a, -1);
  assert(duplicate > 0);
  assert.equal(wat.test_lock(duplicate, 3, 0x200000, 4, 0, 1), 1);
  assert.equal(wat.test_lock_dup(a, 0x12345678), 0);
  assert.equal(wat.test_lock_error(), 6);
  const crt = wat.test_lock_crt_dup(a);
  assert(crt > 0);
  assert.equal(wat.test_lock(crt, 7, 0, 1, 0, 0), 1);
  assert.equal(wat.test_lock(a, 7, 0, 1, 0, 1), 1);
  assert.equal(wat.test_lock(a, -1, -1, 2, 0, 0), 0);
  assert.equal(wat.test_lock_error(), 87);
  assert.equal(wat.test_lock(a, 7, 0, 1, 0, 1), 0);
  assert.equal(wat.test_lock_error(), 158);
  vfs.closeAllDiskHandles();
  console.log(`LockFile handlers: PASS (${tailCalls ? 'tail' : 'compat'})`);
})().catch(error => { console.error(error); process.exitCode = 1; });

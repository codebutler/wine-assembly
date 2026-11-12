#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const apis = require('../src/api_table.json');
const extraWat = `
  (func (export "ime_lookup") (param $name i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetProcAddress (global.get $image_base) (local.get $name)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "ime_invoke") (param $thunk i32) (param $stack i32) (result i32)
    (i32.store (global.get $reg_base) (i32.const -1))
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (global.set $eip (local.get $thunk))
    (call $win32_dispatch_inner (i32.div_u
      (i32.sub (call $g2w (local.get $thunk)) (global.get $THUNK_BASE)) (i32.const 8)))
    (i32.load offset=16 (global.get $reg_base)))
`;

(async () => {
  assert.strictEqual(apis.find(a => a.name === 'ImmGetProperty')?.nargs, 2);
  const { exports: e } = await bootRenderHarness({ fonts: 'none', extraWat });
  const stack = e.guest_alloc(64);
  const lookup = name => {
    const p = e.guest_alloc(name.length + 1);
    [...name, '\0'].forEach((c, i) => e.guest_write8(p + i, c.charCodeAt(0)));
    const thunk = e.ime_lookup(p, stack) >>> 0;
    assert.notStrictEqual(thunk, 0, name + ' resolves dynamically');
    return thunk;
  };
  const invoke = (thunk, args) => {
    e.guest_write32(stack, 0x12345678);
    args.forEach((a, i) => e.guest_write32(stack + 4 + i * 4, a));
    e.guest_write32(stack + 4 + args.length * 4, 0xdeadbeef);
    assert.strictEqual(e.ime_invoke(thunk, stack) >>> 0, stack + 4 + args.length * 4,
      'production dispatch consumes return address and exactly the stdcall arguments');
    assert.strictEqual(e.guest_read32(stack + 4 + args.length * 4) >>> 0, 0xdeadbeef);
    return e.get_eax() >>> 0;
  };
  const hkl = invoke(lookup('GetKeyboardLayout'), [0]);
  assert.strictEqual(hkl, 0x04090409);
  assert.strictEqual(invoke(lookup('ImmIsIME'), [hkl]), 0);
  const property = lookup('ImmGetProperty');
  // IGP_PROPERTY/CONVERSION/SENTENCE/UI/SETCOMPSTR/SELECT/GETIMEVERSION,
  // then invalid selectors. Even a forged East Asian IME HKL is not installed.
  for (const layout of [hkl, 0, 0xe0010411, 0xffffffff]) {
    for (const index of [4, 8, 12, 16, 20, 24, 0xfffffffc, 0, 1, 0xffffffff]) {
      assert.strictEqual(invoke(property, [layout, index]), 0,
        `no installed IME capabilities: HKL=${layout.toString(16)} index=${index.toString(16)}`);
    }
  }
  console.log('PASS ImmGetProperty dynamic dispatch, plain keyboard consistency, 40 capability/invalid queries and stdcall ABI');
})().catch(error => { console.error(error.stack || error); process.exit(1); });

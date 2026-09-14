#!/usr/bin/env node
'use strict';

// fclose and _close are separate CRT front doors, but this minimal CRT maps
// both FILE* and file descriptors directly to an unbuffered VFS handle. Pin
// the shared close/result path without erasing either handler's cdecl ABI.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const STACK = 0x00300000;
const source = fs.readFileSync(
  path.join(__dirname, '..', 'src', '09a6-handlers-crt.wat'), 'utf8');

assert.strictEqual((source.match(/\$crt_close_unbuffered_handle/g) || []).length, 3,
  'one close helper definition should serve exactly the two public handlers');
assert.strictEqual((source.match(/\$host_fs_close_handle/g) || []).length, 1,
  'CRT close result translation should have one host-close implementation');

const extraWat = String.raw`
  (func $test_crt_close_result (result i64)
    (i64.or
      (i64.extend_i32_u (global.get $eax))
      (i64.shl (i64.extend_i32_u (global.get $esp)) (i64.const 32))))

  (func (export "test_fclose") (param $handle i32) (result i64)
    (global.set $esp (i32.const ${STACK}))
    (call $handle_fclose
      (local.get $handle) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $test_crt_close_result))

  (func (export "test__close") (param $handle i32) (result i64)
    (global.set $esp (i32.const ${STACK}))
    (call $handle__close
      (local.get $handle) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $test_crt_close_result))
`;

(async () => {
  const calls = [];
  let hostResult = 1;
  const { exports: e } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      fs_close_handle(handle) {
        calls.push(handle >>> 0);
        return hostResult;
      },
    },
  });

  const invoke = (entry, handle, expectedResult) => {
    const packed = entry(handle);
    assert.strictEqual(Number(packed & 0xffffffffn) >>> 0, expectedResult >>> 0,
      'handler translates the host close result to the CRT return value');
    assert.strictEqual(Number(packed >> 32n) >>> 0, STACK + 4,
      'one-argument cdecl handler pops only its return address');
  };

  hostResult = 1;
  invoke(e.test_fclose, 0x12345678, 0);
  invoke(e.test__close, 0x87654321, 0);
  hostResult = 0;
  invoke(e.test_fclose, 0x10203040, -1);
  invoke(e.test__close, 0xfedcba98, -1);

  assert.deepStrictEqual(calls, [0x12345678, 0x87654321, 0x10203040, 0xfedcba98],
    'both front doors pass the original FILE*/descriptor value to the VFS');
  console.log('PASS  fclose/_close share raw close mechanics and preserve distinct CRT ABIs');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { setEnvironmentVariable } = require('../lib/process-boot');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_get_environment_strings")
        (param $ansi_suffix i32) (param $stack i32) (result i64)
    (global.set $esp (local.get $stack))
    (if (local.get $ansi_suffix)
      (then
        (call $handle_GetEnvironmentStringsA
          (i32.const 0) (i32.const 0) (i32.const 0)
          (i32.const 0) (i32.const 0) (i32.const 0)))
      (else
        (call $handle_GetEnvironmentStrings
          (i32.const 0) (i32.const 0) (i32.const 0)
          (i32.const 0) (i32.const 0) (i32.const 0))))
    (i64.or
      (i64.extend_i32_u (global.get $eax))
      (i64.shl (i64.extend_i32_u (global.get $esp)) (i64.const 32))))

  (func (export "test_free_environment_strings_a")
        (param $block i32) (param $stack i32) (result i64)
    (global.set $esp (local.get $stack))
    (call $handle_FreeEnvironmentStringsA
      (local.get $block) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (global.get $eax))
      (i64.shl (i64.extend_i32_u (global.get $esp)) (i64.const 32))))
`;

function readEnvironmentBlock(wat, pointer) {
  const bytes = [];
  let previous = -1;
  for (let index = 0; index < 32768; index++) {
    const byte = wat.guest_read8(pointer + index);
    bytes.push(byte);
    if (byte === 0 && previous === 0) return Buffer.from(bytes);
    previous = byte;
  }
  throw new Error('environment block was not double-NUL terminated');
}

(async () => {
  for (const name of ['GetEnvironmentStrings', 'GetEnvironmentStringsA']) {
    const api = apiTable.find(entry => entry.name === name);
    assert(api, `${name} is exported`);
    assert.strictEqual(api.nargs, 0, `${name} has no arguments`);
    assert.strictEqual(api.convention, 'stdcall', `${name} uses stdcall`);
  }

  const { exports: wat, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  assert(setEnvironmentVariable(wat, memory.buffer, 'ALIAS_TEST', 'ansi-value'));
  const stack = 0x074ff000;
  const blocks = [];
  for (const [ansiSuffix, name] of [[0, 'GetEnvironmentStrings'], [1, 'GetEnvironmentStringsA']]) {
    const packed = wat.test_get_environment_strings(ansiSuffix, stack);
    const block = Number(packed & 0xffffffffn) >>> 0;
    const resultingEsp = Number(packed >> 32n) >>> 0;
    assert(block, `${name} returns the current process environment`);
    assert.strictEqual(resultingEsp, stack + 4, `${name} pops only its return address`);
    blocks.push({ pointer: block, bytes: readEnvironmentBlock(wat, block) });
  }
  assert.notStrictEqual(blocks[0].pointer, blocks[1].pointer,
    'each call returns an independently owned environment block');
  assert.deepStrictEqual(blocks[0].bytes, blocks[1].bytes,
    'unsuffixed and A exports return identical ANSI environment bytes');
  assert(blocks[0].bytes.includes(Buffer.from('ALIAS_TEST=ansi-value\0', 'ascii')),
    'the copied block contains the process environment variable');
  assert.deepStrictEqual([...blocks[0].bytes.subarray(-2)], [0, 0],
    'the ANSI environment block ends with two NUL bytes');

  for (const { pointer } of blocks) {
    const packed = wat.test_free_environment_strings_a(pointer, stack);
    assert.strictEqual(Number(packed & 0xffffffffn), 1,
      'FreeEnvironmentStringsA releases either ANSI block');
    assert.strictEqual(Number(packed >> 32n) >>> 0, stack + 8,
      'FreeEnvironmentStringsA pops its pointer and return address');
  }

  console.log('PASS  GetEnvironmentStrings and GetEnvironmentStringsA share ANSI block semantics');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

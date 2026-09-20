#!/usr/bin/env node
'use strict';

// User32 wsprintfA and CRT sprintf share ANSI formatting mechanics, but not
// their full public contract. Pin the common 32-bit cdecl vararg walk while
// keeping separate policy wrappers for future contract-correct formatting.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');
const userSource = fs.readFileSync(path.join(ROOT, 'src', '09a-handlers2-runtime.wat'), 'utf8');
const crtSource = fs.readFileSync(path.join(ROOT, 'src', '09a6-handlers-crt.wat'), 'utf8');
const formatterSource = fs.readFileSync(path.join(ROOT, 'src', '12-wsprintf.wat'), 'utf8');

assert.match(userSource,
  /\(func \$handle_wsprintfA[\s\S]*?\(call \$wsprintf_impl[\s\S]*?\(i32\.const 12\)/,
  'the User32 front door should retain its own stack-vararg policy');
assert.match(crtSource,
  /\(func \$handle_sprintf[\s\S]*?\(call \$sprintf_impl[\s\S]*?\(i32\.const 12\)/,
  'the CRT front door should retain its own stack-vararg policy');
assert.doesNotMatch(crtSource, /\(call \$wsprintf_impl(?:\s|\()/,
  'CRT formatting front doors must not inherit the User32 output ceiling');
assert.strictEqual((formatterSource.match(/\(func \$format_core\b/g) || []).length, 1,
  'one internal engine should own the shared formatting mechanics');
assert.match(formatterSource,
  /\(func \$wsprintf_impl[\s\S]*?\(call \$format_core[\s\S]*?\(i32\.const 1\)\)\)/,
  'the User32 wrapper should preserve its policy identity');
assert.match(formatterSource,
  /\(func \$sprintf_impl[\s\S]*?\(call \$format_core[\s\S]*?\(i32\.const 0\)\)\)/,
  'the CRT wrapper should preserve its policy identity');

const STACK = 0x00300000;
const extraWat = String.raw`
  (func $test_format_result (result i64)
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func $test_seed_format_args (param $value0 i32) (param $value1 i32)
    (call $gs32 (i32.const ${STACK + 12}) (local.get $value0))
    (call $gs32 (i32.const ${STACK + 16}) (local.get $value1)))

  (func (export "test_wsprintfA_frontdoor")
        (param $out i32) (param $fmt i32) (param $value0 i32) (param $value1 i32)
        (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (call $test_seed_format_args (local.get $value0) (local.get $value1))
    (call $handle_wsprintfA
      (local.get $out) (local.get $fmt) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $test_format_result))

  (func (export "test_sprintf_frontdoor")
        (param $out i32) (param $fmt i32) (param $value0 i32) (param $value1 i32)
        (result i64)
    (i32.store offset=16 (global.get $reg_base) (i32.const ${STACK}))
    (call $test_seed_format_args (local.get $value0) (local.get $value1))
    (call $handle_sprintf
      (local.get $out) (local.get $fmt) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $test_format_result))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  e.heap_init(0x00420000);
  const bytes = new Uint8Array(memory.buffer);
  const wa = guest => (guest - (e.get_image_base() >>> 0) +
    (e.get_guest_base() >>> 0)) >>> 0;

  const allocA = text => {
    const guest = e.guest_alloc(text.length + 1) >>> 0;
    bytes.set(Buffer.from(text, 'latin1'), wa(guest));
    bytes[wa(guest) + text.length] = 0;
    return guest;
  };
  const allocOut = size => {
    const guest = e.guest_alloc(size) >>> 0;
    bytes.fill(0xa5, wa(guest), wa(guest) + size);
    return guest;
  };
  const readA = guest => {
    let text = '';
    for (let i = 0; i < 4096; i++) {
      const byte = bytes[wa(guest) + i];
      if (!byte) return text;
      text += String.fromCharCode(byte);
    }
    throw new Error('unterminated formatter result');
  };
  const unpack = packed => ({
    result: Number(packed & 0xffffffffn) >>> 0,
    esp: Number(packed >> 32n) >>> 0,
  });

  const text = allocA('stack %d %s');
  const word = allocA('walk');
  for (const entry of [e.test_wsprintfA_frontdoor, e.test_sprintf_frontdoor]) {
    const out = allocOut(64);
    const result = unpack(entry(out, text, 98, word));
    assert.deepStrictEqual(result, { result: 13, esp: STACK + 4 },
      'both cdecl front doors read varargs at ESP+12 and pop only the return address');
    assert.strictEqual(readA(out), 'stack 98 walk');
  }

  const longText = 'x'.repeat(1100);
  const longFormat = allocA(longText);
  // Microsoft documents the User32 buffer maximum, but not enough truncation
  // detail here to invent a Win98 oracle. Preserve the emulator's existing
  // output byte-for-byte until that behavior is measured directly.
  for (const entry of [e.test_wsprintfA_frontdoor, e.test_sprintf_frontdoor]) {
    const out = allocOut(1200);
    const result = unpack(entry(out, longFormat, 0, 0));
    assert.deepStrictEqual(result, { result: 1100, esp: STACK + 4 });
    assert.strictEqual(readA(out), longText,
      'the policy split must not change currently-supported formatting output');
  }

  console.log('PASS  wsprintfA/sprintf share mechanics behind distinct front doors');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

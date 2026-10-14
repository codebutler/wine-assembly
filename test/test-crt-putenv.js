#!/usr/bin/env node

'use strict';

// msvcrt _putenv("NAME=value"): sets the variable getenv reads, "NAME="
// removes it, a string without '=' (or with no name) fails with -1, and the
// caller's string is not modified. Slave Zero calls it at startup and used to
// stop at crash_unimplemented in the browser (no real msvcrt there).

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_putenv") (param $s i32) (result i32)
    (global.set $image_base (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle__putenv (local.get $s) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "test_getenv") (param $name i32) (result i32)
    (global.set $image_base (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_getenv (local.get $name) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const str = 0x2600, name = 0x2700;
  const writeAscii = (address, text) => {
    for (let i = 0; i <= text.length; i++) wat.guest_write8(address + i, i < text.length ? text.charCodeAt(i) : 0);
  };
  const readAscii = address => {
    let text = '';
    for (let i = 0; ; i++) { const code = wat.guest_read8(address + i); if (!code) return text; text += String.fromCharCode(code); }
  };
  const getenv = key => { writeAscii(name, key); const p = wat.test_getenv(name) >>> 0; return p ? readAscii(p) : null; };
  const putenv = text => { writeAscii(str, text); const r = wat.test_putenv(str) | 0; assert.strictEqual(wat.get_esp() >>> 0, 0x300004, 'cdecl: only the return address popped'); return r; };

  assert.strictEqual(putenv('SZ_TEST=hello world'), 0, 'set');
  assert.strictEqual(readAscii(str), 'SZ_TEST=hello world', 'caller string untouched');
  assert.strictEqual(getenv('SZ_TEST'), 'hello world');
  assert.strictEqual(putenv('SZ_TEST=again=with=equals'), 0, 'replace; only the first = splits');
  assert.strictEqual(getenv('SZ_TEST'), 'again=with=equals');
  assert.strictEqual(putenv('SZ_TEST='), 0, 'empty value removes');
  assert.strictEqual(getenv('SZ_TEST'), null);
  assert.strictEqual(putenv('NOEQUALS'), -1, 'no = fails');
  assert.strictEqual(putenv('=value'), -1, 'no name fails');
  assert.strictEqual(wat.test_putenv(0) | 0, -1, 'NULL fails');
  console.log('PASS _putenv sets, replaces and removes process environment variables');
})().catch(error => { console.error(error); process.exit(1); });

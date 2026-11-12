#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const { compile } = require('../tools/watx');
const source = fs.readFileSync(require('path').join(__dirname, '../src/09a6-handlers-crt.wat'), 'utf8');
function fn(name) {
  const start = source.indexOf(`(func $${name} `);
  assert(start >= 0, name);
  let depth = 0, result = '';
  for (const line of source.slice(start).split('\n')) {
    for (const c of line.replace(/;;.*/, '') + '\n') {
      result += c;
      if (c === '(') depth++;
      if (c === ')' && --depth === 0) return result;
    }
  }
  throw Error(name);
}
const built = compile(`
  (memory 1)
  (export "memory" (memory 0))
  (global $reg_base i32 (i32.const 256))
  (func $g2w (param $p i32) (result i32) (i32.add (local.get $p) (i32.const 4096)))
  (func $gs32 (param $p i32) (param $v i32) (i32.store (call $g2w (local.get $p)) (local.get $v)))
  (func $fpu_push (param $v f64) (f64.store (i32.const 128) (local.get $v)))
  ${['crt_digit_value', 'crt_is_space', 'crt_strtod_simple', 'handle_strtod', 'handle_atof', 'handle_abs'].map(fn).join('\n')}
  (export "abs" (func $handle_abs))
  (export "strtod" (func $handle_strtod))
  (export "atof" (func $handle_atof))`, new Map(), {mode: 'production'});
assert(built.success, built.error);
const e = new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary)).exports;
const bytes = new Uint8Array(e.memory.buffer), view = new DataView(e.memory.buffer);
const cases = [
  ['8.5', 8.5, 3], ['  -12.25tail', -12.25, 8], ['+.5!', .5, 3],
  ['1e+2x', 100, 4], ['1E-2', .01, 4], ['1e+', 1, 1], ['1e-x', 1, 1],
  ['  +.', 0, 0], ['', 0, 0], ['xyz', 0, 0], ['0foo', 0, 1],
  ['-0', -0, 2], ['2e99999999999999999999999', Infinity, 25],
];
for (const [text, expected, consumed] of cases) {
  bytes.set(Buffer.from(text + '\0'), 4096 + 1024);
  view.setUint32(256 + 16, 8192, true);
  view.setUint32(4096 + 2048, 0xdeadbeef, true);
  e.strtod(1024, 2048, 0, 0, 0, 0);
  assert.equal(view.getUint32(4096 + 2048, true), 1024 + consumed, text + ' endptr');
  assert(Object.is(view.getFloat64(128, true), expected) ||
    Math.abs(view.getFloat64(128, true) - expected) < 1e-14, text + ' value');
  assert.equal(view.getUint32(256 + 16, true), 8196, 'cdecl caller retains arguments');
  e.strtod(1024, 0, 0, 0, 0, 0);
  e.atof(1024, 0, 0, 0, 0, 0);
}
for (const value of [0, -5, 5, -2147483647, -2147483648, 2147483647]) {
  view.setUint32(272, 8192, true);
  e.abs(value, 0, 0, 0, 0, 0);
  assert.equal(view.getInt32(256, true), Math.abs(value) | 0);
  assert.equal(view.getUint32(272, true), 8196);
}
console.log(`PASS production strtod/atof: ${cases.length} numeric/endptr cases, translated pointers, NULL endptr; abs signed boundaries; cdecl`);

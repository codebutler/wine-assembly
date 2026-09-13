#!/usr/bin/env node

'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func $pack_cursor_result (result i64)
    (i64.or
      (i64.extend_i32_u (global.get $eax))
      (i64.shl (i64.extend_i32_u (global.get $esp)) (i64.const 32))))

  (func (export "test_set_cursor_info")
        (param $handle i32) (param $info i32) (param $stack i32) (result i64)
    (global.set $esp (local.get $stack))
    (call $handle_SetConsoleCursorInfo
      (local.get $handle) (local.get $info) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $pack_cursor_result))

  (func (export "test_get_cursor_info")
        (param $handle i32) (param $info i32) (param $stack i32) (result i64)
    (global.set $esp (local.get $stack))
    (call $handle_GetConsoleCursorInfo
      (local.get $handle) (local.get $info) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (call $pack_cursor_result))

  (func (export "test_create_console_buffer") (param $stack i32) (result i64)
    (global.set $esp (local.get $stack))
    (call $handle_CreateConsoleScreenBuffer
      (i32.const 0xc0000000) (i32.const 3) (i32.const 0)
      (i32.const 1) (i32.const 0) (i32.const 0))
    (call $pack_cursor_result))

  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "test_get_last_error") (result i32)
    (global.get $last_error))
`;

const resultOf = packed => ({
  eax: Number(packed & 0xffffffffn) >>> 0,
  esp: Number(packed >> 32n) >>> 0,
});

(async () => {
  for (const name of ['SetConsoleCursorInfo', 'GetConsoleCursorInfo']) {
    const api = apiTable.find(entry => entry.name === name);
    assert(api, `${name} is exported`);
    assert.strictEqual(api.nargs, 2, `${name} has two arguments`);
    assert.strictEqual(api.convention, 'stdcall', `${name} uses stdcall`);
  }

  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const stack = 0x074ff000;
  const active = 0x00030001;
  const input = wat.guest_alloc(8) >>> 0;
  const output = wat.guest_alloc(8) >>> 0;

  const set = (handle, size, visible, pointer = input) => {
    if (pointer) {
      wat.guest_write32(pointer, size);
      wat.guest_write32(pointer + 4, visible);
    }
    return resultOf(wat.test_set_cursor_info(handle, pointer, stack));
  };
  const get = (handle, pointer = output) =>
    resultOf(wat.test_get_cursor_info(handle, pointer, stack));
  const read = pointer => [
    wat.guest_read32(pointer) >>> 0,
    wat.guest_read32(pointer + 4) >>> 0,
  ];

  assert.deepStrictEqual(get(active), { eax: 1, esp: stack + 12 },
    'GetConsoleCursorInfo succeeds and pops both arguments');
  assert.deepStrictEqual(read(output), [25, 1], 'default cursor state is 25% and visible');

  assert.deepStrictEqual(set(active, 1, 7), { eax: 1, esp: stack + 12 },
    'minimum cursor size succeeds');
  get(active);
  assert.deepStrictEqual(read(output), [1, 1], 'nonzero bVisible is normalized to TRUE');
  assert.strictEqual(set(active, 100, 0).eax, 1, 'maximum cursor size succeeds');
  get(active);
  assert.deepStrictEqual(read(output), [100, 0], 'hidden maximum-size cursor round-trips');

  assert.strictEqual(set(active, 37, 1).eax, 1, 'known cursor state setup failed');
  for (const [size, label] of [[0, 'zero'], [101, 'over 100'], [0xffffffff, 'unsigned overflow']]) {
    wat.test_set_last_error(0x1234);
    assert.deepStrictEqual(set(active, size, 0), { eax: 0, esp: stack + 12 },
      `${label} cursor size succeeded`);
    assert.strictEqual(wat.test_get_last_error(), 87,
      `${label} cursor size did not set ERROR_INVALID_PARAMETER`);
    get(active);
    assert.deepStrictEqual(read(output), [37, 1], `${label} cursor size changed live state`);
  }

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(set(active, 0, 0, 0), { eax: 0, esp: stack + 12 },
    'NULL SetConsoleCursorInfo input succeeded');
  assert.strictEqual(wat.test_get_last_error(), 87,
    'NULL SetConsoleCursorInfo did not set ERROR_INVALID_PARAMETER');
  get(active);
  assert.deepStrictEqual(read(output), [37, 1], 'NULL set changed cursor state');

  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(get(active, 0), { eax: 0, esp: stack + 12 },
    'NULL GetConsoleCursorInfo output succeeded');
  assert.strictEqual(wat.test_get_last_error(), 87,
    'NULL GetConsoleCursorInfo did not set ERROR_INVALID_PARAMETER');

  wat.guest_write32(output, 0xaaaaaaaa);
  wat.guest_write32(output + 4, 0xbbbbbbbb);
  wat.test_set_last_error(0x1234);
  assert.deepStrictEqual(get(0xdeadbeef), { eax: 0, esp: stack + 12 },
    'invalid screen-buffer handle succeeded');
  assert.strictEqual(wat.test_get_last_error(), 6,
    'invalid screen-buffer handle did not set ERROR_INVALID_HANDLE');
  assert.deepStrictEqual(read(output), [0xaaaaaaaa, 0xbbbbbbbb],
    'failed get mutated caller output');

  const created = resultOf(wat.test_create_console_buffer(stack));
  assert.strictEqual(created.esp, stack + 24,
    'CreateConsoleScreenBuffer did not pop five arguments');
  assert(created.eax && created.eax !== 0xffffffff, 'second screen buffer creation failed');
  assert.strictEqual(set(created.eax, 77, 0).eax, 1,
    'second buffer cursor state setup failed');
  get(created.eax);
  assert.deepStrictEqual(read(output), [77, 0], 'second buffer cursor state did not round-trip');
  get(active);
  assert.deepStrictEqual(read(output), [37, 1], 'second buffer changed active cursor state');

  console.log('PASS Set/GetConsoleCursorInfo validate and retain per-buffer Win98 state');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

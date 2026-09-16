#!/usr/bin/env node
'use strict';

const assert = require('assert');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_get_compressed_file_size_a_id") (result i32)
    (call $lookup_api_id "GetCompressedFileSizeA"))
  (func (export "test_get_compressed_file_size_w_id") (result i32)
    (call $lookup_api_id "GetCompressedFileSizeW"))

  (func (export "test_call_GetCompressedFileSizeA")
      (param $path i32) (param $high i32) (param $esp0 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp0))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $handle_GetCompressedFileSizeA
      (local.get $path) (local.get $high) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_call_GetCompressedFileSizeW")
      (param $path i32) (param $high i32) (param $esp0 i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp0))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0))
    (call $handle_GetCompressedFileSizeW
      (local.get $path) (local.get $high) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_set_last_error") (param $value i32)
    (global.set $last_error (local.get $value)))
  (func (export "test_get_last_error") (result i32)
    (global.get $last_error))
`;

const LAST_ERROR_SENTINEL = 0x5a5aa55a;
const INVALID_FILE_SIZE = 0xffffffff;
const ERROR_FILE_NOT_FOUND = 2;
const ERROR_INVALID_PARAMETER = 87;
const ERROR_INVALID_NAME = 123;
const ERROR_FILENAME_EXCED_RANGE = 206;
const esp0 = 0x07390000;

function installGuestHelpers(e) {
  const alloc = n => e.guest_alloc(n) >>> 0;
  const writeA = value => {
    const bytes = Buffer.from(`${value}\0`, 'latin1');
    const ptr = alloc(bytes.length);
    bytes.forEach((byte, i) => e.guest_write8(ptr + i, byte));
    return ptr;
  };
  const writeW = value => {
    const ptr = alloc((value.length + 1) * 2);
    for (let i = 0; i < value.length; i++) {
      e.guest_write16(ptr + i * 2, value.charCodeAt(i));
    }
    e.guest_write16(ptr + value.length * 2, 0);
    return ptr;
  };
  return { alloc, writeA, writeW };
}

function assertEsp(e, label) {
  assert.strictEqual(e.get_esp() >>> 0, esp0 + 12,
    `${label}: stdcall pops return address plus two arguments`);
}

(async () => {
  const harness = await bootRenderHarness({ fonts: 'none', extraWat });
  const { exports: e, hostCtx } = harness;
  const { alloc, writeA, writeW } = installGuestHelpers(e);
  const high = alloc(4);

  for (const [name, expectedId] of [
    ['GetCompressedFileSizeA', 3612],
    ['GetCompressedFileSizeW', 3613],
  ]) {
    const api = apiTable.find(entry => entry.name === name);
    assert(api, `${name} is registered`);
    assert.strictEqual(api.id, expectedId, `${name} keeps its append-only API id`);
    assert.strictEqual(api.nargs, 2, `${name} exposes its two-argument ABI`);
    assert.strictEqual(api.convention, 'stdcall', `${name} is stdcall`);
  }
  assert.strictEqual(e.test_get_compressed_file_size_a_id(), 3612,
    'generated API hash table resolves GetCompressedFileSizeA');
  assert.strictEqual(e.test_get_compressed_file_size_w_id(), 3613,
    'generated API hash table resolves GetCompressedFileSizeW');

  hostCtx.vfs.files.set('c:\\far\\panel.bin', {
    data: new Uint8Array(0x12345), attrs: 0x20,
  });
  hostCtx.vfs.files.set('c:\\archive\\résumé.7z', {
    data: new Uint8Array(0x23456), attrs: 0x20,
  });
  hostCtx.vfs.files.set('c:\\other.bin', {
    data: new Uint8Array(7), attrs: 0x20,
  });
  hostCtx.vfs.files.set('c:\\copy[1].bin', {
    data: new Uint8Array(19), attrs: 0x20,
  });
  hostCtx.vfs.dirs.add('c:\\directory');

  e.guest_write32(high, 0xdeadbeef);
  e.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(
    e.test_call_GetCompressedFileSizeA(writeA('C:\\FAR\\PANEL.BIN'), high, esp0) >>> 0,
    0x12345, 'ANSI lookup returns the exact uncompressed VFS byte size');
  assert.strictEqual(e.guest_read32(high) >>> 0, 0,
    'a representable VFS file returns a zero high DWORD');
  assert.strictEqual(e.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL,
    'ordinary success preserves the incoming last-error');
  assertEsp(e, 'ANSI success');

  e.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(
    e.test_call_GetCompressedFileSizeW(writeW('C:\\archive\\résumé.7z'), 0, esp0) >>> 0,
    0x23456, 'Unicode lookup accepts a UTF-16 path and an optional NULL high pointer');
  assert.strictEqual(e.test_get_last_error() >>> 0, LAST_ERROR_SENTINEL,
    'Unicode success with no high pointer preserves last-error');
  assertEsp(e, 'Unicode success');

  e.guest_write32(high, 0xdeadbeef);
  assert.strictEqual(
    e.test_call_GetCompressedFileSizeA(writeA('c:\\copy[1].bin'), high, esp0) >>> 0,
    19, 'valid literal regex metacharacters stay on the exact-open path');
  assert.strictEqual(e.guest_read32(high) >>> 0, 0,
    'the bounded exact-open fallback retains the representable VFS high DWORD');

  e.guest_write32(high, 0xcafebabe);
  e.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(
    e.test_call_GetCompressedFileSizeA(writeA('c:\\missing.bin'), high, esp0) >>> 0,
    INVALID_FILE_SIZE, 'a missing file returns INVALID_FILE_SIZE');
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_FILE_NOT_FOUND);
  assert.strictEqual(e.guest_read32(high) >>> 0, 0xcafebabe,
    'failure does not partially overwrite lpFileSizeHigh');
  assertEsp(e, 'missing file');

  e.guest_write32(high, 0x11223344);
  assert.strictEqual(
    e.test_call_GetCompressedFileSizeW(writeW('c:\\directory'), high, esp0) >>> 0,
    INVALID_FILE_SIZE, 'directories are not opened as VFS disk files');
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_FILE_NOT_FOUND);
  assert.strictEqual(e.guest_read32(high) >>> 0, 0x11223344);

  e.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(
    e.test_call_GetCompressedFileSizeA(writeA('c:\\*.bin'), high, esp0) >>> 0,
    INVALID_FILE_SIZE, 'wildcards are not expanded through FindFirstFile');
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_NAME);

  e.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(e.test_call_GetCompressedFileSizeA(0, high, esp0) >>> 0,
    INVALID_FILE_SIZE, 'NULL filename is rejected safely');
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_PARAMETER);
  assert.strictEqual(e.test_call_GetCompressedFileSizeW(0x90000000, high, esp0) >>> 0,
    INVALID_FILE_SIZE, 'an unmapped UTF-16 filename is rejected safely');
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_PARAMETER);

  e.guest_write32(high, 0xaabbccdd);
  const handlesBefore = hostCtx.vfs.handles.size;
  assert.strictEqual(
    e.test_call_GetCompressedFileSizeA(
      writeA('c:\\far\\panel.bin'), 0x90000000, esp0) >>> 0,
    INVALID_FILE_SIZE, 'an unmapped high-DWORD output is rejected safely');
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_INVALID_PARAMETER);
  assert.strictEqual(hostCtx.vfs.handles.size, handlesBefore,
    'invalid output is rejected before opening the file');

  const tooLong = alloc(260);
  for (let i = 0; i < 260; i++) e.guest_write8(tooLong + i, 0x61);
  assert.strictEqual(
    e.test_call_GetCompressedFileSizeA(tooLong, high, esp0) >>> 0,
    INVALID_FILE_SIZE, 'a nonterminated MAX_PATH filename is rejected');
  assert.strictEqual(e.test_get_last_error() >>> 0, ERROR_FILENAME_EXCED_RANGE);

  // The production VFS currently exposes sub-4GiB entries.  Inject a future
  // 64-bit WIN32_FIND_DATA result without allocating a multi-gigabyte buffer
  // to pin the handler's high/low and ambiguous-success contract.
  let largeHarness;
  largeHarness = await bootRenderHarness({
    fonts: 'none', extraWat,
    extraHostOverrides: {
      fs_get_file_size(handle) {
        const fh = largeHarness.hostCtx.vfs.handles.get(handle >>> 0);
        return fh && fh.path === 'c:\\max.bin' ? -1 : 0;
      },
      fs_find_first_file(patternWA, findDataGA, isWide) {
        const x = largeHarness.exports;
        x.guest_write32(findDataGA, 0x20);
        x.guest_write32(findDataGA + 28, 1);
        x.guest_write32(findDataGA + 32, 0xffffffff);
        const name = 'max.bin';
        for (let i = 0; i < name.length; i++) {
          if (isWide) x.guest_write16(findDataGA + 44 + i * 2, name.charCodeAt(i));
          else x.guest_write8(findDataGA + 44 + i, name.charCodeAt(i));
        }
        if (isWide) x.guest_write16(findDataGA + 44 + name.length * 2, 0);
        else x.guest_write8(findDataGA + 44 + name.length, 0);
        return 0x7f001234;
      },
    },
  });
  const le = largeHarness.exports;
  const largeGuest = installGuestHelpers(le);
  largeHarness.hostCtx.vfs.files.set('c:\\max.bin', {
    data: new Uint8Array(0), attrs: 0x20,
  });
  const largeHigh = largeGuest.alloc(4);
  le.test_set_last_error(LAST_ERROR_SENTINEL);
  assert.strictEqual(
    le.test_call_GetCompressedFileSizeW(
      largeGuest.writeW('c:\\max.bin'), largeHigh, esp0) >>> 0,
    INVALID_FILE_SIZE, '0x1ffffffff returns its low DWORD without becoming failure');
  assert.strictEqual(le.guest_read32(largeHigh) >>> 0, 1,
    'the high DWORD is copied from 64-bit file metadata');
  assert.strictEqual(le.test_get_last_error() >>> 0, 0,
    'ambiguous INVALID_FILE_SIZE success publishes NO_ERROR');
  assertEsp(le, 'ambiguous large-file success');

  console.log('GetCompressedFileSizeA/W behavior: PASS');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

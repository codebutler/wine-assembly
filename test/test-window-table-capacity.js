#!/usr/bin/env node
'use strict';

// The window table's capacity, and what happens at it.
//
// WHY
// The table held 256 windows, and mIRC's Options dialog keeps every page's
// controls alive — well over 256. CreateWindowEx went on issuing HWNDs with no
// record behind them, so GetDlgItem could not find the Mouse page's edits and
// mIRC's page walk stopped at the first one: the page showed two labels and
// nothing else, and nothing anywhere said why.
//
// What this pins:
//   - the capacity is $MAX_WINDOWS, and every per-slot table is sized from it
//     (read back from the region map, never a copied number);
//   - windows past the old 256 are real: each one resolves to its own record;
//   - scans stop at the slot high-water mark, which follows the highest slot
//     ever claimed and does not shrink;
//   - a FULL table fails CreateWindowExA/W the way USER does — NULL,
//     ERROR_NO_MORE_USER_HANDLES, nothing created, no HWND consumed, and the
//     caller's stack unwound as for any stdcall return.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const ROOT = path.join(__dirname, '..');
const WND_RECORD_SIZE = 24;

const extraWat = String.raw`
  (func (export "test_find") (param $hwnd i32) (result i32)
    (call $wnd_table_find (local.get $hwnd)))

  (func (export "test_slot_end") (result i32)
    (call $wnd_slot_end))

  (func (export "test_capacity") (result i32)
    (global.get $MAX_WINDOWS))

  (func (export "test_create")
      (param $wide i32) (param $class i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (i32.const 0x00ABCDEF))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 24)) (i32.const 10))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 28)) (i32.const 160))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 32)) (i32.const 100))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 36)) (i32.const 0))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 40)) (i32.const 0))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 44)) (global.get $image_base))
    (call $gs32 (i32.add (i32.load offset=16 (global.get $reg_base)) (i32.const 48)) (i32.const 0))
    (if (local.get $wide)
      (then
        (call $handle_CreateWindowExW
          (i32.const 0) (local.get $class) (i32.const 0)
          (i32.const 0) (i32.const 10) (i32.const 0)))
      (else
        (call $handle_CreateWindowExA
          (i32.const 0) (local.get $class) (i32.const 0)
          (i32.const 0) (i32.const 10) (i32.const 0))))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_remove") (param $hwnd i32)
    (call $wnd_table_remove (local.get $hwnd)))

  (func (export "test_esp") (result i32)
    (i32.load offset=16 (global.get $reg_base)))
`;

(async () => {
  const logs = [];
  const { exports: e, memory } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      log: (ptr, len) => logs.push(Buffer.from(memory.buffer, ptr, len).toString('latin1')),
    },
  });

  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE loads');

  const capacity = e.test_capacity() >>> 0;
  assert.strictEqual(RegionMap.SIZE.WND_RECORDS / WND_RECORD_SIZE, capacity,
    'WND_RECORDS is sized from $MAX_WINDOWS');
  for (const [name, stride] of [
    ['CONTROL_TABLE', 16], ['CLIENT_RECT', 16], ['TITLE_TABLE', 8], ['OWNER_TABLE', 4],
    ['WND_Z_ORDER_TABLE', 4], ['SCROLL_TABLE', 24], ['PAINT_FLAGS', 1],
    ['GDI_WINDOW_SURFACE_TABLE', 32],
  ]) {
    assert.strictEqual(RegionMap.SIZE[name], capacity * stride,
      `${name} holds one record per window slot`);
  }
  for (const name of ['WINDOW_REGION_BITS', 'NATIVE_STATUS_BITS', 'NATIVE_TAB_BITS']) {
    assert.strictEqual(RegionMap.SIZE[name], Math.ceil(capacity / 8),
      `${name} holds one bit per window slot`);
  }
  assert.ok(capacity > 256, `capacity ${capacity} is past the old 256`);

  // Claim windows well past the old limit, each through the real claim path.
  const used0 = e.wnd_count_used() >>> 0;
  const end0 = e.test_slot_end() >>> 0;
  assert.ok(end0 >= used0, 'the mark covers every window already present');
  const first = 0x00500000;
  const extra = 600;
  for (let i = 0; i < extra; i++) e.test_wnd_table_set(first + i, 0xCAFE0000 + i);
  assert.strictEqual(e.wnd_count_used() >>> 0, used0 + extra, 'every claim got a slot');
  const slots = new Set();
  for (let i = 0; i < extra; i++) {
    const slot = e.test_find(first + i);
    assert.ok(slot >= 0, `window ${i} resolves`);
    slots.add(slot);
  }
  assert.strictEqual(slots.size, extra, 'and each resolves to its own record');
  const end1 = e.test_slot_end() >>> 0;
  assert.strictEqual(end1, Math.max(...slots) + 1, 'the mark is one past the highest claimed slot');

  // Removing the top window leaves the mark where it was: scans over a few
  // empty records are cheaper than tracking the top, and a stale mark can
  // only cost a scan, never hide a window.
  e.test_remove(first + extra - 1);
  assert.strictEqual(e.test_find(first + extra - 1), -1, 'a removed window no longer resolves');
  assert.strictEqual(e.test_slot_end() >>> 0, end1, 'the mark does not shrink');
  e.test_wnd_table_set(first + extra - 1, 0xCAFE0000);
  assert.ok(e.test_find(first + extra - 1) >= 0, 'the freed slot is reused');

  // Fill the table.
  let next = first + extra;
  while ((e.wnd_count_used() >>> 0) < capacity) e.test_wnd_table_set(next++, 0xCAFE0000);
  assert.strictEqual(e.test_slot_end() >>> 0, capacity, 'a full table is scanned end to end');
  assert.strictEqual(e.test_find(0), -1, 'a full table has no empty slot');
  assert.ok(e.test_find(next - 1) >= 0, 'the last window claimed resolves');

  const ansi = text => {
    const ptr = e.guest_alloc(text.length + 1) >>> 0;
    for (let i = 0; i < text.length; i++) e.guest_write8(ptr + i, text.charCodeAt(i));
    e.guest_write8(ptr + text.length, 0);
    return ptr;
  };
  const wide = text => {
    const ptr = e.guest_alloc((text.length + 1) * 2) >>> 0;
    for (let i = 0; i < text.length; i++) {
      e.guest_write8(ptr + i * 2, text.charCodeAt(i));
      e.guest_write8(ptr + i * 2 + 1, 0);
    }
    e.guest_write8(ptr + text.length * 2, 0);
    e.guest_write8(ptr + text.length * 2 + 1, 0);
    return ptr;
  };
  const stack = e.guest_alloc(256) >>> 0;

  for (const [label, isWide, cls] of [['CreateWindowExA', 0, ansi('STATIC')], ['CreateWindowExW', 1, wide('STATIC')]]) {
    const hwndBefore = e.get_hwnd_base() >>> 0;
    const used = e.wnd_count_used() >>> 0;
    logs.length = 0;
    const result = e.test_create(isWide, cls, stack) >>> 0;
    assert.strictEqual(result, 0, `${label} on a full table returns NULL`);
    assert.strictEqual(e.test_call_GetLastError() >>> 0, 1158,
      `${label} sets ERROR_NO_MORE_USER_HANDLES`);
    assert.strictEqual(e.test_esp() >>> 0, stack + 52, `${label} unwinds its twelve stdcall arguments`);
    assert.strictEqual(e.get_hwnd_base() >>> 0, hwndBefore, `${label} consumes no HWND`);
    assert.strictEqual(e.wnd_count_used() >>> 0, used, `${label} creates nothing`);
    assert.ok(logs.some(line => line.includes('window table is full')), `${label} says why`);
  }

  // One free slot is enough again.
  e.test_remove(first);
  const created = e.test_create(0, ansi('STATIC'), stack) >>> 0;
  assert.ok(created, 'with a slot free, creation succeeds');
  assert.ok(e.test_find(created) >= 0, 'and the new window has a record');

  console.log(`PASS window table capacity ${capacity}: ${extra} windows past the old limit, ` +
    'mark tracks the top claim, a full table fails CreateWindowEx cleanly');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

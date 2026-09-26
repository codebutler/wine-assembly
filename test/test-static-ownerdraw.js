#!/usr/bin/env node

'use strict';

// An SS_OWNERDRAW static is painted by its parent: USER sends the parent
// WM_DRAWITEM with an ODT_STATIC DRAWITEMSTRUCT. The static used to draw
// nothing at all, so PuTTY's configuration panel lost its "Basic options for
// your PuTTY session" title, which PuTTY draws itself (DrawEdge + DrawText) in
// WM_DRAWITEM. A tiny x86 WndProc records the structure it is handed.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');

const extraWat = String.raw`
  (func (export "tso_parent") (param $wndproc i32) (result i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (local.get $wndproc))
    (drop (call $wnd_set_style (local.get $hwnd) (i32.const 0x10CF0000)))
    (local.get $hwnd))
  (func (export "tso_static") (param $parent i32) (param $style i32) (result i32)
    (call $ctrl_create_child (local.get $parent) (i32.const 3) (i32.const 0x411)
      (i32.const 10) (i32.const 20) (i32.const 288) (i32.const 19)
      (local.get $style) (i32.const 0)))
  (func (export "tso_paint") (param $hwnd i32) (result i32)
    (call $wnd_send_message (local.get $hwnd) (i32.const 0x000F) (i32.const 0) (i32.const 0)))
`;

const u32 = value => [value, value >>> 8, value >>> 16, value >>> 24].map(b => b & 0xff);

(async () => {
  const harness = await bootRenderHarness({ extraWat, fonts: 'none' });
  const { exports: e, memory } = harness;
  const bytes = new Uint8Array(memory.buffer);
  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  bytes.set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'a fixture PE makes synchronous guest callbacks possible');
  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const wa = guest => (guest - imageBase + guestBase) >>> 0;

  // marker: +0 draw count, +4.. the DRAWITEMSTRUCT's first 44 bytes.
  const marker = e.guest_alloc(64) >>> 0;
  for (let i = 0; i < 64; i += 4) e.guest_write32(marker + i, 0);
  const code = [];
  const emit = (...v) => code.push(...v.flat());
  emit(0x8b, 0x44, 0x24, 0x08);             // mov eax,[esp+8] (msg)
  emit(0x83, 0xf8, 0x2b);                   // cmp eax,WM_DRAWITEM
  emit(0x75, 0);                            // jne ignored
  const toIgnored = code.length - 1;
  emit(0xff, 0x05, u32(marker));            // inc [count]
  emit(0x8b, 0x4c, 0x24, 0x10);             // mov ecx,[esp+16]
  for (let off = 0; off < 44; off += 4) {
    emit(0x8b, 0x41, off);                  // mov eax,[ecx+off]
    emit(0xa3, u32(marker + 4 + off));      // mov [marker+4+off],eax
  }
  emit(0xb8, u32(1), 0xc2, 0x10, 0x00);     // return TRUE
  code[toIgnored] = code.length - (toIgnored + 1);
  emit(0x31, 0xc0, 0xc2, 0x10, 0x00);       // return 0
  const wndproc = e.guest_alloc(code.length) >>> 0;
  bytes.set(code, wa(wndproc));
  e.set_esp(0x073ff000);

  const parent = e.tso_parent(wndproc) >>> 0;
  const field = off => e.guest_read32 ? e.guest_read32(marker + 4 + off) >>> 0
    : new DataView(memory.buffer).getUint32(wa(marker + 4 + off), true);
  const count = () => new DataView(memory.buffer).getUint32(wa(marker), true);

  // A plain label never asks its parent.
  const label = e.tso_static(parent, 0x50000000) >>> 0;
  e.tso_paint(label);
  assert.strictEqual(count(), 0, 'an SS_LEFT label paints itself');

  const owner = e.tso_static(parent, 0x5000000D) >>> 0;   // SS_OWNERDRAW
  e.tso_paint(owner);
  assert.strictEqual(count(), 1, 'an SS_OWNERDRAW static sends its parent WM_DRAWITEM');
  assert.strictEqual(field(0), 5, 'CtlType is ODT_STATIC');
  assert.strictEqual(field(4), 0x411, 'CtlID is the control id');
  assert.strictEqual(field(12), 1, 'itemAction is ODA_DRAWENTIRE');
  assert.strictEqual(field(16), 0, 'itemState is 0 for an enabled static');
  assert.strictEqual(field(20), owner, 'hwndItem is the static');
  assert.strictEqual(field(24), owner + 0x40000, 'hDC is the static\'s own DC');
  assert.deepStrictEqual([field(28), field(32), field(36), field(40)], [0, 0, 288, 19],
    'rcItem is its client rect');

  console.log('PASS  an SS_OWNERDRAW static is drawn by its parent through WM_DRAWITEM');
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});

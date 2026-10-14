#!/usr/bin/env node
'use strict';

// DefDlgProc's WM_PAINT is DefWindowProc's BeginPaint, which sends
// WM_ERASEBKGND through the window's CURRENT wndproc. MFC subclasses every
// dialog (AfxWndProc) and chains unhandled messages back to DefDlgProc with
// CallWindowProc, so a CDialog that draws its background in OnEraseBkgnd only
// sees the erase if the native paint sends it to the subclass. Hellbender's
// Quick Configuration dialog paints its 560x420 artwork there; the native
// paint used to fill COLOR_BTNFACE itself and the top half stayed grey.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_dialog_window") (result i32)
    (local $h i32)
    (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
    (call $host_register_dialog_frame (local.get $h) (i32.const 0)
      (i32.const 0) (i32.const 32) (i32.const 24) (i32.const 0))
    (call $wnd_table_set (local.get $h) (global.get $WNDPROC_DIALOG))
    (drop (call $dialog_proc_set (local.get $h) (i32.const 0)))
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x90000000)))
    (call $client_rect_set (local.get $h) (i32.const 0) (i32.const 0) (i32.const 32) (i32.const 24))
    (local.get $h))
  (func (export "test_subclass") (param $h i32) (param $proc i32)
    (call $wnd_table_set (local.get $h) (local.get $proc)))
  (func (export "test_mark_erase") (param $h i32)
    (call $nc_flags_set (local.get $h) (i32.const 2)))
  (func (export "test_erase_pending") (param $h i32) (result i32)
    (i32.and (call $nc_flags_test (local.get $h)) (i32.const 2)))
  (func (export "test_defdlg") (param $h i32) (param $msg i32) (result i32)
    (call $dialog_default_proc (local.get $h) (local.get $msg) (i32.const 0) (i32.const 0)))
`;

const u32 = v => [v, v >>> 8, v >>> 16, v >>> 24].map(b => b & 255);

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const record = e.guest_alloc(16);
  // stdcall wndproc: record the message and its wParam (HDC), count calls,
  // return TRUE (the background is the application's).
  const code = [0x8b, 0x44, 0x24, 8, 0xa3, ...u32(record),
    0x8b, 0x44, 0x24, 12, 0xa3, ...u32(record + 4),
    0xff, 0x05, ...u32(record + 8), 0xb8, ...u32(1), 0xc2, 16, 0];
  const proc = e.guest_alloc(code.length);
  code.forEach((b, i) => e.guest_write8(proc + i, b));

  // Subclassed dialog: the erase reaches the subclass with a DC.
  const sub = e.test_dialog_window();
  e.test_subclass(sub, proc);
  for (let i = 0; i < 12; i += 4) e.guest_write32(record + i, 0);
  e.test_mark_erase(sub);
  e.test_defdlg(sub, 0x0F);
  assert.strictEqual(e.guest_read32(record + 8), 1, 'native dialog WM_PAINT sends one WM_ERASEBKGND');
  assert.strictEqual(e.guest_read32(record), 0x14, 'through the subclass wndproc');
  assert.notStrictEqual(e.guest_read32(record + 4), 0, 'with a DC in wParam');
  assert.strictEqual(e.test_erase_pending(sub), 0, 'the erase request is consumed');
  assert.strictEqual(e.get_sync_msg_depth(), 0);

  // No erase pending: no message.
  e.guest_write32(record + 8, 0);
  e.test_defdlg(sub, 0x0F);
  assert.strictEqual(e.guest_read32(record + 8), 0, 'a paint without the erase bit sends nothing');

  // Unsubclassed dialog keeps the native COLOR_BTNFACE fill and calls nothing.
  const plain = e.test_dialog_window();
  e.test_mark_erase(plain);
  e.test_defdlg(plain, 0x0F);
  assert.strictEqual(e.guest_read32(record + 8), 0, 'an unsubclassed dialog erases natively');
  assert.strictEqual(e.test_erase_pending(plain), 0);

  console.log('PASS  DefDlgProc WM_PAINT sends WM_ERASEBKGND through a dialog subclass');
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });

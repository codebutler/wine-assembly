#!/usr/bin/env node
'use strict';

// A dialog is created through CreateWindowEx, so a WH_CBT hook that
// subclasses it (MFC's AfxWndProc) receives WM_CREATE before the DLGPROC gets
// WM_INITDIALOG. MFC's CFormView registers with its document in WM_CREATE;
// without it Monster Truck Madness 2's document had no views and crashed on
// IsKindOf(NULL). This drives the CACA0028 continuation as the hook returns,
// then as the subclassed WNDPROC returns, with the saved dialog state
// clobbered in between the way a dialog created inside WM_CREATE would.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func $thunk_0028 (result i32)
    (local $idx i32) (local $slot i32)
    (local.set $idx (global.get $num_thunks))
    (local.set $slot (i32.add (global.get $THUNK_BASE) (i32.mul (local.get $idx) (i32.const 8))))
    (i32.store (local.get $slot) (i32.const 0xCACA0028))
    (i32.store offset=4 (local.get $slot) (i32.const 0))
    (global.set $num_thunks (i32.add (local.get $idx) (i32.const 1)))
    (local.get $idx))
  (func (export "test_dialog_cbt_setup")
      (param $hwnd i32) (param $wndproc i32) (param $dlgproc i32) (param $lparam i32) (param $ret i32)
    (call $wnd_table_set (local.get $hwnd) (local.get $wndproc))
    (global.set $dialog_cbt_saved_hwnd (local.get $hwnd))
    (global.set $dialog_cbt_saved_ret (local.get $ret))
    (global.set $dialog_cbt_saved_proc (local.get $dlgproc))
    (global.set $dialog_cbt_saved_lparam (local.get $lparam)))
  (func (export "test_dialog_cbt_clobber")
    (global.set $dialog_cbt_saved_hwnd (i32.const 0x7777))
    (global.set $dialog_cbt_saved_proc (i32.const 0x7777))
    (global.set $dialog_cbt_saved_lparam (i32.const 0x7777)))
  (func (export "test_dialog_cbt_continue") (param $esp i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.store offset=0 (global.get $reg_base) (i32.const 0))
    (call $win32_dispatch (call $thunk_0028)))
  (func (export "test_dialog_cbt_ret_thunk") (result i32) (global.get $dialog_cbt_ret_thunk))
  (func (export "test_createwnd_ret_thunk") (result i32) (global.get $createwnd_ret_thunk))
  (func (export "test_dialog_cbt_saved_hwnd") (result i32) (global.get $dialog_cbt_saved_hwnd))
  (func (export "test_wnd_scratch") (result i32) (call $wnd_scratch))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const r32 = a => e.guest_read32(a) >>> 0;
  const hwnd = 0x10091, wndproc = 0x00401234, dlgproc = 0x00402000, lparam = 0x55, ret = 0x0042A5B0;
  const stack = 0x074FF600;

  e.test_dialog_cbt_setup(hwnd, wndproc, dlgproc, lparam, ret);
  // As the hook returns: "CBT1" and the outer hook node sit on the stack.
  e.guest_write32(stack, 0x31544243);
  e.guest_write32(stack + 4, 0);
  e.test_dialog_cbt_continue(stack);

  assert.strictEqual(e.get_eip() >>> 0, wndproc, 'the subclassed dialog WNDPROC runs first');
  let esp = e.get_esp() >>> 0;
  assert.deepStrictEqual(
    [r32(esp), r32(esp + 4), r32(esp + 8), r32(esp + 12), r32(esp + 16)],
    // The CREATESTRUCT is the window scratch block, not image_base+0x100: that
    // is inside the PE header of an EXE whose header starts low (Rayman 2).
    [e.test_dialog_cbt_ret_thunk() >>> 0, hwnd, 0x0001, 0, e.test_wnd_scratch() >>> 0],
    'it receives WM_CREATE with the CBT CREATESTRUCT and returns to CACA0028');
  assert.deepStrictEqual([r32(esp + 20), r32(esp + 24), r32(esp + 28), r32(esp + 32), r32(esp + 36)],
    [0x54524344, hwnd, ret, dlgproc, lparam], 'the dialog state is kept under the DCRT marker');
  assert.strictEqual(esp + 40, stack + 8, 'the hook frame was popped before the WM_CREATE frame');

  // The WNDPROC returns (stdcall, 4 args); a nested dialog clobbered the globals.
  e.test_dialog_cbt_clobber();
  e.test_dialog_cbt_continue(esp + 20);

  assert.strictEqual(e.get_eip() >>> 0, dlgproc, 'WM_INITDIALOG follows in the DLGPROC');
  esp = e.get_esp() >>> 0;
  assert.deepStrictEqual([r32(esp), r32(esp + 4), r32(esp + 8), r32(esp + 16)],
    [e.test_createwnd_ret_thunk() >>> 0, hwnd, 0x0110, lparam],
    'WM_INITDIALOG goes to this dialog with its own lParam');
  assert.strictEqual(e.test_dialog_cbt_saved_hwnd() >>> 0, hwnd,
    'the dialog state saved under the marker is restored');

  // A dialog still owned by the native DefDlgProc gets no guest WM_CREATE.
  e.test_dialog_cbt_setup(hwnd, 0, dlgproc, lparam, ret);
  e.guest_write32(stack, 0x31544243);
  e.guest_write32(stack + 4, 0);
  e.test_dialog_cbt_continue(stack);
  assert.strictEqual(e.get_eip() >>> 0, dlgproc, 'no subclass: straight to WM_INITDIALOG');

  console.log('PASS  CBT-subclassed dialogs receive WM_CREATE before WM_INITDIALOG');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

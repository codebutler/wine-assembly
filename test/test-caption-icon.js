#!/usr/bin/env node

'use strict';

// A caption shows the window's small icon at its left, and the icon is the
// system-menu box: a press there opens the system menu under it.
//
// Captions drew no icon at all, so nothing but a maximized MDI child's frame
// bar could open a system menu. What this pins, on Win98's rules:
//   - the icon is the window's own (WM_SETICON small, then big) or its Win32
//     class's hIcon, read live; a tool window, or one without WS_SYSMENU, has
//     none;
//   - DefWindowProc and the built-in dialog procedure both keep WM_SETICON
//     and answer WM_GETICON (PuTTY sets its dialog's icon this way);
//   - the icon hit-tests as HTSYSMENU, the caption beside it as HTCAPTION;
//   - a press on it posts WM_NCLBUTTONDOWN(HTSYSMENU); the default turns that
//     into SC_MOUSEMENU, which tracks the window's system menu, and a pick
//     from it is WM_SYSCOMMAND -- for a built-in dialog as for a window;
//   - window_shell_icon hands a host the same icon for its taskbar button,
//     whatever the window's styles;
//   - WM_CLOSE on a built-in dialog presses Cancel, which is what Close in
//     its system menu does.
// The icon's placement (2px in; the title's first pixels at 21, as on a
// Windows 98 capture of PuTTY) was measured by rendering, not asserted here.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');

const extraWat = String.raw`
  (func $tci_make_window (param $style i32) (result i32)
    (call $tci_make_ex (local.get $style) (i32.const 0)))
  (func (export "tci_make") (param $style i32) (param $ex i32) (result i32)
    (call $tci_make_ex (local.get $style) (local.get $ex)))
  (func $tci_make_ex (param $style i32) (param $ex i32) (result i32)
    (local $hwnd i32) (local $slot i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (call $ctrl_table_set (local.get $slot) (i32.const 0) (i32.const 0))
    (call $ctrl_set_ex_style (local.get $hwnd) (local.get $ex))
    (local.get $hwnd))
  ;; A DLGPROC that handles nothing (returns FALSE), so every message falls
  ;; through to the built-in dialog procedure's defaults.
  (func (export "tci_make_dialog") (param $style i32) (result i32)
    (local $hwnd i32)
    (local.set $hwnd (call $tci_make_window (local.get $style)))
    (drop (call $dialog_proc_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN)))
    (local.get $hwnd))
  (func (export "tci_intern_icon") (param $resid i32) (result i32)
    (call $icon_intern (global.get $image_base) (local.get $resid)))
  (func (export "tci_caption_icon") (param $h i32) (result i32) (call $caption_icon (local.get $h)))
  (func (export "tci_defwndproc") (param $h i32) (param $msg i32) (param $wp i32) (param $lp i32) (result i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_DefWindowProcA (local.get $h) (local.get $msg) (local.get $wp) (local.get $lp)
      (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "tci_dialog_default") (param $h i32) (param $msg i32) (param $wp i32) (param $lp i32) (result i32)
    (call $dialog_default_proc (local.get $h) (local.get $msg) (local.get $wp) (local.get $lp)))
  (func (export "tci_nchittest") (param $h i32) (param $x i32) (param $y i32) (result i32)
    (call $defwndproc_do_nchittest (local.get $h) (local.get $x) (local.get $y)))
  (func (export "tci_frame") (param $h i32) (result i32) (call $defwndproc_frame_width (local.get $h)))
  (func (export "tci_open_popup") (result i32) (global.get $menu_open_dynamic_hmenu))
  (func (export "tci_pick_message") (result i32) (call $menu_pick_message))
  (func (export "tci_system_menu") (param $h i32) (result i32) (call $system_menu_get (local.get $h)))
  (func (export "tci_queue_find") (param $h i32) (param $msg i32) (param $wp i32) (result i32)
    (call $tci_queue_scan (local.get $h) (local.get $msg) (local.get $wp)))
  (func $tci_queue_scan (param $h i32) (param $msg i32) (param $wp i32) (result i32)
    ;; Drain the posted queue, answering whether (h, msg, wp) was among it.
    (local $found i32) (local $buf i32)
    (local.set $buf (call $heap_alloc (i32.const 32)))
    (block $done (loop $next
      (br_if $done (i32.eqz (call $shared_post_queue_read (local.get $buf) (i32.const 1))))
      (if (i32.and
            (i32.and (i32.eq (call $gl32 (local.get $buf)) (local.get $h))
                     (i32.eq (call $gl32 (i32.add (local.get $buf) (i32.const 4))) (local.get $msg)))
            (i32.eq (call $gl32 (i32.add (local.get $buf) (i32.const 8))) (local.get $wp)))
        (then (local.set $found (i32.const 1))))
      (br $next)))
    (call $heap_free (local.get $buf))
    (local.get $found))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: { set_window_zorder() {}, activate_window() { return 1; } },
  });
  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'notepad.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE loads');

  const WS_OVERLAPPEDWINDOW = 0x10CF0000;
  const icon = e.tci_intern_icon(2) >>> 0; // Notepad's own icon group
  assert.strictEqual(icon >>> 16, 0x65, 'the fixture icon interns as a drawable HICON');

  // WM_SETICON / WM_GETICON through DefWindowProc.
  const win = e.tci_make(WS_OVERLAPPEDWINDOW, 0) >>> 0;
  assert.strictEqual(e.tci_caption_icon(win), 0, 'no icon of its own or its class yet');
  assert.strictEqual(e.tci_defwndproc(win, 0x80, 1, icon), 0, 'WM_SETICON big returns the previous (none)');
  assert.strictEqual(e.tci_caption_icon(win) >>> 0, icon, 'a big icon alone is drawn');
  assert.strictEqual(e.tci_defwndproc(win, 0x7F, 1, 0) >>> 0, icon, 'WM_GETICON big');
  assert.strictEqual(e.tci_defwndproc(win, 0x7F, 0, 0), 0, 'WM_GETICON small: none set');

  // No icon for a tool window or a window without a system menu.
  const tool = e.tci_make(WS_OVERLAPPEDWINDOW, 0x80) >>> 0;
  e.tci_defwndproc(tool, 0x80, 0, icon);
  assert.strictEqual(e.tci_caption_icon(tool), 0, 'WS_EX_TOOLWINDOW: no caption icon');
  const bare = e.tci_make(0x10C00000, 0) >>> 0;
  e.tci_defwndproc(bare, 0x80, 0, icon);
  assert.strictEqual(e.tci_caption_icon(bare), 0, 'no WS_SYSMENU: no caption icon');

  // The shell's icon (a taskbar button's) is the window's whatever its styles.
  assert.strictEqual(e.window_shell_icon(win) >>> 0, icon, 'the shell icon is the window icon');
  assert.strictEqual(e.window_shell_icon(tool) >>> 0, icon, 'a tool window still has a shell icon');
  assert.strictEqual(e.window_shell_icon(bare) >>> 0, icon, 'so does one without WS_SYSMENU');
  assert.strictEqual(e.window_shell_icon(e.tci_make(WS_OVERLAPPEDWINDOW, 0) >>> 0), 0, 'none of its own: 0');

  // The icon is HTSYSMENU; the caption beside it HTCAPTION.
  const x0 = e.wnd_window_screen_x(win) | 0;
  const y0 = e.wnd_window_screen_y(win) | 0;
  const f = e.tci_frame(win) | 0;
  assert.strictEqual(e.tci_nchittest(win, x0 + f + 8, y0 + f + 8), 3, 'the icon is HTSYSMENU');
  assert.strictEqual(e.tci_nchittest(win, x0 + f + 40, y0 + f + 8), 2, 'beside it is HTCAPTION');
  assert.strictEqual(e.tci_nchittest(tool, (e.wnd_window_screen_x(tool) | 0) + f + 8,
    (e.wnd_window_screen_y(tool) | 0) + f + 8), 2, 'a caption with no icon has no HTSYSMENU');

  // A press there posts WM_NCLBUTTONDOWN(HTSYSMENU); the default posts
  // SC_MOUSEMENU; that opens the system menu, whose picks are WM_SYSCOMMAND.
  e.tci_queue_find(0, 0, 0); // empty the queue
  assert.strictEqual(e.nc_sysbutton_down(win, x0 + f + 8, y0 + f + 8), 3);
  assert.strictEqual(e.tci_queue_find(win, 0xA1, 3), 1, 'the press posts WM_NCLBUTTONDOWN(HTSYSMENU)');
  e.tci_defwndproc(win, 0xA1, 3, 0);
  assert.strictEqual(e.tci_queue_find(win, 0x112, 0xF090), 1, 'DefWindowProc posts SC_MOUSEMENU');
  e.tci_defwndproc(win, 0x112, 0xF090, 0);
  const sys = e.tci_system_menu(win) >>> 0;
  assert.ok(sys, 'the window has a system menu');
  assert.strictEqual(e.tci_open_popup() >>> 0, sys, 'SC_MOUSEMENU opens it');
  assert.strictEqual(e.tci_pick_message(), 0x112, 'and a pick from it is WM_SYSCOMMAND');
  e.menu_close();
  assert.strictEqual(e.tci_pick_message(), 0x111, 'other menus pick with WM_COMMAND');

  // The built-in dialog procedure does the same, and closes with Cancel.
  const dlg = e.tci_make_dialog(0x10C80000 | 0x80) >>> 0; // caption, system menu, DS_MODALFRAME
  assert.strictEqual(e.tci_dialog_default(dlg, 0x80, 0, icon), 0, 'WM_SETICON on a dialog');
  assert.strictEqual(e.tci_caption_icon(dlg) >>> 0, icon, 'is kept and drawn');
  assert.strictEqual(e.tci_dialog_default(dlg, 0x7F, 0, 0) >>> 0, icon, 'WM_GETICON on a dialog');
  e.tci_queue_find(0, 0, 0);
  e.tci_dialog_default(dlg, 0xA1, 3, 0);
  assert.strictEqual(e.tci_queue_find(dlg, 0x112, 0xF090), 1, 'a dialog\'s icon press becomes SC_MOUSEMENU');
  e.tci_dialog_default(dlg, 0x112, 0xF090, 0);
  assert.strictEqual(e.tci_open_popup() >>> 0, e.tci_system_menu(dlg) >>> 0, 'and opens its system menu');
  e.menu_close();
  e.tci_queue_find(0, 0, 0);
  e.tci_dialog_default(dlg, 0x10, 0, 0);
  assert.strictEqual(e.tci_queue_find(dlg, 0x111, 2), 1, 'WM_CLOSE on a dialog presses Cancel');

  console.log('PASS  caption icon: drawn from WM_SETICON or the class, HTSYSMENU opens the system menu');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

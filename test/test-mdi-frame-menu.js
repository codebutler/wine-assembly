#!/usr/bin/env node

'use strict';

// A maximized MDI child's system menu and buttons live in the FRAME's menu
// bar, as Win98 MDI puts them there: the child's icon (HBMMENU_SYSTEM, its
// system menu as the popup) at position 0, and Minimize, Restore and Close
// (HBMMENU_MBAR_*) right-justified at the end. They are real items of the
// frame's HMENU -- GetMenuItemCount counts them -- and choosing one reaches
// the frame as WM_COMMAND, which DefFrameProc hands to the child as
// WM_SYSCOMMAND.
//
// Before this the maximized child's caption was drawn inside the MDI client
// with its own buttons, and GetSystemMenu returned the same fixed handle for
// every window, a menu with nothing in it.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');

const callWat = (name, nargs) => {
  const params = Array.from({ length: nargs }, (_, i) => ` (param $a${i} i32)`).join('');
  const args = Array.from({ length: 5 }, (_, i) => i < nargs ? `(local.get $a${i})` : '(i32.const 0)');
  return `
  (func (export "call_${name}")${params} (result i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_${name} ${args.join(' ')} (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load offset=0 (global.get $reg_base)))`;
};

const APIS = [
  ['GetMenu', 1], ['GetMenuItemCount', 1], ['GetMenuItemID', 2], ['GetSubMenu', 2],
  ['GetMenuStringA', 5], ['GetMenuState', 3], ['GetSystemMenu', 2], ['DefWindowProcA', 4],
];

const MF_BYPOSITION = 0x400;
const MF_GRAYED = 0x1;
const SC_SIZE = 0xF000, SC_MOVE = 0xF010, SC_MINIMIZE = 0xF020, SC_MAXIMIZE = 0xF030;
const SC_NEXTWINDOW = 0xF040, SC_CLOSE = 0xF060, SC_RESTORE = 0xF120;
const SEP = -1; // GetMenuItemID of a separator (a NULL id)

const extraWat = APIS.map(([name, n]) => callWat(name, n)).join('') + String.raw`
  (func $tmss_make_window (param $parent i32) (param $class i32) (result i32)
    (local $hwnd i32) (local $slot i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (call $ctrl_table_set (local.get $slot) (local.get $class) (i32.const 0))
    (local.get $hwnd))

  (func (export "tmss_make_frame") (result i32)
    (call $tmss_make_window (i32.const 0) (i32.const 0)))

  (func (export "tmss_make_client") (param $frame i32) (result i32)
    (local $client i32) (local $ccs i32) (local $cs i32) (local $result i32)
    (local.set $client (call $tmss_make_window (local.get $frame) (i32.const 33)))
    (local.set $ccs (call $heap_alloc (i32.const 8)))
    (local.set $cs (call $heap_alloc (i32.const 48)))
    (call $gs32 (local.get $ccs) (i32.const 0))
    (call $gs32 (i32.add (local.get $ccs) (i32.const 4)) (i32.const 0xFF00))
    (call $gs32 (local.get $cs) (local.get $ccs))
    (local.set $result (call $mdiclient_wndproc
      (local.get $client) (i32.const 1) (i32.const 0) (local.get $cs)))
    (call $heap_free (local.get $cs))
    (call $heap_free (local.get $ccs))
    (if (i32.eq (local.get $result) (i32.const -1))
      (then (return (i32.const 0))))
    (local.get $client))

  ;; WS_CHILD | WS_VISIBLE | WS_CAPTION | WS_THICKFRAME | min/max boxes.
  (func (export "tmss_make_child") (param $client i32)
      (param $x i32) (param $y i32) (param $w i32) (param $h i32) (result i32)
    (local $child i32)
    (local.set $child (call $tmss_make_window (local.get $client) (i32.const 0)))
    (drop (call $wnd_set_style (local.get $child) (i32.const 0x50CF0000)))
    (drop (call $mdi_child_message
      (local.get $child) (i32.const 1) (i32.const 0) (i32.const 0)))
    (call $host_move_window (local.get $child)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0x14))
    (call $ctrl_geom_sync (local.get $child)
      (local.get $x) (local.get $y) (local.get $w) (local.get $h) (i32.const 0x14))
    (local.get $child))

  (func (export "tmss_set_client_rect") (param $hwnd i32) (param $w i32) (param $h i32)
    (call $client_rect_set (local.get $hwnd)
      (i32.const 0) (i32.const 0) (local.get $w) (local.get $h)))

  (func (export "tmss_syscommand") (param $child i32) (param $sc i32) (result i32)
    (call $mdi_child_message (local.get $child) (i32.const 0x0112)
      (local.get $sc) (i32.const 0)))

  (func (export "tmss_set_placement") (param $child i32) (param $wp i32) (result i32)
    (call $mdi_child_set_placement (local.get $child) (call $g2w (local.get $wp))))

  (func (export "tmss_get_placement") (param $child i32) (param $wp i32)
    (local $saved i32)
    (local.set $saved (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetWindowPlacement (local.get $child) (local.get $wp)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved)))

  (func (export "tmss_x") (param $h i32) (result i32) (call $ctrl_get_x_s (local.get $h)))
  (func (export "tmss_y") (param $h i32) (result i32) (call $ctrl_get_y_s (local.get $h)))
  (func (export "tmss_wh") (param $h i32) (result i32) (call $ctrl_get_wh_packed (local.get $h)))
  (func (export "tmss_iconic") (param $h i32) (result i32) (call $wnd_min_get (local.get $h)))
  (func (export "tmss_client_l") (param $h i32) (result i32) (call $client_rect_get_l (local.get $h)))
  (func (export "tmss_client_t") (param $h i32) (result i32) (call $client_rect_get_t (local.get $h)))
  (func (export "tmss_client_w") (param $h i32) (result i32)
    (i32.sub (call $client_rect_get_r (local.get $h)) (call $client_rect_get_l (local.get $h))))
  (func (export "tmss_client_h") (param $h i32) (result i32)
    (i32.sub (call $client_rect_get_b (local.get $h)) (call $client_rect_get_t (local.get $h))))
  (func (export "tmss_set_title") (param $h i32) (param $wa i32)
    (call $title_table_set (local.get $h) (local.get $wa) (call $strlen (local.get $wa))))
  (func (export "tmss_title_ptr") (param $h i32) (result i32) (call $title_table_get_ptr (local.get $h)))
  (func (export "tmss_title_len") (param $h i32) (result i32) (call $title_table_get_len (local.get $h)))
  (func (export "tmss_activate") (param $client i32) (param $child i32) (result i32)
    (call $mdi_client_activate (local.get $client) (local.get $child)))
  (func (export "tmss_zoomed") (param $h i32) (result i32) (call $wnd_max_get (local.get $h)))

  (func (export "tmss_make_top") (param $style i32) (result i32)
    (local $h i32)
    (local.set $h (call $tmss_make_window (i32.const 0) (i32.const 0)))
    (drop (call $wnd_set_style (local.get $h) (local.get $style)))
    (local.get $h))
  (func (export "tmss_frame_message") (param $frame i32) (param $client i32)
      (param $msg i32) (param $wp i32) (param $lp i32) (result i32)
    (call $mdi_frame_message (local.get $frame) (local.get $client)
      (local.get $msg) (local.get $wp) (local.get $lp)))
  (func (export "tmss_small_icon") (param $h i32) (result i32)
    (call $wnd_small_icon (local.get $h)))
  (func (export "tmss_open_system_menu") (param $h i32)
    (call $system_menu_refresh (local.get $h)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      set_window_zorder() {},
      activate_window() { return 1; },
    },
  });

  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes USER state');

  const alloc = size => e.guest_alloc(size) >>> 0;
  const readA = g => { let s = ''; for (let c; (c = e.guest_read8(g)); g++) s += String.fromCharCode(c); return s; };
  const label = (menu, item, flags) => {
    const buf = alloc(64);
    e.call_GetMenuStringA(menu, item, buf, 64, flags);
    return readA(buf);
  };
  const ids = menu => {
    const out = [];
    for (let i = 0; i < (e.call_GetMenuItemCount(menu) | 0); i++) out.push(e.call_GetMenuItemID(menu, i) | 0);
    return out;
  };

  // The frame's menu: &File (Exit, 100) and &Window (Tile, 200).
  const strings = ['&File', '&Window', 'E&xit', '&Tile'];
  const fileHdr = 4 + 2 * 16, winHdr = fileHdr + 32;
  let size = winHdr + 32;
  const offs = strings.map(t => { const a = size; size += t.length; return a; });
  const blob = alloc(size);
  for (let i = 0; i < size; i++) e.guest_write8(blob + i, 0);
  e.guest_write32(blob, 2);
  [[0, fileHdr], [1, winHdr]].forEach(([top, hdr]) => {
    e.guest_write32(blob + 4 + top * 16, offs[top]);
    e.guest_write32(blob + 8 + top * 16, strings[top].length);
    e.guest_write32(blob + 12 + top * 16, hdr);
  });
  [[fileHdr, 2, 100], [winHdr, 3, 200]].forEach(([hdr, str, id]) => {
    e.guest_write32(blob + hdr, 1);
    e.guest_write32(blob + hdr + 4, offs[str]);
    e.guest_write32(blob + hdr + 8, strings[str].length);
    e.guest_write32(blob + hdr + 24, id);
  });
  strings.forEach((t, i) => { for (let j = 0; j < t.length; j++) e.guest_write8(blob + offs[i] + j, t.charCodeAt(j)); });

  const frame = e.tmss_make_frame() >>> 0;
  const client = e.tmss_make_client(frame) >>> 0;
  e.tmss_set_client_rect(client, 400, 300);
  e.menu_set_source_guest(frame, blob, size, 0x00BE0091);
  const bar = e.call_GetMenu(frame) >>> 0;
  const file = e.call_GetSubMenu(bar, 0) >>> 0;
  const child = e.tmss_make_child(client, 30, 40, 200, 120) >>> 0;
  const other = e.tmss_make_child(client, 60, 70, 150, 90) >>> 0;
  e.tmss_activate(client, child);

  assert.strictEqual(e.call_GetMenuItemCount(bar), 2, 'nothing maximized: the frame has its own two menus');

  // Maximize: the frame's bar gains the child's four items.
  assert.strictEqual(e.tmss_syscommand(child, SC_MAXIMIZE), 1);
  const sys = e.call_GetSystemMenu(child, 0) >>> 0;
  assert(sys, 'the child has a system menu');
  assert.strictEqual(e.call_GetMenuItemCount(bar), 6, 'Win98 adds the system menu and three buttons');
  assert.strictEqual(e.call_GetSubMenu(bar, 0) >>> 0, sys, 'position 0 is the child\'s system menu');
  assert.strictEqual(e.call_GetSubMenu(bar, 1) >>> 0, file, 'File moves over and keeps its handle');
  assert.strictEqual(e.call_GetMenuItemID(file, 0) | 0, 100);
  assert.deepStrictEqual(ids(bar).slice(3), [SC_MINIMIZE, SC_RESTORE, SC_CLOSE]);
  const x = pos => e.menu_bar_item_x(frame, pos) | 0;
  assert(x(3) > x(2) + 40, 'the buttons are right-justified, apart from the menus');

  // The system menu of an MDI child: Win98's items, Ctrl+F4 and Next.
  assert.deepStrictEqual(ids(sys),
    [SC_RESTORE, SC_MOVE, SC_SIZE, SC_MINIMIZE, SC_MAXIMIZE, SEP, SC_CLOSE, SEP, SC_NEXTWINDOW]);
  assert.strictEqual(label(sys, SC_CLOSE, 0), '&Close\tCtrl+F4');
  assert.strictEqual(label(sys, SC_NEXTWINDOW, 0), 'Nex&t\tCtrl+F6');
  assert.strictEqual(e.call_GetSystemMenu(child, 0) >>> 0, sys, 'asking again returns the same menu');
  e.tmss_open_system_menu(sys);
  const grayed = id => (e.call_GetMenuState(sys, id, 0) & MF_GRAYED) !== 0;
  assert.deepStrictEqual(
    [SC_RESTORE, SC_MOVE, SC_SIZE, SC_MINIMIZE, SC_MAXIMIZE, SC_CLOSE].map(grayed),
    [false, true, true, false, true, false],
    'a maximized window can be restored, minimized or closed, not moved, sized or maximized');

  // The icon drawn there is the child's small icon. mIRC gives Status its
  // icons with WM_SETICON, which DefWindowProc keeps and WM_GETICON returns.
  assert.strictEqual(e.call_DefWindowProcA(child, 0x0080, 1, 0x650046), 0, 'WM_SETICON big: no previous icon');
  assert.strictEqual(e.tmss_small_icon(child) >>> 0, 0x650046, 'with only a big icon, that is drawn');
  assert.strictEqual(e.call_DefWindowProcA(child, 0x0080, 0, 0x650045), 0);
  assert.strictEqual(e.tmss_small_icon(child) >>> 0, 0x650045, 'the small icon wins');
  assert.strictEqual(e.call_DefWindowProcA(child, 0x007F, 0, 0) >>> 0, 0x650045, 'WM_GETICON small');
  assert.strictEqual(e.call_DefWindowProcA(child, 0x007F, 1, 0) >>> 0, 0x650046, 'WM_GETICON big');
  assert.strictEqual(e.call_DefWindowProcA(child, 0x0080, 0, 0x650047) >>> 0, 0x650045,
    'WM_SETICON returns the icon it replaces');

  // Activating another child moves the maximized state and the items with it.
  e.tmss_activate(client, other);
  assert.strictEqual(e.tmss_zoomed(other), 1);
  assert.strictEqual(e.call_GetMenuItemCount(bar), 6, 'still one set of items');
  assert.strictEqual(e.call_GetSubMenu(bar, 0) >>> 0, e.call_GetSystemMenu(other, 0) >>> 0,
    'now the other child\'s system menu');

  // Restore chosen from the frame's bar arrives as WM_COMMAND, and
  // DefFrameProc takes it: it sends WM_SYSCOMMAND to the child. (These
  // harness children have no guest procedure to run DefMDIChildProc; mIRC
  // exercises the delivery end to end.) The child's own restore follows.
  assert.strictEqual(e.tmss_frame_message(frame, client, 0x0111, SC_RESTORE, 0), 1,
    'DefFrameProc takes a system command from its bar');
  assert.strictEqual(e.tmss_syscommand(other, SC_RESTORE), 1);
  assert.strictEqual(e.tmss_zoomed(other), 0);
  assert.strictEqual(e.call_GetMenuItemCount(bar), 2, 'the frame\'s bar is its own again');
  assert.strictEqual(e.call_GetSubMenu(bar, 0) >>> 0, file);
  assert.strictEqual(e.tmss_frame_message(frame, client, 0x0111, SC_RESTORE, 0), 0,
    'with nothing maximized a system command is not the frame\'s to forward');

  // A new menu on the frame is dressed again while a child is maximized.
  assert.strictEqual(e.tmss_syscommand(other, SC_MAXIMIZE), 1);
  assert.strictEqual(e.call_GetMenuItemCount(bar), 6);
  e.menu_set_source_guest(frame, blob, size, 0x00BE0091);
  assert.strictEqual(e.call_GetMenuItemCount(bar), 6, 'SetMenu keeps the maximized child\'s items');
  // Minimizing the maximized child takes its items off; restoring the icon
  // makes it maximized again (it remembers), and they come back.
  assert.strictEqual(e.tmss_syscommand(other, SC_MINIMIZE), 1);
  assert.strictEqual(e.tmss_iconic(other), 1);
  assert.strictEqual(e.call_GetMenuItemCount(bar), 2, 'an iconic child is not maximized');
  assert.strictEqual(e.tmss_frame_message(frame, client, 0x0111, SC_RESTORE, 0), 0,
    'nor does the frame forward its system commands');
  assert.strictEqual(e.tmss_syscommand(other, SC_RESTORE), 1);
  assert.strictEqual(e.tmss_zoomed(other), 1, 'SC_RESTORE on the icon goes back to maximized');
  assert.strictEqual(e.call_GetMenuItemCount(bar), 6);
  assert.strictEqual(e.tmss_syscommand(other, SC_RESTORE), 1);
  assert.strictEqual(e.call_GetMenuItemCount(bar), 2);

  // Top-level system menus follow the window's style.
  const overlapped = e.tmss_make_top(0x10CF0000) >>> 0;
  const topSys = e.call_GetSystemMenu(overlapped, 0) >>> 0;
  assert.deepStrictEqual(ids(topSys),
    [SC_RESTORE, SC_MOVE, SC_SIZE, SC_MINIMIZE, SC_MAXIMIZE, SEP, SC_CLOSE]);
  assert.strictEqual(label(topSys, SC_CLOSE, 0), '&Close\tAlt+F4');
  assert.notStrictEqual(topSys, sys, 'every window has its own');
  const dialog = e.tmss_make_top(0x10C80000) >>> 0; // caption + system menu, no boxes, no sizing
  assert.deepStrictEqual(ids(e.call_GetSystemMenu(dialog, 0) >>> 0), [SC_MOVE, SEP, SC_CLOSE]);
  assert.strictEqual(e.call_GetSystemMenu(overlapped, 1), 0, 'bRevert returns NULL');
  const fresh = e.call_GetSystemMenu(overlapped, 0) >>> 0;
  assert(fresh, 'and the next request builds it again');
  assert.strictEqual(e.call_GetSystemMenu(e.tmss_make_top(0x10C00000) >>> 0, 0), 0,
    'a window without WS_SYSMENU has none');

  console.log('PASS  a maximized MDI child\'s system menu and buttons are items of the frame\'s bar');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node

'use strict';

// Editing a window's menu BAR through the handle GetMenu returns.
//
// InsertMenu, AppendMenu, InsertMenuItem, RemoveMenu, DeleteMenu and
// ModifyMenu on a resource-backed bar used to return TRUE and change nothing:
// the bar was the immutable menu blob. Win98 MDI depends on these working --
// it inserts a maximized child's system-menu icon at position 0 of the
// frame's menu and appends its minimize/restore/close buttons, right-justified
// by MF_HELP -- and so does any program that adds a Window or Tools menu at
// run time.
//
// The blob's dropdown handles are GetSubMenu's encoded (top+1)<<16 values and
// a program holds on to them, so the blob cannot be edited in place. What
// this pins:
//   - every edit API changes the bar's positions (count, ids, labels, popups);
//   - a dropdown handle taken before an insert at 0 still names the same
//     dropdown after it, as an HMENU keeps its identity on Win32;
//   - MF_HELP packs the item and everything after it against the right edge,
//     with the HBMMENU_* bitmap widths USER uses; hit testing agrees;
//   - RemoveMenu leaves a removed popup alive and DeleteMenu destroys it;
//   - a new menu on the window starts again from its blob.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const MF_BYPOSITION = 0x0400;
const MF_POPUP = 0x0010;
const MF_BITMAP = 0x0004;
const MF_HELP = 0x4000;
const MF_STRING = 0x0000;
const MIIM_ID = 0x0002;
const MIIM_STRING = 0x0040;
const MIIM_BITMAP = 0x0080;

const HBMMENU_SYSTEM = 1;
const HBMMENU_MBAR_RESTORE = 2;
const HBMMENU_MBAR_MINIMIZE = 3;
const HBMMENU_MBAR_CLOSE = 5;
const SC_MINIMIZE = 0xF020;
const SC_RESTORE = 0xF120;
const SC_CLOSE = 0xF060;

// A stdcall API called with up to five arguments, ESP restored after.
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
  ['GetMenuStringA', 5], ['GetMenuState', 3], ['RemoveMenu', 3], ['DeleteMenu', 3],
  ['ModifyMenuA', 5], ['IsMenu', 1],
];

const extraWat = APIS.map(([name, n]) => callWat(name, n)).join('') + String.raw`
  (func (export "tmbe_bar_w") (param $hwnd i32) (result i32)
    (call $menu_bar_width (local.get $hwnd)))
`;

let passed = 0;
function check(label, fn) {
  fn();
  passed++;
  console.log(`  ok  ${label}`);
}

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, width: 640, height: 480 });

  const alloc = size => {
    const guest = e.guest_alloc(size) >>> 0;
    assert(guest, `guest_alloc(${size})`);
    return guest;
  };
  const strA = text => {
    const guest = alloc(text.length + 1);
    for (let i = 0; i < text.length; i++) e.guest_write8(guest + i, text.charCodeAt(i));
    e.guest_write8(guest + text.length, 0);
    return guest;
  };
  const readA = guest => {
    let out = '';
    for (let c; (c = e.guest_read8(guest)); guest++) out += String.fromCharCode(c);
    return out;
  };

  // A parsed menu blob: two tops, &File (one command, 100) and &Help (one
  // command, 200). Tops are 16 bytes {text, len, child header, id}; child
  // items 28 bytes {text, len, .., .., flags, id, submenu}.
  const strings = ['&File', '&Help', 'E&xit', '&About'];
  const topsEnd = 4 + 2 * 16;
  const fileHdr = topsEnd;
  const helpHdr = fileHdr + 4 + 28;
  let size = helpHdr + 4 + 28;
  const offsets = strings.map(text => { const at = size; size += text.length; return at; });
  const blob = alloc(size);
  for (let i = 0; i < size; i++) e.guest_write8(blob + i, 0);
  e.guest_write32(blob, 2);
  [[0, fileHdr], [1, helpHdr]].forEach(([top, hdr]) => {
    const rec = blob + 4 + top * 16;
    e.guest_write32(rec, offsets[top]);
    e.guest_write32(rec + 4, strings[top].length);
    e.guest_write32(rec + 8, hdr);
  });
  [[fileHdr, 2, 100], [helpHdr, 3, 200]].forEach(([hdr, str, id]) => {
    e.guest_write32(blob + hdr, 1);
    e.guest_write32(blob + hdr + 4, offsets[str]);
    e.guest_write32(blob + hdr + 8, strings[str].length);
    e.guest_write32(blob + hdr + 4 + 20, id);
  });
  strings.forEach((text, i) => {
    for (let j = 0; j < text.length; j++) e.guest_write8(blob + offsets[i] + j, text.charCodeAt(j));
  });

  const hwnd = 0x10051;
  const source = 0x00BE0081;
  e.test_wnd_table_set(hwnd, 0xffff0002);
  e.menu_set_source_guest(hwnd, blob, size, source);

  const bar = e.call_GetMenu(hwnd) >>> 0;
  const count = () => e.call_GetMenuItemCount(bar) | 0;
  const idAt = pos => e.call_GetMenuItemID(bar, pos) | 0;
  const subAt = pos => e.call_GetSubMenu(bar, pos) >>> 0;
  const label = (item, flags) => {
    const buf = alloc(64);
    e.call_GetMenuStringA(bar, item, buf, 64, flags);
    return readA(buf);
  };

  const file = subAt(0);
  const help = subAt(1);

  check('the bar starts as its blob', () => {
    assert.strictEqual(bar, source, 'GetMenu hands back the menu that was set');
    assert.strictEqual(count(), 2);
    assert(file && help && file !== help, 'both tops have dropdowns');
    assert.strictEqual(label(0, MF_BYPOSITION), '&File');
  });

  const sysPopup = e.test_call_CreatePopupMenu() >>> 0;
  e.test_call_AppendMenuA(sysPopup, MF_STRING, SC_CLOSE, strA('&Close'));

  check('InsertMenu at 0 adds a position and keeps held dropdown handles', () => {
    assert.strictEqual(e.test_call_InsertMenuA(bar, 0,
      MF_BYPOSITION | MF_POPUP | MF_BITMAP, sysPopup, HBMMENU_SYSTEM), 1);
    assert.strictEqual(count(), 3);
    assert.strictEqual(subAt(0), sysPopup, 'the new position is the popup it was given');
    assert.strictEqual(subAt(1), file, 'File moved to 1 with the same handle');
    assert.strictEqual(subAt(2), help);
    assert.strictEqual(e.call_GetMenuItemID(file, 0) | 0, 100,
      'a dropdown handle taken before the insert still reads File');
    assert.strictEqual(e.call_GetMenuItemID(help, 0) | 0, 200);
    assert.strictEqual(label(1, MF_BYPOSITION), '&File');
    assert.strictEqual(label(0, MF_BYPOSITION), '', 'a bitmap item has no text');
  });

  check('AppendMenu adds command items at the end', () => {
    assert.strictEqual(e.test_call_AppendMenuA(bar, MF_HELP | MF_BITMAP, SC_MINIMIZE, HBMMENU_MBAR_MINIMIZE), 1);
    assert.strictEqual(e.test_call_AppendMenuA(bar, MF_BITMAP, SC_RESTORE, HBMMENU_MBAR_RESTORE), 1);
    assert.strictEqual(e.test_call_AppendMenuA(bar, MF_BITMAP, SC_CLOSE, HBMMENU_MBAR_CLOSE), 1);
    assert.strictEqual(count(), 6);
    assert.deepStrictEqual([3, 4, 5].map(idAt), [SC_MINIMIZE, SC_RESTORE, SC_CLOSE]);
    assert.strictEqual(idAt(0), -1, 'a popup position has no id');
    assert.strictEqual(e.call_GetMenuState(bar, 3, MF_BYPOSITION) & 0x3, 0);
  });

  check('MF_HELP packs the buttons against the right edge; the rest run from the left', () => {
    const barW = e.tmbe_bar_w(hwnd) | 0;
    assert(barW > 200, `a bar to lay out (${barW})`);
    const x = pos => e.menu_bar_item_x(hwnd, pos) | 0;
    assert.strictEqual(x(0), 4, 'the system icon starts the bar');
    assert.strictEqual(x(1), 4 + 20, 'HBMMENU_SYSTEM is 20 wide');
    assert.strictEqual(x(5), barW - 18, 'Close ends at the bar edge (18 wide, 2px gap)');
    assert.strictEqual(x(4), barW - 18 - 16, 'Restore before it');
    assert.strictEqual(x(3), barW - 18 - 32, 'Minimize before that');
    assert(x(2) < x(3), 'Help stays in the left group');
    const hit = px => e.menu_hittest_bar(hwnd, 0, 0, px, 5) | 0;
    assert.strictEqual(hit(x(0) + 5), 0);
    assert.strictEqual(hit(x(1) + 5), 1);
    assert.strictEqual(hit(x(3) + 5), 3);
    assert.strictEqual(hit(x(5) + 5), 5);
    assert.strictEqual(hit(x(3) - 5), -1, 'the gap between the groups is empty');
  });

  check('RemoveMenu by command and by position; a removed popup stays alive', () => {
    assert.strictEqual(e.call_RemoveMenu(bar, SC_CLOSE, 0), 1);
    assert.strictEqual(count(), 5);
    assert.strictEqual(e.call_RemoveMenu(bar, 0x7777, 0), 0, 'an id not on the bar fails');
    assert.strictEqual(e.call_RemoveMenu(bar, 0, MF_BYPOSITION), 1);
    assert.strictEqual(e.call_IsMenu(sysPopup), 1, 'RemoveMenu leaves the popup to its owner');
    assert.strictEqual(subAt(0), file);
    assert.strictEqual(count(), 4);
    assert.strictEqual(e.call_RemoveMenu(bar, 9, MF_BYPOSITION), 0, 'a position past the end fails');
  });

  check('DeleteMenu destroys a popup of the bar\'s own', () => {
    assert.strictEqual(e.test_call_InsertMenuA(bar, 0,
      MF_BYPOSITION | MF_POPUP | MF_STRING, sysPopup, strA('&Sys')), 1);
    assert.strictEqual(label(0, MF_BYPOSITION), '&Sys');
    assert.strictEqual(e.call_DeleteMenu(bar, 0, MF_BYPOSITION), 1);
    assert.strictEqual(e.call_IsMenu(sysPopup), 0);
    assert.strictEqual(subAt(0), file);
  });

  check('ModifyMenu replaces a position in place', () => {
    const text = strA('&Window');
    assert.strictEqual(e.call_ModifyMenuA(bar, 1, MF_BYPOSITION | MF_STRING, 300, text), 1);
    e.guest_write8(text, 'X'.charCodeAt(0));
    assert.strictEqual(label(1, MF_BYPOSITION), '&Window', 'the label was copied');
    assert.strictEqual(idAt(1), 300);
    assert.strictEqual(subAt(1), 0, 'the Help dropdown is no longer on the bar');
    assert.strictEqual(label(300, 0), '&Window', 'and it is found by command');
    assert.strictEqual(e.call_ModifyMenuA(bar, 0x7777, MF_STRING, 1, text), 0);
  });

  check('InsertMenuItem, including an MIIM_BITMAP item', () => {
    const mii = alloc(48);
    for (let i = 0; i < 48; i += 4) e.guest_write32(mii + i, 0);
    e.guest_write32(mii, 44);
    e.guest_write32(mii + 4, MIIM_ID | MIIM_STRING);
    e.guest_write32(mii + 16, 400);
    e.guest_write32(mii + 36, strA('&Go'));
    assert.strictEqual(e.test_call_InsertMenuItemA(bar, 0, 1, mii), 1);
    assert.strictEqual(idAt(0), 400);
    assert.strictEqual(label(0, MF_BYPOSITION), '&Go');

    e.guest_write32(mii, 48);
    e.guest_write32(mii + 4, MIIM_ID | MIIM_BITMAP);
    e.guest_write32(mii + 16, SC_CLOSE);
    e.guest_write32(mii + 44, HBMMENU_MBAR_CLOSE);
    assert.strictEqual(e.test_call_InsertMenuItemA(bar, -1, 1, mii), 1);
    const last = count() - 1;
    assert.strictEqual(idAt(last), SC_CLOSE);
    assert.strictEqual(label(last, MF_BYPOSITION), '');
  });

  check('the bar grows past its first allocation', () => {
    const before = count();
    for (let i = 0; i < 40; i++) {
      assert.strictEqual(e.test_call_AppendMenuA(bar, MF_STRING, 1000 + i, strA(`I${i}`)), 1);
    }
    assert.strictEqual(count(), before + 40);
    assert.strictEqual(idAt(before + 39), 1039);
    assert.strictEqual(label(before + 39, MF_BYPOSITION), 'I39');
    assert.strictEqual(e.call_GetMenuItemID(file, 0) | 0, 100);
  });

  check('a new menu on the window starts again from its blob', () => {
    e.menu_set_source_guest(hwnd, blob, size, source);
    assert.strictEqual(count(), 2);
    assert.strictEqual(subAt(0), file);
    assert.strictEqual(label(0, MF_BYPOSITION), '&File');
  });

  console.log(`PASS menu bar edits (${passed} checks)`);
})().catch(err => {
  console.error(err);
  process.exit(1);
});

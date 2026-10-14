#!/usr/bin/env node

'use strict';

// CheckMenuItem through LoadMenu's handle reaches a bar that window creation
// already loaded from the same resource.
//
// A window created with a menu (CreateWindowEx's hMenu, or its class menu)
// records the bar under the bare resource id, while LoadMenuA hands out the
// tagged handle resId | 0x00BE0000. mIRC does both: its frame is created
// with menu 80, then it loads menu 80, checks its View items on that handle
// and SetMenus it onto the frame. The tagged handle used to be decoded as a
// dropdown at position 0xBE - 1, which does not exist, so every check was
// dropped and the View menu showed none.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');
const MENU_ID = 106; // calc.exe's menu resource
const MF_BYPOSITION = 0x400;
const MF_CHECKED = 0x8;

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
  ['GetMenu', 1], ['GetSubMenu', 2], ['GetMenuItemCount', 1], ['GetMenuItemID', 2],
  ['GetMenuState', 3], ['CheckMenuItem', 3],
];

const extraWat = String.raw`
  (func (export "tmct_window") (param $menu i32) (result i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hwnd) (i32.const 0x10CF0000)))
    (call $menu_load (local.get $hwnd) (local.get $menu))
    (local.get $hwnd))
` + APIS.map(([name, n]) => callWat(name, n)).join('\n');

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'calc.exe loads');

  const hwnd = e.tmct_window(MENU_ID) >>> 0;
  const bar = e.call_GetMenu(hwnd) >>> 0;
  assert(bar, 'the window has a menu bar');

  // The first command item of any dropdown.
  let dropdown = 0, id = 0;
  for (let top = 0; top < 8 && !id; top++) {
    const sub = e.call_GetSubMenu(bar, top) >>> 0;
    if (!sub) continue;
    const n = e.call_GetMenuItemCount(sub);
    for (let pos = 0; pos < n && !id; pos++) {
      const candidate = e.call_GetMenuItemID(sub, pos) >>> 0;
      if (candidate && candidate !== 0xFFFFFFFF) { dropdown = sub; id = candidate; }
    }
  }
  assert(id, 'calc\'s menu has a command item');

  const tagged = (0x00BE0000 | MENU_ID) >>> 0;
  e.call_CheckMenuItem(tagged, id, 0);
  assert.strictEqual(e.call_GetMenuState(dropdown, id, 0) & MF_CHECKED, 0, 'starts unchecked');
  assert.strictEqual(e.call_CheckMenuItem(tagged, id, MF_CHECKED), 0,
    'CheckMenuItem on the tagged handle finds the item (previous state MF_UNCHECKED)');
  assert.strictEqual(e.call_GetMenuState(dropdown, id, 0) & MF_CHECKED, MF_CHECKED,
    'the bar\'s dropdown shows the check');
  assert.strictEqual(e.call_GetMenuState(tagged, id, 0) & MF_CHECKED, MF_CHECKED,
    'and the tagged handle reads it back');
  assert.strictEqual(e.call_CheckMenuItem(tagged, id, 0), MF_CHECKED, 'unchecking returns MF_CHECKED');
  assert.strictEqual(e.call_GetMenuState(dropdown, id, 0) & MF_CHECKED, 0, 'and clears it');
  // MF_BYPOSITION on the bar handle names a bar item, which carries no check.
  assert.strictEqual(e.call_CheckMenuItem(tagged, 0, MF_BYPOSITION | MF_CHECKED) | 0, -1,
    'a bar position cannot be checked');

  console.log('PASS  CheckMenuItem through LoadMenu\'s handle reaches the bar loaded from the same resource');
})().catch(err => { console.error(err && err.stack || err); process.exit(1); });

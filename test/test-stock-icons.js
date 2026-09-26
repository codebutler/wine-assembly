#!/usr/bin/env node

'use strict';

// The system's stock icons have pixels.
//
// LoadIcon(NULL, IDI_*) and LoadImage(NULL, OIC_*) used to return one opaque
// handle with nothing to draw, so a window without an icon of its own showed
// none -- in its caption, on its taskbar button -- and nothing could show a
// stock icon at all. They are now Wine's own icons (icons/system/), mounted by
// every host at C:\WINDOWS\SYSTEM\OIC_*.ICO and decoded by the engine the
// first time one is drawn: the 16 or 32px image at 8 bits per pixel or fewer.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const extraWat = String.raw`
  (func (export "tsi_load_icon") (param $hinst i32) (param $id i32) (result i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_LoadIconA (local.get $hinst) (local.get $id)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "tsi_destroy_icon") (param $h i32) (result i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_DestroyIcon (local.get $h)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load offset=0 (global.get $reg_base)))
  (func (export "tsi_natural") (param $h i32) (result i32)
    (call $icon_handle_natural_size (local.get $h)))
  (func (export "tsi_make") (param $style i32) (param $ex i32) (param $dlgproc i32) (result i32)
    (local $hwnd i32) (local $slot i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (local.set $slot (call $wnd_table_find (local.get $hwnd)))
    (call $ctrl_table_set (local.get $slot) (i32.const 0) (i32.const 0))
    (call $ctrl_set_ex_style (local.get $hwnd) (local.get $ex))
    (if (local.get $dlgproc)
      (then (drop (call $dialog_proc_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN)))))
    (local.get $hwnd))
  (func (export "tsi_caption_icon") (param $h i32) (result i32) (call $caption_icon (local.get $h)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const bytes = new Uint8Array(memory.buffer);
  const imageBase = e.get_image_base() >>> 0;

  const rgba = (hicon, px) => {
    const ga = e.guest_alloc(px * px * 4) >>> 0;
    const wa = RegionMap.g2w(ga, imageBase);
    assert.strictEqual(e.icon_rasterize_rgba(hicon, px, wa), 1, `rasterize ${hicon.toString(16)} at ${px}px`);
    return bytes.slice(wa, wa + px * px * 4);
  };
  const opaque = img => { let n = 0; for (let i = 3; i < img.length; i += 4) if (img[i]) n++; return n; };

  const IDI = { APPLICATION: 32512, HAND: 32513, QUESTION: 32514, EXCLAMATION: 32515, ASTERISK: 32516, WINLOGO: 32517 };
  const app = e.tsi_load_icon(0, IDI.APPLICATION) >>> 0;
  assert.strictEqual(app >>> 16, 0x65, 'LoadIcon(NULL, IDI_APPLICATION) is a drawable HICON');
  assert.strictEqual(e.tsi_load_icon(0, IDI.APPLICATION) >>> 0, app, 'and the same one each time');
  assert.strictEqual(e.tsi_natural(app), 0x00200020, 'SM_CXICON x SM_CYICON');

  // Wine's application icon at 32px, 8 bits per pixel: a pale window with a
  // blue title bar across its top, on transparency.
  const img = rgba(app, 32);
  const px = (x, y) => Array.from(img.slice((y * 32 + x) * 4, (y * 32 + x) * 4 + 4));
  let blueTop = 0, pale = 0;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const [r, g, b, a] = px(x, y);
    if (a && y < 10 && b > r + 30) blueTop++;
    if (a && r > 220 && g > 220 && b > 220) pale++;
  }
  assert(blueTop > 40, `a blue title bar at the top (${blueTop} px)`);
  assert(pale > 150, `a pale window (${pale} px)`);
  assert(opaque(img) < 32 * 32, 'with transparency around it');

  // Every stock icon has pixels at both sizes.
  for (const [name, id] of Object.entries(IDI)) {
    const h = e.tsi_load_icon(0, id) >>> 0;
    assert.strictEqual(h >>> 16, 0x65, `IDI_${name} is drawable`);
    for (const size of [16, 32]) {
      const n = opaque(rgba(h, size));
      assert(n > size * 2 && n <= size * size, `IDI_${name} at ${size}px has ink (${n} px)`);
    }
  }

  // A module's own icon is still looked up in that module; an unknown stock
  // id stays opaque.
  assert.strictEqual(e.tsi_load_icon(0, 32600) >>> 0, 0x60001, 'an unknown system id stays opaque');

  // DestroyIcon leaves a shared stock icon drawable.
  e.tsi_destroy_icon(app);
  assert(opaque(rgba(app, 32)) > 0, 'a stock icon survives DestroyIcon');

  // A window without an icon wears IDI_APPLICATION in its caption, unless it
  // is a modal dialog frame (WS_EX_DLGMODALFRAME, or DS_MODALFRAME on a dialog).
  const WS_OVERLAPPEDWINDOW = 0x10CF0000;
  assert.strictEqual(e.tsi_caption_icon(e.tsi_make(WS_OVERLAPPEDWINDOW, 0, 0)) >>> 0, app,
    'an icon-less window shows the stock application icon');
  assert.strictEqual(e.tsi_caption_icon(e.tsi_make(WS_OVERLAPPEDWINDOW, 0x1, 0)), 0,
    'WS_EX_DLGMODALFRAME: none');
  assert.strictEqual(e.tsi_caption_icon(e.tsi_make(0x10C80000 | 0x80, 0, 1)), 0,
    'a DS_MODALFRAME dialog: none');
  assert.strictEqual(e.tsi_caption_icon(e.tsi_make(0x10C80000, 0, 1)) >>> 0, app,
    'a dialog without DS_MODALFRAME: the stock icon');

  console.log('PASS  stock icons: IDI_* draw Wine\'s icons, and an icon-less window wears IDI_APPLICATION');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

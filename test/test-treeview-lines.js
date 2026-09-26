#!/usr/bin/env node
'use strict';

// TVS_HASLINES draws comctl32's dotted lines, and items sit where comctl32
// puts them. Measured on a Windows 98 capture of PuTTY's configuration tree
// (TVS_HASBUTTONS | TVS_HASLINES | TVS_LINESATROOT): 16px rows, a 19px column
// per level with its line 9px in, the 9x9 button centred on the line, the
// label 12px right of it, and grey dots every other pixel starting at each
// line's own start. The lines used to be missing entirely.
//
// The tree is found on screen by its first button, and everything else is
// checked relative to that button's centre, so the test does not depend on
// where the frame lands.

const assert = require('assert');
const { bootRenderHarness, flushPendingPaints } = require('./render-helper');
const RegionMap = require('../lib/region-map.generated.js');

const TVM_INSERTITEMA = 0x1100;
const TVM_EXPAND = 0x1102;
const TVE_EXPAND = 2;

const extraWat = String.raw`
  ;; A registered frame first, then the tree in it, so the tree's DC has a
  ;; surface to draw on.
  (func (export "ttl_tree") (param $style i32) (result i32)
    (local $parent i32) (local $tv i32)
    (local.set $parent (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $parent) (global.get $WNDPROC_CTRL_NATIVE))
    (drop (call $wnd_set_style (local.get $parent) (i32.const 0x90C80000)))
    (call $host_register_dialog_frame (local.get $parent) (i32.const 0) (i32.const 0)
      (i32.const 220) (i32.const 160) (i32.const 1))
    (call $host_move_window (local.get $parent) (i32.const 40) (i32.const 40)
      (i32.const 220) (i32.const 160) (i32.const 0))
    (call $ctrl_table_set (call $wnd_table_find (local.get $parent)) (i32.const 16) (i32.const 0))
    (call $defwndproc_do_nccalcsize (local.get $parent))
    (local.set $tv (call $ctrl_create_child (local.get $parent) (i32.const 8) (i32.const 100)
      (i32.const 4) (i32.const 4) (i32.const 180) (i32.const 120)
      (i32.or (i32.const 0x50000000) (local.get $style)) (i32.const 0)))
    (global.set $tv_active_owner (local.get $tv))
    (call $tv_view_set_row (i32.const 0))
    (local.get $tv))
`;

(async () => {
  const harness = await bootRenderHarness({ extraWat });
  const { exports: e, memory } = harness;
  const u8 = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  const wa = g => RegionMap.g2w(g, e.get_image_base());
  const writeStr = s => {
    const g = e.guest_alloc(s.length + 1) >>> 0;
    const p = wa(g);
    for (let i = 0; i < s.length; i++) u8[p + i] = s.charCodeAt(i);
    u8[p + s.length] = 0;
    return g;
  };
  const insert = (tv, text, parent = 0) => {
    const g = e.guest_alloc(56) >>> 0;
    const p = wa(g);
    u8.fill(0, p, p + 56);
    dv.setUint32(p, parent, true);             // hParent
    dv.setUint32(p + 4, 0xFFFF0002, true);     // TVI_LAST
    dv.setUint32(p + 8, 0x0001, true);         // TVIF_TEXT
    dv.setUint32(p + 24, writeStr(text), true);
    return e.send_message(tv, TVM_INSERTITEMA, 0, g) >>> 0;
  };

  const tv = e.ttl_tree(0x07) >>> 0; // TVS_HASBUTTONS | TVS_HASLINES | TVS_LINESATROOT
  const session = insert(tv, 'Session');
  insert(tv, 'Logging', session);
  const terminal = insert(tv, 'Terminal');
  insert(tv, 'Keyboard', terminal);
  e.send_message(tv, TVM_EXPAND, TVE_EXPAND, session);
  e.send_message(tv, TVM_EXPAND, TVE_EXPAND, terminal);

  flushPendingPaints(harness);
  e.send_message(tv, 0x000F, 0, 0); // WM_PAINT, now that the frame has a surface
  harness.renderer.repaint();
  const ctx = harness.canvas.getContext('2d');
  const { width, height } = harness.canvas;
  const px = ctx.getImageData(0, 0, width, height).data;
  const at = (x, y) => Array.from(px.slice((y * width + x) * 4, (y * width + x) * 4 + 3));
  const grey = (x, y) => { const [r, g, b] = at(x, y); return r === 128 && g === 128 && b === 128; };
  const white = (x, y) => { const [r, g, b] = at(x, y); return r === 255 && g === 255 && b === 255; };
  const dark = (x, y) => { const [r, g, b] = at(x, y); return r < 60 && g < 60 && b < 60; };

  // The first button: a 9x9 grey square, white inside and out.
  let box = null;
  for (let y = 0; y < height - 9 && !box; y++) {
    for (let x = 0; x < width - 9 && !box; x++) {
      let walls = true;
      for (let i = 0; i <= 8 && walls; i++) {
        walls = grey(x + i, y) && grey(x + i, y + 8) && grey(x, y + i) && grey(x + 8, y + i);
      }
      if (walls && white(x + 1, y + 1) && white(x + 7, y + 7) &&
          white(x + 4, y - 1) && white(x - 1, y + 4)) box = { x, y };
    }
  }
  assert(box, 'the first root\'s button is on screen');
  const cx = box.x + 4, cy = box.y + 4;       // the root's line, its row centre
  assert(dark(cx - 2, cy) && dark(cx + 2, cy), 'the button is a minus (Session is expanded)');

  // Horizontal line: dots at cx+6 and cx+8 beyond the box, nothing past it.
  assert(grey(cx + 6, cy) && white(cx + 7, cy) && grey(cx + 8, cy),
    'a dotted line runs from the button to the label');
  assert(white(cx + 9, cy) && white(cx + 10, cy), 'and stops 2px short of the next column');

  // Vertical line under the button, down through Logging's row to Terminal.
  for (let y = cy + 6; y <= cy + 26; y += 2) {
    assert(grey(cx, y), `the root line continues to the next root (dot at +${y - cy})`);
    assert(white(cx, y + 1), `every other pixel (gap at +${y + 1 - cy})`);
  }

  // Logging, one level in: its line is 19px right, from its row top to its
  // centre (it is the last child), then across.
  const lx = cx + 19, ly = cy + 16;
  for (let y = ly - 8; y <= ly; y += 2) assert(grey(lx, y), `the child line (dot at ${y - ly})`);
  assert(white(lx, ly + 2), 'the last child\'s line stops at its centre');
  for (let x = lx; x <= lx + 8; x += 2) assert(grey(x, ly), `the child's horizontal line (+${x - lx})`);

  // Labels start 12px right of their line (the glyph's first ink one further).
  const firstInk = (x0, yc) => {
    for (let x = x0; x < x0 + 20; x++) for (let y = yc - 5; y <= yc + 5; y++) if (dark(x, y)) return x;
    return -1;
  };
  assert.strictEqual(firstInk(lx + 10, ly), lx + 13, 'Logging\'s label starts where Windows 98 puts it');

  console.log('PASS  TVS_HASLINES draws comctl32\'s dotted lines, and items sit on its 19px columns');
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});

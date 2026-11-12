#!/usr/bin/env node
'use strict';

// Exercise the actual placement handler, USER client storage and renderer
// imports together: an outer resize must not leave GetClientRect one call
// behind. No PE or application-specific dimensions are needed.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = `
  (func (export "placement_window") (param $style i32) (result i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (local.get $hwnd))
  (func (export "placement_init_client") (param $hwnd i32)
    (call $defwndproc_do_nccalcsize (local.get $hwnd)))
  (func (export "placement_set") (param $hwnd i32) (param $ptr i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_SetWindowPlacement (local.get $hwnd) (local.get $ptr)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "placement_client") (param $hwnd i32) (param $ptr i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x074ff000))
    (call $handle_GetClientRect (local.get $hwnd) (local.get $ptr)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0)))
`;

(async () => {
  const { exports: e, renderer, instance, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const p = e.guest_alloc(44), rect = e.guest_alloc(16);
  const read = hwnd => {
    e.placement_client(hwnd, rect);
    return [0, 4, 8, 12].map(off => e.guest_read32(rect + off));
  };
  let checks = 0;
  // Captioned and borderless windows; both already-visible and first-show
  // paths. Each is a separate HWND, so a main-window-only repair also fails.
  for (const style of [0x10cf0000, 0x90000000, 0x00cf0000]) {
    const hwnd = e.placement_window(style);
    renderer.createWindow(hwnd, style, 11, 17, 400, 300, 'placement', 0, instance, memory);
    e.placement_init_client(hwnd);
    const initial = read(hwnd);
    const ncW = 400 - initial[2], ncH = 300 - initial[3];
    const place = (x, y, w, h) => {
      [44, 0, 1, 0, 0, 0, 0, x, y, x + w, y + h].forEach((v, i) => e.guest_write32(p + i * 4, v));
      assert.strictEqual(e.placement_set(hwnd, p), 1);
      assert.strictEqual(e.get_esp() >>> 0, 0x074ff00c, 'placement stdcall cleanup');
    };
    for (const [x, y, w, h] of [[31, 47, 508, 376], [59, 61, 287, 193], [83, 97, 287, 193], [83, 97, 287, 193]]) {
      place(x, y, w, h);
      const win = renderer.windows[hwnd];
      assert.deepStrictEqual([win.x, win.y, win.w, win.h], [x, y, w, h], 'outer placement');
      assert.deepStrictEqual(read(hwnd), [0, 0, w - ncW, h - ncH], 'client size must reflect this placement, not the previous one');
      assert.deepStrictEqual([win.clientRect.w, win.clientRect.h], [w - ncW, h - ncH], 'renderer client mirror');
      assert.deepStrictEqual([win.clientRect.x, win.clientRect.y],
        [x + e.get_client_rect_l(hwnd), y + e.get_client_rect_t(hwnd)], 'renderer client origin');
      checks++;
    }
    // A normal sizing algorithm estimates chrome from the current outer and
    // client sizes, then asks for a target client area. It must converge in
    // one iteration, including when shrinking one axis and growing the other.
    const target = [211, 233], win = renderer.windows[hwnd], before = read(hwnd);
    place(101, 103, target[0] + win.w - before[2], target[1] + win.h - before[3]);
    assert.deepStrictEqual(read(hwnd).slice(2), target, 'client-size convergence');
    assert(renderer.windows[hwnd].visible, 'normal placement shows hidden window');
    checks++;
  }
  console.log(`PASS placement client geometry: ${checks} resize/move/repeat/convergence cases`);
})().catch(error => { console.error(error); process.exitCode = 1; });

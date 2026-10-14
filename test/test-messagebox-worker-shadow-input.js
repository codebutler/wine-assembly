#!/usr/bin/env node
'use strict';

// USER-DRAKAN-WEBKIT-20261011: with Threads on, the guest's main thread runs
// in a Worker and the page keeps an idle "host shadow" instance over the same
// memory. A real MessageBoxA parked in the Worker's CACA0006 modal pump must
// be dismissable from the page: a click on OK routed through the shadow
// (dialog_route_mouse_screen, as renderer-input does for a common modal), and
// Enter routed through the shadow's dialog_handle_key. Drakan's "Beta Demo
// Warning" box ignored both on the phone page and in desktop browsers alike.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  ;; MessageBoxA(owner 0, text, caption, MB_OK) on this instance, with a
  ;; return address on the guest stack the way a real call leaves it.
  (func (export "test_messagebox") (param $text i32) (param $caption i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00120000))
    (call $gs32 (i32.const 0x00120000) (i32.const 0x00401000))
    (call $handle_MessageBoxA (i32.const 0) (local.get $text) (local.get $caption)
      (i32.const 0) (i32.const 0) (i32.const 0)))
  (func (export "test_modal_pump") (result i32)
    (call $modal_pump_step (global.get $modal_loop_thunk)))
  (func (export "test_modal_result") (result i32)
    (global.get $modal_result))
`;

function guestString(exports, memory, text) {
  const ptr = exports.guest_alloc(text.length + 1) >>> 0;
  for (let i = 0; i < text.length; i++) exports.guest_write8(ptr + i, text.charCodeAt(i));
  exports.guest_write8(ptr + text.length, 0);
  return ptr;
}

// The dialog's push button: the first child whose control class is BUTTON (1).
function okButton(ui, dlg) {
  let slot = 0;
  while ((slot = ui.wnd_next_child_slot(dlg, slot)) !== -1) {
    const hwnd = ui.wnd_slot_hwnd(slot) >>> 0;
    slot++;
    if (hwnd && (ui.ctrl_get_class(hwnd) | 0) === 1) return hwnd;
  }
  return 0;
}

async function openBox(memory) {
  const worker = await bootRenderHarness({ extraWat, memory });
  const shadow = await bootRenderHarness({ extraWat, memory });
  const guest = worker.exports;
  const ui = shadow.exports;
  ui.set_host_shadow(1);
  guest.test_messagebox(guestString(guest, memory, 'THIS DEMO IS BETA CODE'),
    guestString(guest, memory, 'Drakan Beta Demo Warning'));
  const dlg = guest.modal_dialog_hwnd() >>> 0;
  assert.notStrictEqual(dlg, 0, 'the Worker parks MessageBoxA in a common modal');
  assert.strictEqual(ui.modal_dialog_hwnd() >>> 0, dlg, 'the page shadow sees that modal');
  assert.strictEqual(guest.test_modal_pump(), 1, 'the box stays open until answered');
  guest.clear_yield();
  return { guest, ui, dlg };
}

(async () => {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });

  {
    const { guest, ui, dlg } = await openBox(memory);
    const ok = okButton(ui, dlg);
    assert.notStrictEqual(ok, 0, 'the box has an OK button');
    const x = (ui.wnd_window_screen_x(ok) | 0) + ((ui.wnd_screen_w(ok) | 0) >> 1);
    const y = (ui.wnd_window_screen_y(ok) | 0) + ((ui.wnd_screen_h(ok) | 0) >> 1);
    assert.ok(ui.dialog_route_mouse_screen(dlg, 0x0201, 1, x, y), 'the shadow routes the press to OK');
    ui.dialog_route_mouse_screen(dlg, 0x0202, 0, x, y);
    assert.strictEqual(guest.test_modal_pump(), 0, 'a click on OK completes the Worker\'s MessageBoxA');
    assert.strictEqual(guest.test_modal_result(), 1, 'and it returns IDOK');
  }

  {
    const { guest, ui, dlg } = await openBox(memory);
    ui.dialog_handle_key(dlg, 0x0D, 0);
    assert.strictEqual(guest.test_modal_pump(), 0, 'Enter through the shadow completes it too');
    assert.strictEqual(guest.test_modal_result(), 1, 'and it returns IDOK');
  }

  console.log('PASS  a Worker-parked MessageBoxA is dismissed by a click or Enter through the page shadow');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

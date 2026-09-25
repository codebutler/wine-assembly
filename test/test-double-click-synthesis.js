#!/usr/bin/env node
'use strict';

// USER decides what a double-click is: a second left press within
// GetDoubleClickTime, inside the double-click box, on the same window, whose
// class has CS_DBLCLKS. A browser pointerdown carries no click count, so the
// renderer applies that rule itself. mIRC's Options tree (an owner-drawn
// LISTBOX) expands only on LBN_DBLCLK. Built-in control classes report
// USER's CS_DBLCLKS style from GetClassLong(GCL_STYLE), as GetClassInfo does.

const assert = require('assert');
const { installInputHandlers } = require('../lib/renderer-input');
const { bootRenderHarness } = require('./render-helper');

class FakeRenderer {}
installInputHandlers(FakeRenderer);

const styles = { 0x10002: 0x400B, 0x10003: 0 };
let deep = 0x10002;
const wasm = {
  exports: {
    wnd_child_from_point_deep: () => deep,
    wnd_class_style: hwnd => styles[hwnd] || 0,
  },
};
const r = new FakeRenderer();
const top = { hwnd: 0x10001 };
let now = 1000;
const realNow = performance.now;
performance.now = () => now;
try {
  assert.strictEqual(r._synthesizeDoubleClick(top, wasm, 10, 10, false), false, 'first press');
  now += 200;
  assert.strictEqual(r._synthesizeDoubleClick(top, wasm, 11, 9, false), true,
    'second press within 500 ms and 2 px on a CS_DBLCLKS window');
  now += 100;
  assert.strictEqual(r._synthesizeDoubleClick(top, wasm, 11, 9, false), false,
    'a third press starts over');
  now += 700;
  assert.strictEqual(r._synthesizeDoubleClick(top, wasm, 11, 9, false), false,
    'past the double-click time');
  now += 100;
  assert.strictEqual(r._synthesizeDoubleClick(top, wasm, 20, 9, false), false,
    'outside the double-click box');
  deep = 0x10003;
  now += 100;
  r._synthesizeDoubleClick(top, wasm, 20, 9, false);
  now += 100;
  assert.strictEqual(r._synthesizeDoubleClick(top, wasm, 20, 9, false), false,
    'no double-click for a class without CS_DBLCLKS');
  assert.strictEqual(r._synthesizeDoubleClick(top, wasm, 20, 9, true), true,
    'a host that counted clicks itself is believed');
} finally {
  performance.now = realNow;
}

const extraWat = String.raw`
  (func (export "test_dblclk_listbox") (result i32)
    (call $ctrl_create_child
      (i32.const 0) (i32.const 4) (i32.const 101)
      (i32.const 0) (i32.const 0) (i32.const 100) (i32.const 80)
      (i32.const 0x50a11011) (i32.const 0)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat });
  const lb = e.test_dblclk_listbox() >>> 0;
  assert(lb, 'listbox created');
  assert.strictEqual(e.wnd_class_style(lb) >>> 0, 0x400B,
    'a built-in LISTBOX has USER class style CS_VREDRAW|CS_HREDRAW|CS_DBLCLKS|CS_GLOBALCLASS');
  console.log('PASS  double-clicks follow USER: time, box, same window, CS_DBLCLKS');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

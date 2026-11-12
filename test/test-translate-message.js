#!/usr/bin/env node
'use strict';

// USER's TranslateMessage does not mutate MSG. In the browser path the host
// has already translated the DOM event and queued its WM_CHAR partner, so the
// WAT boundary owns the remaining observable contract: all four virtual-key
// message kinds return TRUE and unrelated messages return FALSE.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_edit_class") (param $hwnd i32)
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_CTRL_NATIVE))
    (call $ctrl_table_set (call $wnd_table_find (local.get $hwnd)) (i32.const 2) (i32.const 0)))
  (func (export "test_translate_message") (param $msg i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
    (call $handle_TranslateMessage
      (local.get $msg) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const msg = e.guest_alloc(28) >>> 0;
  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const msgWA = (msg - imageBase + guestBase) >>> 0;
  const bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer);

  const seed = Uint8Array.from([
    0x34, 0x12, 0x01, 0x00, 0, 0, 0, 0,
    0x41, 0, 0, 0, 1, 0, 0, 0,
    0x78, 0x56, 0x34, 0x12, 9, 0, 7, 0,
    4, 0, 0, 0,
  ]);
  bytes.set(seed, msgWA);

  const translate = message => {
    view.setUint32(msgWA + 4, message, true);
    const before = bytes.slice(msgWA, msgWA + 28);
    const result = e.test_translate_message(msg) >>> 0;
    assert.deepStrictEqual(bytes.slice(msgWA, msgWA + 28), before,
      `TranslateMessage must not mutate MSG for 0x${message.toString(16)}`);
    assert.strictEqual(e.get_esp() >>> 0, 0x00300008,
      'TranslateMessage pops its one argument and return address');
    return result;
  };

  for (const message of [0x0100, 0x0101, 0x0104, 0x0105]) {
    assert.strictEqual(translate(message), 1,
      `virtual-key message 0x${message.toString(16)} returns TRUE`);
  }
  for (const message of [0x000f, 0x0102, 0x0106, 0x0200, 0x0400]) {
    assert.strictEqual(translate(message), 0,
      `non-virtual-key message 0x${message.toString(16)} returns FALSE`);
  }

  // Browser keydown supplies Backspace but never its character event.
  // Custom game fields need WM_CHAR; native EDIT already deletes on keydown.
  e.set_post_queue_count(0);
  view.setUint32(msgWA, 0, true);
  view.setUint32(msgWA + 8, 8, true);
  view.setUint32(msgWA + 12, 0x000e0001, true);
  translate(0x0100);
  assert.strictEqual(e.post_queue_depth(), 1);
  assert.deepStrictEqual([0, 1, 2, 3].map(i => e.post_queue_peek(0, i)),
    [0, 0x0102, 8, 0x000e0001], 'Backspace keeps target and keystroke metadata');
  e.set_post_queue_count(0);
  translate(0x0101);
  assert.strictEqual(e.post_queue_depth(), 0, 'release does not delete again');
  e.test_edit_class(0x10001);
  view.setUint32(msgWA, 0x10001, true);
  translate(0x0100);
  assert.strictEqual(e.post_queue_depth(), 0, 'native EDIT must not delete twice');
  console.log('PASS TranslateMessage preserves MSG and translates custom-field Backspace');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_input_flags") (result i32) (global.get $user_queue_input_flags))
  (func (export "test_post_input") (param $h i32) (result i32)
    (call $post_queue_push_input (local.get $h) (i32.const 0x0201) (i32.const 1) (i32.const 0)))
  (func (export "test_input_owner") (param $tid i32)
    (global.set $current_thread_id (local.get $tid)))
  (func (export "test_input_window")
    (call $wnd_table_set (i32.const 0x3333) (i32.const 0x12345678)))
  (func (export "test_high_window")
    (call $wnd_table_set (i32.const 0x3334) (i32.const 0x12345678)))
  (func (export "test_read_owner_queue") (param $msg i32) (result i32)
    (local $tid i32) (local $result i32)
    (local.set $tid (global.get $current_thread_id))
    (global.set $current_thread_id (i32.const 1))
    (local.set $result (call $shared_post_queue_read (local.get $msg) (i32.const 1)))
    (global.set $current_thread_id (local.get $tid))
    (local.get $result))
  (func (export "test_call_GetMessageA") (param $msg i32)
    (local $saved_esp i32) (local $saved_eip i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $saved_eip (global.get $eip))
    (call $handle_GetMessageA (local.get $msg) (i32.const -1)
      (i32.const 0x400) (i32.const 0x400) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (global.set $eip (local.get $saved_eip)))
  (func (export "test_call_PeekMessageA")
    (param $msg i32) (param $hwnd i32) (param $min i32)
    (param $max i32) (param $remove i32) (result i32)
    (local $saved_esp i32) (local $saved_eip i32) (local $result i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (local.set $saved_eip (global.get $eip))
    (call $handle_PeekMessageA
      (local.get $msg) (local.get $hwnd) (local.get $min)
      (local.get $max) (local.get $remove) (i32.const 0))
    (local.set $result (i32.load offset=0 (global.get $reg_base)))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (global.set $eip (local.get $saved_eip))
    (local.get $result))
  (func (export "test_seed_paint") (param $hwnd i32)
    (global.set $main_hwnd (local.get $hwnd))
    (call $wnd_table_set (local.get $hwnd) (i32.const 0x12345678))
    (call $update_invalidate_full (local.get $hwnd))
    (call $paint_flag_set (local.get $hwnd)))
  (func (export "test_paint_pending") (param $hwnd i32) (result i32)
    (call $paint_flag_test_hwnd (local.get $hwnd)))
`;

(async () => {
  const hardware = [];
  let hardwarePolls = 0;
  let now = 100;
  let inputHwnd = 0x3333;
  const { exports: e, memory } = await bootRenderHarness({
    extraWat,
    extraHostOverrides: {
      check_input: () => {
        hardwarePolls++;
        return hardware.length ? hardware.shift() : 0;
      },
      check_input_hwnd: () => inputHwnd,
      check_input_lparam: () => 0x0014000A,
      get_ticks: () => now,
    },
  });
  const queue = new DataView(memory.buffer, e.get_post_queue_base(), 64);
  const { exports: other } = await bootRenderHarness({ extraWat, memory, fonts: 'none' });
  const msgWa = e.get_guest_base() + 0x3000;
  const msg = new DataView(memory.buffer, msgWa, 28);

  const put = (index, hwnd, id, wParam, lParam) => {
    const off = index * 16;
    queue.setUint32(off, hwnd, true);
    queue.setUint32(off + 4, id, true);
    queue.setUint32(off + 8, wParam, true);
    queue.setUint32(off + 12, lParam, true);
  };

  put(0, 0x1111, 0x0417, 8, 1);
  put(1, 0x2222, 0x0200, 2, 3);
  msg.setUint32(16, 0xFFFFFFFF, true);
  e.set_post_queue_count(2);

  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0x0400, 1), 1,
    'range-filtered peek finds a later matching message');
  assert.strictEqual(msg.getUint32(4, true), 0x0200,
    'the admitted message is returned');
  assert.notStrictEqual(msg.getUint32(16, true), 0xFFFFFFFF,
    'a posted message fills MSG.time for callers that merge filtered peeks');
  assert.strictEqual(e.get_post_queue_count(), 1,
    'PM_REMOVE removes only the admitted message');
  assert.strictEqual(queue.getUint32(4, true), 0x0417,
    'a private message above the filter remains queued');

  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0x0400, 1), 0,
    'peek reports empty when only an out-of-range message remains');
  assert.strictEqual(e.get_post_queue_count(), 1,
    'an out-of-range head message is not consumed');

  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0x2222, 0, 0, 0), 0,
    'an hWnd filter rejects another window message');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 0), 1,
    'an unfiltered PM_NOREMOVE sees the retained private message');
  assert.strictEqual(e.get_post_queue_count(), 1,
    'PM_NOREMOVE leaves the message queued');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 1,
    'an unfiltered PM_REMOVE consumes the retained message');
  assert.strictEqual(e.get_post_queue_count(), 0);

  e.test_input_window();
  const pollsBeforeHardware = hardwarePolls;
  hardware.push(0x00010201); // WM_LBUTTONDOWN, MK_LBUTTON
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x000F, 0x000F, 1), 0,
    'a WM_PAINT-only peek rejects hardware mouse input');
  assert.strictEqual(hardwarePolls, pollsBeforeHardware + 1,
    'the filtered peek fetched one hardware event');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0x0400, 1), 1,
    'a later general peek receives hardware input skipped by the filter');
  assert.strictEqual(msg.getUint32(0, true), 0x3333);
  assert.strictEqual(msg.getUint32(4, true), 0x0201);
  assert.strictEqual(msg.getUint32(8, true), 1);
  assert.strictEqual(msg.getUint32(12, true), 0x0014000A);
  assert.strictEqual(hardwarePolls, pollsBeforeHardware + 2,
    'the later peek checks for newer hardware before scanning the retained event');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0x0400, 1), 0,
    'PM_REMOVE consumes the retained hardware event after it matches');

  const pollsBeforeDisjoint = hardwarePolls;
  hardware.push(0x000D0102, 0x00000200); // WM_CHAR Enter, then WM_MOUSEMOVE
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0x00FF, 1), 0);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0109, 0x01FF, 1), 0);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x020A, 0xFFFF, 1), 0,
    'disjoint filters may skip both keyboard and mouse messages');
  assert.strictEqual(hardwarePolls, pollsBeforeDisjoint + 3,
    'skipping one hardware event allows the next filter to fetch the event behind it');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0200, 0x0209, 1), 1,
    'a later mouse filter finds the queued message behind an excluded key');
  assert.strictEqual(msg.getUint32(4, true), 0x0200);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0100, 0x0108, 1), 1,
    'the earlier excluded key remains queued in original order for its own filter');
  assert.strictEqual(msg.getUint32(4, true), 0x0102);
  assert.strictEqual(msg.getUint32(8, true), 13);

  e.test_timer_set(0x4444, 7, 10, 0);
  now = 110;
  msg.setUint32(16, 0xFFFFFFFF, true);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0109, 0x01FF, 0), 1,
    'the middle disjoint range sees a due WM_TIMER');
  assert.strictEqual(msg.getUint32(4, true), 0x0113);
  assert.strictEqual(msg.getUint32(16, true), 110,
    'a synthesized timer fills MSG.time so a caller can select and remove it');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0113, 0x0113, 1), 1,
    'the selected timer can be removed by its exact message range');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0113, 0x0113, 1), 0,
    'the consumed timer is not returned forever at the same tick');

  // A peek whose filter excludes WM_TIMER must not touch the timer table.
  // The scan used to run as an i32.and operand beside the range test, so a
  // keyboard-only PM_REMOVE peek reset the due timer's last_tick and reported
  // "no message": the timer was swallowed and never delivered to anyone.
  now = 121;
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0100, 0x0108, 1), 0,
    'a keyboard-only PM_REMOVE peek does not see a due timer');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0113, 0x0113, 1), 1,
    'a filtered-out due timer is not consumed by the peek that excluded it');

  e.test_input_window();
  for (const method of ['get', 'peek']) {
    e.test_input_owner(2);
    hardware.push(0x000D0100);
    new Uint8Array(msg.buffer, msg.byteOffset, 28).fill(0);
    if (method === 'get') e.test_call_GetMessageA(0x3000);
    else assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 0);
    assert.notStrictEqual(msg.getUint32(4, true), 0x0100,
      `${method}: another thread must not receive the window's hardware input`);
    e.test_input_owner(1);
    assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 1,
      `${method}: input consumed by another thread reaches its owner`);
    assert.strictEqual(msg.getUint32(0, true), 0x3333);
    assert.strictEqual(msg.getUint32(4, true), 0x0100);
    assert.strictEqual(msg.getUint32(8, true), 13);
    assert.strictEqual(msg.getUint32(12, true), 0x0014000A);
    assert.strictEqual(e.test_input_flags(), 1, `${method}: owner routing retains host-input provenance`);
  }

  e.test_input_owner(2);
  const filled = 96;
  for (let i = 0; i < filled; i++) {
    assert.strictEqual(e.post_message_q(0x3333, 0x0400, i, 0), 1,
      `cross-thread owner queue grows through message ${i}`);
  }
  hardware.push(0x000D0100);
  e.test_call_GetMessageA(0x3000);
  e.test_input_owner(1);
  for (let i = 0; i < filled; i++) {
    assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 1);
    assert.strictEqual(msg.getUint32(4, true), 0x0400);
    assert.strictEqual(msg.getUint32(8, true), i);
    assert.strictEqual(e.test_input_flags(), 0, 'ordinary posts do not inherit input provenance');
  }
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 1);
  assert.strictEqual(msg.getUint32(4, true), 0x0100,
    'hardware routed behind a grown owner queue is retained without loss');
  assert.strictEqual(e.test_input_flags(), 1, 'overflow-to-ring refill retains input provenance');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 0);
  assert.strictEqual(e.test_input_flags(), 0, 'an empty read clears the last source');

  // Cross-thread posts use the same filtered queue path. Put the only admitted
  // message behind a full 64-entry ring so the scan must reach heap overflow
  // without deleting the excluded prefix.
  e.test_input_owner(2);
  for (let i = 0; i < 64; i++) {
    assert.strictEqual(e.post_message_q(0x3333, 0x0417, i, 0), 1);
  }
  assert.strictEqual(e.post_message_q(0x3333, 0x0200, 0xBEEF, 0), 1);
  e.test_input_owner(1);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0200, 0x0200, 1), 1,
    'filtered shared peek finds a matching overflow message');
  assert.strictEqual(msg.getUint32(4, true), 0x0200);
  assert.strictEqual(msg.getUint32(8, true), 0xBEEF);
  assert.strictEqual(e.post_queue_depth(), 64,
    'removing overflow leaves every excluded ring message queued');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0200, 0x0200, 1), 0);
  for (let i = 0; i < 64; i++) {
    assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 1);
    assert.strictEqual(msg.getUint32(4, true), 0x0417);
    assert.strictEqual(msg.getUint32(8, true), i);
  }
  assert.strictEqual(e.post_queue_depth(), 0);

  // The source belongs to the queue entry, not its numeric WM_* value.
  e.test_input_owner(2);
  for (let i = 0; i < 66; i++) e.post_message_q(0x3333, 0x0417, i, 0);
  hardware.push(0x00010201);
  e.test_call_GetMessageA(0x3000);
  e.test_input_owner(1);
  for (const remove of [0, 0, 1]) {
    assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0201, 0x0201, remove), 1);
    assert.strictEqual(e.test_input_flags(), 1, 'filtered overflow peeks retain source across PM_NOREMOVE');
  }
  for (let i = 0; i < 66; i++) {
    assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 1);
    assert.strictEqual(e.test_input_flags(), 0, 'removing input does not label neighbouring posts');
  }
  e.post_message_q(0x3333, 0x0201, 1, 0x0014000A);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0201, 0x0201, 1), 1);
  assert.strictEqual(e.test_input_flags(), 0, 'posted mouse-down is not hardware input on reused storage');
  hardware.push(0x00010201);
  for (const remove of [0, 0, 1]) {
    assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0201, 0x0201, remove), 1);
    assert.strictEqual(e.test_input_flags(), 1, 'direct cached hardware peeks retain source');
  }
  hardware.push(0x00010201);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0400, 0x0400, 1), 0);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0201, 0x0201, 1), 1);
  assert.strictEqual(e.test_input_flags(), 1, 'same-thread filter migration retains source');

  // Last supported queue exercises the high-thread sidecar partition.
  e.test_input_owner(16);
  e.test_high_window();
  inputHwnd = 0x3334;
  e.post_message_q(0x3334, 0x0400, 0, 0);
  e.test_input_owner(2);
  hardware.push(0x00010201);
  e.test_call_GetMessageA(0x3000);
  e.post_message_q(0x3334, 0x0401, 0, 0);
  e.test_input_owner(16);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0400, 0x0400, 1), 1);
  assert.strictEqual(e.test_input_flags(), 0);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 1);
  assert.strictEqual(e.test_input_flags(), 1, 'ring gap compaction moves source with payload in thread 16');
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0, 0, 1), 1);
  assert.strictEqual(e.test_input_flags(), 0);
  e.test_input_owner(1);

  other.test_input_owner(2);
  assert.strictEqual(other.test_post_input(0x3334), 1);
  e.test_input_owner(16);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0201, 0x0201, 1), 1);
  assert.strictEqual(e.test_input_flags(), 1, 'another WASM instance publishes source through shared memory');
  assert.strictEqual(other.test_input_flags(), 0, 'last-read observation stays instance-private');
  e.test_input_owner(1);

  e.test_seed_paint(0x4444);
  assert.strictEqual(e.test_call_PeekMessageA(0x3000, 0, 0x0401, 0x0401, 1), 0,
    'an exact private-message filter does not receive a pending WM_PAINT');
  assert.strictEqual(e.test_paint_pending(0x4444), 1,
    'a filtered-out WM_PAINT remains pending');

  console.log('PASS  PeekMessage filters posted and hardware messages without dropping skipped entries');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

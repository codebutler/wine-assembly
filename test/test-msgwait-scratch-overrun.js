#!/usr/bin/env node

'use strict';

// MsgWaitForMultipleObjects must not write a MSG into a paint scratch slot.
//
// It asks the posted-message queue whether anything is waiting. It used to
// ask by reading the message into a 16-byte paint scratch RECT, but a real
// read writes a whole 28-byte MSG (time and point too). When the ring's last
// slot was the one taken, the 12 extra bytes landed on WND_CLASS_SLOT_TABLE,
// the table right after the ring: windows 0..11 lost their class. mIRC's
// frame -- window 0, with a message loop that lives in this call -- came back
// from its About box wearing another class's icon. The probe now passes no
// buffer at all, which is what "is there a message?" needs. The timer probe
// beside it was worse: it handed the slot's WASM address to a function that
// writes through guest addresses, so its MSG landed wherever that number
// pointed. It passes no buffer now either. (The modal dialog pump, which does
// read the MSG, has a 28-byte buffer of its own -- it was the one whose
// MSG.time reached the class slots while mIRC's About box was up.)

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "tmw_scratch_to") (param $back i32)
    (global.set $paint_scratch_cursor (i32.sub (global.get $PAINT_SCRATCH_SLOTS) (local.get $back))))
  ;; The bytes just past the ring's last slot: whatever region the layout puts
  ;; there (it was WND_CLASS_SLOT_TABLE), a scratch user must not reach them.
  (func $tmw_past_ring (result i32)
    (i32.add (global.get $PAINT_SCRATCH) (i32.mul (global.get $PAINT_SCRATCH_SLOTS) (i32.const 16))))
  (func (export "tmw_past_byte") (param $i i32) (result i32)
    (i32.load8_u (i32.add (call $tmw_past_ring) (local.get $i))))
  (func (export "tmw_set_past_byte") (param $i i32) (param $v i32)
    (i32.store8 (i32.add (call $tmw_past_ring) (local.get $i)) (local.get $v)))
  (func (export "tmw_window") (result i32)
    (local $hwnd i32)
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_BUILTIN))
    (local.get $hwnd))
  (func (export "tmw_post") (param $hwnd i32) (result i32)
    (call $post_queue_push (local.get $hwnd) (i32.const 0x0400) (i32.const 1) (i32.const 2)))
  ;; A timer that is already due: armed, then its last tick backdated.
  (func (export "tmw_timer") (param $hwnd i32)
    (local $i i32) (local $addr i32)
    (call $timer_set (local.get $hwnd) (i32.const 7) (i32.const 10) (i32.const 0))
    (block $done (loop $scan
      (br_if $done (i32.ge_u (local.get $i) (global.get $TIMER_MAX)))
      (local.set $addr (i32.add (global.get $TIMER_TABLE)
        (i32.mul (local.get $i) (global.get $TIMER_ENTRY_SIZE))))
      (if (i32.eq (i32.load (local.get $addr)) (local.get $hwnd))
        (then (i32.store (i32.add (local.get $addr) (i32.const 12))
                (i32.sub (call $host_get_ticks) (i32.const 1000)))))
      (local.set $i (i32.add (local.get $i) (i32.const 1)))
      (br $scan))))
  ;; Where the timer probe's MSG used to land: it was handed the scratch
  ;; slot's WASM address, and it writes through guest addresses.
  (func $tmw_misread (result i32)
    (call $g2w (i32.add (global.get $PAINT_SCRATCH)
      (i32.mul (i32.sub (global.get $PAINT_SCRATCH_SLOTS) (i32.const 1)) (i32.const 16)))))
  (func (export "tmw_misread_byte") (param $i i32) (result i32)
    (i32.load8_u (i32.add (call $tmw_misread) (local.get $i))))
  (func (export "tmw_set_misread_byte") (param $i i32) (param $v i32)
    (i32.store8 (i32.add (call $tmw_misread) (local.get $i)) (local.get $v)))
  (func (export "tmw_timer_due") (result i32) (call $timer_check_due (i32.const 0) (i32.const 0)))
  (func (export "tmw_msgwait") (result i32)
    (local $esp i32)
    (local.set $esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_MsgWaitForMultipleObjects (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0x04FF) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (i32.load offset=0 (global.get $reg_base)))
`;

(async () => {
  const { exports: e } = await bootRenderHarness({ extraWat, fonts: 'none' });

  // A recognisable pattern in the twelve bytes past the ring, a message
  // waiting for this thread, and the ring's last slot up next.
  const hwnd = e.tmw_window() >>> 0;
  for (let i = 0; i < 12; i++) e.tmw_set_past_byte(i, 0x20 + i);
  assert(e.tmw_post(hwnd), 'the message is queued');
  e.tmw_scratch_to(1); // the queue probe takes the ring's last slot
  assert.strictEqual(e.tmw_msgwait(), 0, 'a posted message wakes the wait (WAIT_OBJECT_0 + nCount)');

  for (let i = 0; i < 12; i++) {
    assert.strictEqual(e.tmw_past_byte(i), 0x20 + i,
      `byte ${i} past the ring survives the queue probe`);
  }

  // The same for the timer probe, which also wrote a whole MSG (mIRC arms
  // timers, so this was its path): a due timer and nothing posted.
  const quiet = e.tmw_window() >>> 0;
  e.tmw_timer(quiet);
  assert.strictEqual(e.tmw_timer_due(), 1, 'the timer is due (so the probe below has something to write)');
  for (let i = 0; i < 12; i++) e.tmw_set_past_byte(i, 0x40 + i);
  for (let i = 0; i < 28; i++) e.tmw_set_misread_byte(i, 0x60 + i);
  e.tmw_scratch_to(1); // the ring's last slot is next
  assert.strictEqual(e.tmw_msgwait(), 0, 'a due timer wakes the wait');
  for (let i = 0; i < 12; i++) {
    assert.strictEqual(e.tmw_past_byte(i), 0x40 + i,
      `byte ${i} past the ring survives the timer probe`);
  }
  for (let i = 0; i < 28; i++) {
    assert.strictEqual(e.tmw_misread_byte(i), 0x60 + i,
      `the timer probe writes no MSG through the slot's address read as a guest one (byte ${i})`);
  }
  console.log('PASS  MsgWaitForMultipleObjects probes the queue without writing past a scratch slot');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

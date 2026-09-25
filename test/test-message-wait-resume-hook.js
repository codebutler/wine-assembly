#!/usr/bin/env node
'use strict';

// A GetMessage with nothing to return parks the thread (yield reason 7), and
// the host resumes it through resume_message_wait() when input arrives. If
// that input is a key and a WH_KEYBOARD hook is installed, GetMessage leaves
// through the HookProc, not straight back to its caller. resume_message_wait
// owns EIP for exactly that reason: the hosts used to overwrite it with the
// return address afterwards, which skipped the hook, left its KHK1 frame on
// the stack and returned EAX=0 -- WM_QUIT. mIRC quit on the first character
// typed while its pump was idle.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');
const VK_H = 0x48;
const WM_KEYDOWN = 0x0100;
const KEY_LPARAM = 0x00230001;
const RETURN_SENTINEL = 0x00401234;

const extraWat = String.raw`
  (func (export "test_install_ex_hook") (param $proc i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_SetWindowsHookExA
      (i32.const 2) (local.get $proc) (i32.const 0) (i32.const 1)
      (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  ;; Enter GetMessageA as a guest call would: [esp] = return address, then
  ;; the four arguments. Returns the yield reason it left behind.
  (func (export "test_enter_get_message") (param $msg_ptr i32) (param $ret i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (i32.sub (i32.load offset=16 (global.get $reg_base)) (i32.const 64)))
    (call $gs32 (i32.load offset=16 (global.get $reg_base)) (local.get $ret))
    (global.set $eip (i32.const 0x7777))
    (call $handle_GetMessageA
      (local.get $msg_ptr) (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0))
    (global.get $yield_reason))
`;

function u32(value) {
  return [value, value >>> 8, value >>> 16, value >>> 24].map(v => v & 0xff);
}

(async () => {
  let pending = false;
  const harness = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      check_input: () => {
        if (!pending) return 0;
        pending = false;
        return ((VK_H << 16) | WM_KEYDOWN) >>> 0;
      },
      check_input_hwnd: () => 0,
      check_input_lparam: () => KEY_LPARAM,
    },
  });
  const { exports: e, memory } = harness;

  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes callback support');
  e.init_dx_com_thunks();

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;
  const bytes = new Uint8Array(memory.buffer);
  const observed = e.guest_alloc(8) >>> 0;
  const hook = e.guest_alloc(32) >>> 0;
  const msg = e.guest_alloc(28) >>> 0;

  // KeyboardProc: record wParam, return 0 (let the key through).
  bytes.set(Uint8Array.from([
    0x8b, 0x44, 0x24, 0x08,             // mov eax,[esp+8] (wParam)
    0xa3, ...u32(observed),              // mov [observed],eax
    0x31, 0xc0,                         // xor eax,eax
    0xc2, 0x0c, 0x00,                   // ret 12
  ]), toWasm(hook));
  assert.notStrictEqual(e.test_install_ex_hook(hook) >>> 0, 0,
    'SetWindowsHookExA(WH_KEYBOARD) installs the hook');

  // Nothing queued: GetMessage parks.
  e.set_post_queue_count(0);
  assert.strictEqual(e.test_enter_get_message(msg, 0), 7,
    'an empty queue parks GetMessage on the message-wait yield');
  const parkedEsp = e.get_esp() >>> 0;

  // A key arrives. The resume must leave EIP on the hook, not the caller.
  pending = true;
  assert.strictEqual(e.resume_message_wait(), 1, 'the key completes the wait');
  assert.strictEqual(e.get_eip() >>> 0, hook,
    'resume_message_wait leaves EIP on the WH_KEYBOARD HookProc');

  for (let i = 0; i < 20 && e.get_eip(); i++) e.run(5000);
  assert.strictEqual(e.get_eip() >>> 0, 0,
    'the HookProc returns through the USER continuation to GetMessage\'s caller');
  assert.strictEqual(e.get_eax() >>> 0, 1,
    'GetMessage returns TRUE, not WM_QUIT');
  assert.strictEqual(e.get_esp() >>> 0, (parkedEsp + 20) >>> 0,
    'GetMessage completes exactly its stdcall frame');
  assert.strictEqual(e.guest_read32(observed) >>> 0, VK_H,
    'the HookProc saw the key');
  assert.strictEqual(e.guest_read32(msg + 4) >>> 0, WM_KEYDOWN,
    'the MSG carries the key');

  // Without a hook to enter, the resume returns to the caller itself.
  const queue = new DataView(memory.buffer, e.get_post_queue_base(), 16);
  assert.strictEqual(e.test_enter_get_message(msg, RETURN_SENTINEL), 7,
    'GetMessage parks again');
  queue.setUint32(0, 0x1234, true);
  queue.setUint32(4, 0x0401, true);
  queue.setUint32(8, 0, true);
  queue.setUint32(12, 0, true);
  e.set_post_queue_count(1);
  assert.strictEqual(e.resume_message_wait(), 1, 'a posted message completes the wait');
  assert.strictEqual(e.get_eip() >>> 0, RETURN_SENTINEL,
    'resume_message_wait sets EIP to the return address');
  assert.strictEqual(e.get_eax() >>> 0, 1);

  console.log('PASS test-message-wait-resume-hook');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

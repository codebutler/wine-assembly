#!/usr/bin/env node
'use strict';

// VB1 saves GetClassInfo("Edit").lpfnWndProc, then chains its ThunderTextBox
// messages through CallWindowProc. The saved system-class marker used to
// fall through to DefWindowProc, leaving the textbox without EDIT state.
const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = `
  (func (export "ci_init")
    (global.set $is_win16 (i32.const 1))
    (global.set $WIN16_THUNK_SEL (call $win16_index_to_sel (i32.const 3)))
    (call $win16_seg_set (i32.const 1) (i32.const 0x100000) (i32.const 65536) (i32.const 0) (i32.const 1))
    (call $win16_seg_set (i32.const 2) (i32.const 0x110000) (i32.const 65536) (i32.const 1) (i32.const 2))
    (call $win16_seg_set (i32.const 3) (i32.const 0x120000) (i32.const 65536) (i32.const 0) (i32.const 3))
    (global.set $code16 (i32.const 1))
    (call $win16_set_sreg (i32.const 1) (call $win16_index_to_sel (i32.const 1)))
    (call $win16_set_sreg (i32.const 2) (call $win16_index_to_sel (i32.const 2))))
  (func $ci_frame
    (i32.store offset=16 (global.get $reg_base) (i32.const 0x110800))
    (call $gs16 (i32.const 0x110800) (i32.const 0x90))
    (call $gs16 (i32.const 0x110802) (call $win16_index_to_sel (i32.const 1))))
  (func (export "ci_info") (result i32)
    (call $ci_frame)
    (call $gs32 (i32.const 0x110804) (i32.const 0x00170200))
    (call $gs32 (i32.const 0x110808) (i32.const 0x00170100))
    (call $gs16 (i32.const 0x11080c) (i32.const 0))
    (call $win16_GetClassInfo)
    (i32.load (global.get $reg_base)))
  (func (export "ci_window") (result i32)
    (local $h i32)
    (local.set $h (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (local.get $h) (i32.const 1)))
    ;; An app-owned far procedure, as on the actual ThunderTextBox. Native
    ;; adoption must preserve it and the control id while attaching state.
    (call $wnd_table_set (local.get $h) (i32.const 0x000f0100))
    (call $ctrl_table_set (call $wnd_table_find (local.get $h)) (i32.const 0) (i32.const 2))
    (drop (call $wnd_set_style (local.get $h) (i32.const 0x508100c0)))
    (call $client_rect_set (local.get $h) (i32.const 0) (i32.const 0) (i32.const 48) (i32.const 20))
    (local.get $h))
  (func (export "ci_call") (param $proc i32) (param $h i32)
      (param $msg i32) (param $wp i32) (param $lp i32) (result i32)
    (call $ci_frame)
    (call $gs32 (i32.const 0x110804) (local.get $lp))
    (call $gs16 (i32.const 0x110808) (local.get $wp))
    (call $gs16 (i32.const 0x11080a) (local.get $msg))
    (call $gs16 (i32.const 0x11080c) (call $win16_h16 (local.get $h)))
    (call $gs32 (i32.const 0x11080e) (local.get $proc))
    (call $win16_CallWindowProc)
    (i32.or (i32.and (i32.load (global.get $reg_base)) (i32.const 65535))
      (i32.shl (i32.load offset=8 (global.get $reg_base)) (i32.const 16))))
  (func (export "ci_class") (param $h i32) (result i32) (call $ctrl_table_get_class (local.get $h)))
  (func (export "ci_id") (param $h i32) (result i32) (call $ctrl_table_get_id (local.get $h)))
  (func (export "ci_proc") (param $h i32) (result i32) (call $wnd_table_get (local.get $h)))
  (func (export "ci_state") (param $h i32) (result i32) (call $wnd_get_state_ptr (local.get $h)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none', extraWat });
  e.ci_init();
  const bytes = new Uint8Array(memory.buffer);
  const put = (ptr, text) => bytes.set(Buffer.from(text + '\0'), e.guest_to_wasm(ptr));
  put(0x110100, 'Edit');
  assert.strictEqual(e.ci_info(), 1, 'real Win16 GetClassInfo finds EDIT');
  assert.strictEqual(e.get_esp(), 0x11080e, 'GetClassInfo pops its Pascal frame');
  const proc = e.guest_read32(0x110202) >>> 0;
  assert(proc, 'GetClassInfo supplies a saved procedure');
  const h = e.ci_window();
  assert.strictEqual(e.ci_class(h), 0, 'precondition: app-owned control is not yet native');
  const call = (msg, wp = 0, lp = 0) => {
    const result = e.ci_call(proc, h, msg, wp, lp) >>> 0;
    assert.strictEqual(e.get_esp(), 0x110812, 'CallWindowProc pops its Pascal frame');
    return result;
  };
  call(0x000e); // First chain to the saved EDIT procedure must adopt it.
  assert.strictEqual(e.ci_class(h), 2, 'saved GetClassInfo procedure identifies EDIT');
  assert(e.ci_state(h), 'native EDIT state was initialized');
  assert.strictEqual(e.ci_id(h), 2, 'adoption retains the VB control id');
  assert.strictEqual(e.ci_proc(h) >>> 0, 0x000f0100, 'adoption retains the VB far procedure');
  put(0x110300, '1');
  assert.strictEqual(call(0x000c, 0, 0x00170300), 1, 'WM_SETTEXT accepts a Win16 far string');
  assert.strictEqual(call(0x000e), 1, 'initial level text reaches native state');
  put(0x110300, '');
  call(0x000c, 0, 0x00170300);
  for (const ch of '25') call(0x0102, ch.charCodeAt(0), 1);
  assert.strictEqual(call(0x000e), 2, 'chained keyboard input changes text');
  bytes.fill(0x5a, e.guest_to_wasm(0x110400), e.guest_to_wasm(0x110410));
  assert.strictEqual(call(0x000d, 16, 0x00170400), 2, 'WM_GETTEXT returns typed level length');
  assert.deepStrictEqual(Buffer.from(bytes.slice(e.guest_to_wasm(0x110400), e.guest_to_wasm(0x110403))), Buffer.from('25\0'),
    'typed level is written into the actual far buffer');
  assert.strictEqual(e.ci_proc(h) >>> 0, 0x000f0100, 'text messages preserve guest subclass ownership');
  console.log('PASS Win16 GetClassInfo EDIT chaining adopts native state and preserves typed level');
})().catch(error => { console.error(error); process.exitCode = 1; });

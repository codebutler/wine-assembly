#!/usr/bin/env node

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const apiTable = require('../src/api_table.json');
const { bootRenderHarness } = require('./render-helper');

const ROOT = path.join(__dirname, '..');
const CAPACITY = 64;
const COUNT = 0;
const HNDS = 4;
const MSGS = HNDS + CAPACITY * 4;
const WPARAMS = MSGS + CAPACITY * 4;
const LPARAMS = WPARAMS + CAPACITY * 4;
const RECORD_BYTES = LPARAMS + CAPACITY * 4;

const u32 = value => [value, value >>> 8, value >>> 16, value >>> 24]
  .map(byte => byte & 0xff);

function makeWndProc(observed, callback = []) {
  const out = [];
  const emit = (...bytes) => out.push(...bytes.map(byte => byte & 0xff));
  const storeIndexedEax = address => emit(0x89, 0x04, 0x8d, ...u32(address));
  emit(0x8b, 0x0d, ...u32(observed + COUNT)); // mov ecx,[count]
  emit(0x83, 0xf9, CAPACITY, 0x72, 0x02, 0x0f, 0x0b); // trap instead of overflowing records
  for (const [stackOffset, recordOffset] of [
    [4, HNDS], [8, MSGS], [12, WPARAMS], [16, LPARAMS],
  ]) {
    emit(0x8b, 0x44, 0x24, stackOffset); // mov eax,[esp+stackOffset]
    storeIndexedEax(observed + recordOffset);
  }
  emit(0x41); // inc ecx
  emit(0x89, 0x0d, ...u32(observed + COUNT)); // mov [count],ecx
  emit(...callback);
  emit(0x31, 0xc0); // xor eax,eax
  emit(0x83, 0x7c, 0x24, 8, 0x13, 0x75, 5); // accept WM_QUERYOPEN for OpenIcon
  emit(0xb8, ...u32(1));
  emit(0xc2, 0x10, 0x00); // ret 16
  return Uint8Array.from(out);
}

const extraWat = String.raw`
  (func (export "test_click_activate") (param $h i32) (result i32)
    (call $active_window_transition_reason (local.get $h) (i32.const 2)))
  (func (export "test_thunk") (param $id i32) (result i32)
    (local $p i32)
    (global.set $thunk_guest_base (call $w2g (global.get $THUNK_BASE)))
    (local.set $p (i32.add (global.get $THUNK_BASE) (i32.mul (global.get $num_thunks) (i32.const 8))))
    (i32.store (local.get $p) (i32.const 0))
    (i32.store offset=4 (local.get $p) (local.get $id))
    (global.set $num_thunks (i32.add (global.get $num_thunks) (i32.const 1)))
    (call $update_thunk_end)
    (call $w2g (local.get $p)))
  (func (export "test_make_window")
      (param $proc i32) (param $style i32) (param $parent i32)
      (param $tid i32) (result i32)
    (local $hwnd i32) (local $saved_tid i32)
    (local.set $saved_tid (global.get $current_thread_id))
    (global.set $current_thread_id (local.get $tid))
    (local.set $hwnd (global.get $next_hwnd))
    (global.set $next_hwnd (i32.add (global.get $next_hwnd) (i32.const 1)))
    (call $wnd_table_set (local.get $hwnd) (local.get $proc))
    (drop (call $wnd_set_style (local.get $hwnd) (local.get $style)))
    (call $wnd_set_parent (local.get $hwnd) (local.get $parent))
    (global.set $current_thread_id (local.get $saved_tid))
    (local.get $hwnd))

  (func (export "test_set_active") (param $hwnd i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_SetActiveWindow
      (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_get_active") (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_GetActiveWindow
      (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_get_foreground") (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $handle_GetForegroundWindow
      (i32.const 0) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i64.or
      (i64.extend_i32_u (i32.load offset=0 (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))

  (func (export "test_set_foreground") (param $hwnd i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_SetForegroundWindow
      (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_bring") (param $hwnd i32) (result i32)
    (local $saved_esp i32)
    (local.set $saved_esp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_BringWindowToTop
      (local.get $hwnd) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $saved_esp))
    (i32.load offset=0 (global.get $reg_base)))

  (func (export "test_focus") (result i32) (global.get $focus_hwnd))
  (func (export "test_activation_wrapper") (param $kind i32) (param $h i32) (param $stack i32) (result i64)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (if (i32.eq (local.get $kind) (i32.const 1))
      (then (call $handle_SetForegroundWindow (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 2))
      (then (call $handle_SwitchToThisWindow (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 3))
      (then
        (call $wnd_apply_show_state (local.get $h) (i32.const 2))
        (call $handle_OpenIcon (local.get $h) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))))
    (if (i32.eq (local.get $kind) (i32.const 4))
      (then (call $show_window_activate_top_level (local.get $h) (i32.const 5))))
    (i64.or
      (i64.extend_i32_u (i32.load (global.get $reg_base)))
      (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
  (func (export "test_destroy") (param $hwnd i32)
    (call $wnd_destroy_recursive (local.get $hwnd)))
`;

(async () => {
  assert.strictEqual(apiTable.find(api => api.name === 'SetActiveWindow').nargs, 1);
  assert.strictEqual(apiTable.find(api => api.name === 'GetActiveWindow').nargs, 0);
  assert.strictEqual(apiTable.find(api => api.name === 'GetForegroundWindow').nargs, 0);

  const hostCalls = [];
  const externalForeground = 0x76543210;
  const harness = await bootRenderHarness({
    extraWat,
    fonts: 'none',
    extraHostOverrides: {
      activate_window(hwnd) {
        hostCalls.push(['activate', hwnd >>> 0]);
        return hwnd ? 1 : 0;
      },
      foreground_window() { return externalForeground; },
      set_window_zorder(hwnd, after) {
        hostCalls.push(['zorder', hwnd >>> 0, after | 0]);
      },
      invalidate_frame() {},
      destroy_window() {},
    },
  });
  const { exports: e, memory } = harness;
  const fixture = fs.readFileSync(path.join(ROOT, 'test', 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE initializes synchronous wndproc dispatch');
  e.init_dx_com_thunks();

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const toWasm = guest => (guest - imageBase + guestBase) >>> 0;
  const bytes = new Uint8Array(memory.buffer);
  const view = new DataView(memory.buffer);
  const observed = e.guest_alloc(RECORD_BYTES) >>> 0;
  const proc = e.guest_alloc(128) >>> 0;
  bytes.set(makeWndProc(observed), toWasm(proc));

  const WS_VISIBLE = 0x10000000;
  const WS_CHILD = 0x40000000;
  const first = e.test_make_window(proc, WS_VISIBLE, 0, 1) >>> 0;
  const second = e.test_make_window(proc, WS_VISIBLE, 0, 1) >>> 0;
  const child = e.test_make_window(proc, WS_VISIBLE | WS_CHILD, first, 1) >>> 0;
  const foreign = e.test_make_window(proc, WS_VISIBLE, 0, 2) >>> 0;
  const stack = 0x074ff000;
  const count = () => view.getUint32(toWasm(observed + COUNT), true);
  const records = () => Array.from({ length: count() }, (_, index) => ({
    hwnd: view.getUint32(toWasm(observed + HNDS + index * 4), true),
    msg: view.getUint32(toWasm(observed + MSGS + index * 4), true),
    wParam: view.getUint32(toWasm(observed + WPARAMS + index * 4), true),
    lParam: view.getUint32(toWasm(observed + LPARAMS + index * 4), true),
  }));
  const result = value => Number(value & 0xffffffffn) >>> 0;
  const finalEsp = value => Number(value >> 32n) >>> 0;

  assert.strictEqual(e.test_get_active(), 0,
    'a thread queue starts without an active window');
  let packed = e.test_get_foreground(stack);
  assert.strictEqual(result(packed), externalForeground,
    'GetForegroundWindow reads renderer-wide state rather than this process main HWND');
  assert.strictEqual(finalEsp(packed), stack + 4,
    'zero-argument GetForegroundWindow pops its return address');
  packed = e.test_set_active(first, stack);
  assert.strictEqual(result(packed), 0,
    'first successful SetActiveWindow returns the previous NULL active window');
  assert.strictEqual(finalEsp(packed), stack + 8, 'SetActiveWindow cleans stdcall');
  assert.strictEqual(e.test_get_active() >>> 0, first);
  assert.strictEqual(e.test_focus() >>> 0, first,
    'default WM_ACTIVATE behavior assigns focus to the active top-level');
  assert.deepStrictEqual(records(), [
    { hwnd: first, msg: 0x0006, wParam: 1, lParam: 0 },
    { hwnd: first, msg: 0x0007, wParam: 0, lParam: 0 },
  ], 'first activation synchronously sends WM_ACTIVATE then WM_SETFOCUS');

  packed = e.test_set_active(second, stack);
  assert.strictEqual(result(packed), first,
    'SetActiveWindow returns the previously active top-level');
  assert.strictEqual(e.test_get_active() >>> 0, second);
  assert.strictEqual(e.test_focus() >>> 0, second);
  assert.deepStrictEqual(records().slice(2), [
    { hwnd: first, msg: 0x0006, wParam: 0, lParam: second },
    { hwnd: second, msg: 0x0006, wParam: 1, lParam: first },
    { hwnd: first, msg: 0x0008, wParam: second, lParam: 0 },
    { hwnd: second, msg: 0x0007, wParam: first, lParam: 0 },
  ], 'switch sends deactivation/activation before the focus pair');

  packed = e.test_set_active(child, stack);
  assert.strictEqual(result(packed), 0, 'SetActiveWindow rejects child HWNDs');
  assert.strictEqual(e.test_get_active() >>> 0, second,
    'failed child activation preserves active state');

  packed = e.test_set_active(foreign, stack);
  assert.strictEqual(result(packed), second,
    'a foreign-thread HWND returns this queue\'s previous active window');
  assert.strictEqual(e.test_get_active(), 0,
    'a foreign-thread HWND clears rather than steals this queue\'s active state');
  assert.strictEqual(e.test_focus(), 0,
    'clearing the active window releases focus from its old window tree');
  assert.deepStrictEqual(hostCalls, [
    ['activate', first], ['activate', second],
  ], 'only same-thread SetActiveWindow calls reach browser activation');

  assert.strictEqual(e.test_set_foreground(second), 1);
  assert.strictEqual(e.test_get_active() >>> 0, second,
    'SetForegroundWindow updates the caller queue active state');
  assert.strictEqual(e.test_bring(child), 1);
  assert.strictEqual(e.test_get_active() >>> 0, first,
    'BringWindowToTop activates a child HWND\'s top-level ancestor');
  assert.deepStrictEqual(hostCalls.slice(-3), [
    ['activate', second], ['zorder', child, 0], ['activate', child],
  ], 'foreground and child Bring calls preserve their renderer targets');
  assert.strictEqual(e.test_set_foreground(child), 1);
  assert.strictEqual(e.test_get_active() >>> 0, first);
  assert.deepStrictEqual(hostCalls.at(-1), ['activate', child],
    'shared activation keeps the original child HWND for the host');

  e.test_destroy(first);
  assert.strictEqual(e.test_get_active(), 0,
    'destroying the active top-level clears GetActiveWindow state');
  assert.strictEqual(e.test_set_foreground(foreign), 1);
  assert.strictEqual(e.test_get_active(), 0, 'foreign foreground delegation does not steal queue activation');
  assert.deepStrictEqual(hostCalls.at(-1), ['activate', foreign],
    'foreign foreground HWND still reaches the host');

  const setActiveThunk = e.test_thunk(apiTable.find(api => api.name === 'SetActiveWindow').id);
  const armed = e.guest_alloc(4) >>> 0;
  const resetRecords = () => view.setUint32(toWasm(observed + COUNT), 0, true);
  // Reenter from every synchronous notification boundary, using real guest
  // x86 and the public SetActiveWindow thunk, not a host state assignment.
  const boundaries = [
    ['old', 6, 0], ['target', 6, 1], ['old', 8, null], ['target', 7, null],
  ];
  for (const [kind, where, message, wp] of [0, 1, 2, 3, 4]
    .flatMap(kind => boundaries.map(boundary => [kind, ...boundary]))) {
    resetRecords();
    const hookProc = e.guest_alloc(256) >>> 0;
    const old = e.test_make_window(where === 'old' ? hookProc : proc, WS_VISIBLE, 0, 1) >>> 0;
    const target = e.test_make_window(where === 'target' ? hookProc : proc, WS_VISIBLE, 0, 1) >>> 0;
    const chosen = e.test_make_window(proc, WS_VISIBLE, 0, 1) >>> 0;
    const action = [0xc7, 0x05, ...u32(armed), ...u32(0), // disarm before recursion
      0x68, ...u32(chosen), 0xb8, ...u32(setActiveThunk), 0xff, 0xd0];
    const conditionalWp = wp === null ? action :
      [0x83, 0x7c, 0x24, 12, wp, 0x75, action.length, ...action];
    const conditionalMsg = [0x83, 0x7c, 0x24, 8, message,
      0x75, conditionalWp.length, ...conditionalWp];
    bytes.set(makeWndProc(observed, [0x83, 0x3d, ...u32(armed), 0,
      0x74, conditionalMsg.length, ...conditionalMsg]), toWasm(hookProc));
    view.setUint32(toWasm(armed), 0, true);
    e.test_set_active(old, stack);
    resetRecords();
    hostCalls.length = 0;
    view.setUint32(toWasm(armed), 1, true);
    packed = kind === 0 ? e.test_set_active(target, stack) :
      e.test_activation_wrapper(kind, target, stack);
    if (kind === 0) assert.strictEqual(result(packed), old,
      'outer return retains its original previous HWND');
    if (kind === 3) assert.strictEqual(result(packed), 1,
      'OpenIcon still reports its successful restore');
    assert.strictEqual(finalEsp(packed), stack + (kind === 4 ? 0 : kind === 2 ? 12 : 8),
      `wrapper ${kind}: nested activation preserves caller stack`);
    assert.strictEqual(e.test_get_active() >>> 0, chosen);
    assert.strictEqual(e.test_focus() >>> 0, chosen, `${where}/${message}: nested focus survives`);
    const events = records();
    const choice = events.findIndex(r => r.hwnd === chosen && r.msg === 6 && r.wParam === 1);
    assert(count() <= CAPACITY, 'notification recorder stays within its allocation');
    assert(choice >= 0, `${where}/${message}: nested target receives activation: ${JSON.stringify(events)}`);
    assert(!events.slice(choice + 1).some(r => r.hwnd === target &&
      ((r.msg === 6 && r.wParam === 1) || r.msg === 7)),
    `${where}/${message}: superseded target gets no stale activation/focus`);
    assert.deepStrictEqual(hostCalls, [['activate', chosen]],
      `wrapper ${kind}, ${where}/${message}: outer host activation must not undo the nested choice`);
  }

  {
    const first = e.test_make_window(proc, WS_VISIBLE, 0, 1);
    const second = e.test_make_window(proc, WS_VISIBLE, 0, 1);
    e.test_set_active(first, stack);
    resetRecords();
    assert.strictEqual(e.test_click_activate(second), first);
    assert.deepStrictEqual(records(), [
      { hwnd: first, msg: 6, wParam: 0, lParam: second },
      { hwnd: second, msg: 6, wParam: 2, lParam: first },
      { hwnd: first, msg: 8, wParam: second, lParam: 0 },
      { hwnd: second, msg: 7, wParam: first, lParam: 0 },
    ], 'mouse reason changes only the activating WM_ACTIVATE');
    resetRecords();
    e.test_click_activate(second);
    assert.deepStrictEqual(records(), [], 'same-target click does not repeat activation');
    const clickProc = e.guest_alloc(256);
    const clickTarget = e.test_make_window(clickProc, WS_VISIBLE, 0, 1);
    const nestedAction = [0x68, ...u32(first), 0xb8, ...u32(setActiveThunk), 0xff, 0xd0];
    const whenClick = [0x83, 0x7c, 0x24, 12, 2, 0x75, nestedAction.length, ...nestedAction];
    bytes.set(makeWndProc(observed, [0x83, 0x7c, 0x24, 8, 6,
      0x75, whenClick.length, ...whenClick]), toWasm(clickProc));
    resetRecords();
    e.test_click_activate(clickTarget);
    assert.strictEqual(e.test_get_active(), first);
    assert(records().some(r => r.hwnd === clickTarget && r.msg === 6 && r.wParam === 2));
    assert(records().some(r => r.hwnd === first && r.msg === 6 && r.wParam === 1),
      'nested API activation does not inherit mouse reason');
    assert(!records().some(r => r.hwnd === clickTarget && r.msg === 7),
      'superseded click must not reclaim focus');
  }
  console.log('PASS Set/GetActiveWindow retain per-thread USER activation state');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

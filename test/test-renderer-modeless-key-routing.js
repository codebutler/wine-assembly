#!/usr/bin/env node
'use strict';
const assert = require('assert/strict');
const { installInputHandlers } = require(process.env.MODELESS_INPUT || '../lib/renderer-input');
function Renderer() {}
installInputHandlers(Renderer);
function make(proc, modal = 0, worker = false) {
  const r = new Renderer(), calls = [];
  r.wasm = { exports: {
    get_focus_hwnd: () => 102,
    dialog_ancestor: () => 101,
    dialog_get_proc_export: hwnd => { assert.equal(hwnd, 101); return proc; },
    dialog_handle_key: (...args) => { calls.push(args); return 1; },
  } };
  r.windows = {}; r.inputQueue = [];
  r._restoreKeyboardInputOwner = r._seedKeyboardFocus = () => {};
  r.pokeKeyDownState = r._signalDirectInputDevice = () => {};
  r._wakeMessageWait = r.repaint = r.scheduleRepaint = () => {};
  r._modalDialogHwnd = () => modal;
  r._keyboardOwnerRunsInGuestWorker = () => worker;
  return { r, calls };
}
function press(r, vk) {
  r.handleKeyDown(vk);
  r.handleKeyPress(vk);
  r.handleKeyUp(vk);
}
for (const proc of [0x459839, 0x12340056]) {
  const { r, calls } = make(proc);
  press(r, 27);
  assert.deepEqual(calls, [], 'guest modeless Escape must reach its own loop');
  assert.deepEqual(r.inputQueue.map(e => [e.msg, e.wParam]),
    [[256, 27], [258, 27], [257, 27]], 'retain down/char/up instead of IDCANCEL');
  while (r.takeInput()) {}
  assert.equal(r._asyncKeys[27], false, 'guest pump observes the release');
  for (const vk of [9, 13, 32, 37]) press(r, vk);
  assert.deepEqual(calls, [], 'guest decides traversal through IsDialogMessage');
}
for (const proc of [0, 0xffff0001, 0xffff0010 | 0]) {
  const { r, calls } = make(proc);
  press(r, 27);
  assert.deepEqual(calls, [[101, 27, 0]], 'built-in dialog keeps Escape traversal');
  assert(!r.inputQueue.some(e => e.msg === 256 || e.msg === 258));
}
for (const worker of [false, true]) {
  const { r, calls } = make(0x459839, 101, worker);
  press(r, 27);
  assert.deepEqual(calls, [[101, 27, 0]], 'modal pump keeps its Escape command');
  assert(!r.inputQueue.some(e => e.msg === 256 || e.msg === 258));
}
console.log('PASS guest modeless raw keys, native dialog traversal, modal cooperative/Worker Escape');

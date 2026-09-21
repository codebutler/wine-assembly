#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { Win98Renderer } = require('../lib/renderer');

const canvas = {
  width: 640,
  height: 480,
  getContext() {
    return {
      save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
      clearRect() {}, fillRect() {}, strokeRect() {}, fillText() {},
      measureText() { return { width: 0 }; },
      drawImage() {}, putImageData() {}, getImageData() { return { data: new Uint8ClampedArray(4) }; },
    };
  },
};

const appA = {
  exports: {
    modal_dialog_hwnd() { return 101; },
    wnd_window_screen_x(hwnd) { return hwnd === 101 ? 350 : 300; },
    wnd_window_screen_y() { return 20; },
    wnd_screen_w(hwnd) { return hwnd === 101 ? 100 : 250; },
    wnd_screen_h(hwnd) { return hwnd === 101 ? 100 : 180; },
  },
};
const appB = {
  exports: {
    modal_dialog_hwnd() { return 0; },
    wnd_child_from_point_deep() { return 0; },
    set_focus_hwnd() {},
  },
};

const renderer = new Win98Renderer(canvas);
renderer.wasm = appA;
renderer.windows[100] = {
  hwnd: 100, visible: true, isChild: false,
  x: 300, y: 10, w: 250, h: 200, zOrder: 1, style: 0, wasm: appA,
};
renderer.windows[101] = {
  hwnd: 101, visible: true, isChild: false, isDialog: true, isAboutDialog: true,
  x: 30, y: 20, w: 100, h: 100, zOrder: 2, style: 0, wasm: appA,
};
renderer.windows[200] = {
  hwnd: 200, visible: true, isChild: false,
  x: 10, y: 10, w: 250, h: 200, zOrder: 3, style: 0, wasm: appB,
};
renderer._nextZ = 4;

renderer.handleMouseDown(40, 60, 0);
renderer.handleMouseUp(40, 60, 0);
assert.deepStrictEqual(renderer.inputQueue.map(event => [event.hwnd, event.msg]), [
  [200, 0x0084],
  [200, 0x0201],
  [200, 0x0202],
], 'a dialog in app A must not outrank the frontmost overlapping window in app B');
assert.strictEqual(renderer.inputQueue[0].lParam, (60 << 16) | 40,
  'the owning app receives WM_NCHITTEST in screen coordinates before the click');

// Consuming a pointer event for B does not require giving it the keyboard.
// This is the separation needed while USER has not yet accepted activation.
renderer._setKeyboardInputOwner(renderer.windows[100]);
const owns = wasm => event => renderer.windows[event.hwnd]?.wasm === wasm;
assert.strictEqual(renderer.takeInput(owns(appA)), null,
  'app A cannot consume pending pointer events addressed to B');
assert.deepStrictEqual([0x0084, 0x0201, 0x0202].map(() => renderer.takeInput(owns(appB)).msg),
  [0x0084, 0x0201, 0x0202], 'app B consumes its query/down/up without keyboard ownership');
assert.strictEqual(renderer._keyboardInputWasm, appA,
  'pointer dequeue must not itself publish an activation decision');

renderer.inputQueue.length = 0;
renderer.windows[100].zOrder = renderer._nextZ++;
renderer.handleMouseDown(310, 180, 0);
renderer.handleMouseUp(310, 180, 0);
assert.deepStrictEqual(renderer.inputQueue, [], 'app A modal dialog should still block its own owner window');

// A toolbar combo uses the native container router. Its pending release
// must retain both that container and the emulator which received the down,
// even when a different application's run slice replaces renderer.wasm.
for (const screenRouter of [true, false]) {
  const r = new Win98Renderer(canvas);
  const calls = [];
  let classifications = 0;
  const foreign = { exports: {
    modal_dialog_hwnd: () => 0,
    dialog_route_mouse_screen: (...args) => { calls.push(['foreign', ...args]); return 1; },
    dialog_route_mouse: (...args) => { calls.push(['foreign', ...args]); return 1; },
  }};
  const owner = { exports: {
    modal_dialog_hwnd: () => 0,
    wnd_get_style_export: () => 0,
    wnd_get_parent: hwnd => hwnd === 301 ? 300 : 0,
    wnd_client_screen_x: () => 10,
    wnd_client_screen_y: () => 20,
    get_focus_hwnd: () => 301,
    set_focus() {},
    ctrl_get_class: () => { classifications++; return 5; },
    [screenRouter ? 'dialog_route_mouse_screen' : 'dialog_route_mouse']:
      (...args) => { calls.push(['owner', ...args]); return 1; },
  }};
  r.wasm = owner;
  r.windows[300] = { hwnd: 300, visible: true, isChild: false,
    x: 10, y: 20, w: 200, h: 160, hasCaption: false, style: 0,
    zOrder: 1, wasm: owner };
  r._hitTestDeepChild = () => ({ hwnd: 301, sx: 30, sy: 40 });
  r.handleMouseDown(45, 55, 0);
  assert.strictEqual(r._dialogBtnDrag.wasm, owner, 'pending release retains emulator identity');
  assert.strictEqual(r._dialogBtnDrag.parent, 300, 'release retains the down routing container');
  r.wasm = foreign;
  r.handleMouseUp(47, 58, 0);
  assert.deepStrictEqual(calls, screenRouter ? [
    ['owner', 300, 0x201, 1, 45, 55],
    ['owner', 300, 0x202, 0, 47, 58],
  ] : [
    ['owner', 300, 0x201, 1, (35 << 16) | 35],
    ['owner', 300, 0x202, 0, (38 << 16) | 37],
  ], 'down/up use one owner and container, with screen or container-client coordinates');
  assert.strictEqual(classifications, 1, 'classify the clicked control once in its owner');
  assert.strictEqual(r._dialogBtnDrag, null, 'release retires the pending native press');
}

console.log('PASS  multi-app modal input and native press ownership stay within the owning emulator instance');

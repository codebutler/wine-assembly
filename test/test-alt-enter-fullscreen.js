#!/usr/bin/env node
'use strict';

// `altEnterFullscreen` apps (Little Fighter 2): Alt+Enter toggles the
// browser's fullscreen and neither the Enter keydown nor its keyup reaches the
// guest -- LF2 acts on WM_SYSKEYUP of Enter by asking for an exclusive
// 794x550x8 mode no display has. Other apps, and Enter without Alt, are
// untouched. Exercised on the real lib/browser-input.js key handlers.

const assert = require('assert');

const listeners = new Map();
const canvas = {
  width: 640, height: 480, style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
  focus() {}, setAttribute() {}, requestPointerLock() {}, addEventListener() {},
};
let fullscreenRequests = 0;
global.window = {
  addEventListener(type, fn) { listeners.set(type, (listeners.get(type) || []).concat(fn)); },
  removeEventListener() {},
  approveBrowserFullscreen: () => { fullscreenRequests++; },
};
global.document = {
  pointerLockElement: null, activeElement: canvas, fullscreenElement: null,
  getElementById: () => null, querySelectorAll: () => [], elementFromPoint: () => null,
  visibilityState: 'visible', addEventListener() {}, body: {}, documentElement: {},
};
global.Node = function Node() {};
global.setInterval = () => 1;
global.clearInterval = () => {};

const keys = [];
const renderer = {
  windows: {}, wantsRelativeMouse: () => false,
  handleKeyDown: (vk) => keys.push(['down', vk]),
  handleKeyUp: (vk) => keys.push(['up', vk]),
  handleKeyPress: (c) => keys.push(['char', c]),
  handleMouseMove() {}, handleMouseDown() {}, handleMouseUp() {}, handleMenuHover() {},
};
const runningApps = [{ name: 'little_fighter_2', altEnterFullscreen: true, wine: { running: true } }];
require('../lib/browser-input').wireCanvasInput(canvas, renderer, {
  runningApps, setTimeout: () => 1, clearTimeout() {},
});
const fire = (type, init) => {
  let prevented = false;
  const e = { type, target: canvas, keyCode: 0, key: '', code: '', altKey: false,
    ctrlKey: false, metaKey: false, shiftKey: false, repeat: false, location: 0,
    preventDefault() { prevented = true; }, stopPropagation() {}, ...init };
  for (const fn of listeners.get(type) || []) fn(e);
  return prevented;
};

// Alt+Enter: browser fullscreen, nothing for the guest but the Alt itself.
fire('keydown', { keyCode: 18, key: 'Alt', code: 'AltLeft', altKey: true });
assert(fire('keydown', { keyCode: 13, key: 'Enter', code: 'Enter', altKey: true }),
  'Alt+Enter keydown should be consumed');
assert(fire('keyup', { keyCode: 13, key: 'Enter', code: 'Enter', altKey: true }),
  'the matching Enter keyup should be consumed too');
fire('keyup', { keyCode: 18, key: 'Alt', code: 'AltLeft' });
assert.strictEqual(fullscreenRequests, 1, 'Alt+Enter should ask for browser fullscreen once');
assert.deepStrictEqual(keys.filter(k => k[1] === 13), [],
  'no Enter half may reach the guest, or LF2 would switch its display mode');

// Plain Enter still belongs to the game (LF2's attack and menu key).
keys.length = 0;
fire('keydown', { keyCode: 13, key: 'Enter', code: 'Enter' });
fire('keyup', { keyCode: 13, key: 'Enter', code: 'Enter' });
assert.deepStrictEqual(keys.filter(k => k[0] !== 'char'), [['down', 13], ['up', 13]],
  'Enter without Alt should reach the guest unchanged');

// Opt-in: another app gets its Alt+Enter.
runningApps[0].altEnterFullscreen = false;
keys.length = 0;
fire('keydown', { keyCode: 13, key: 'Enter', code: 'Enter', altKey: true });
fire('keyup', { keyCode: 13, key: 'Enter', code: 'Enter', altKey: true });
assert.deepStrictEqual(keys.filter(k => k[0] !== 'char'), [['down', 13], ['up', 13]],
  'without altEnterFullscreen the guest receives Alt+Enter');
assert.strictEqual(fullscreenRequests, 1, 'and the page does not go fullscreen');

console.log('PASS  altEnterFullscreen turns Alt+Enter into the browser fullscreen toggle');

#!/usr/bin/env node
'use strict';

// Edge scrolling follows the cursor, and on a touchscreen the cursor stays
// wherever the finger left it. A drag-select ending at the screen edge (or a
// tap near it) left StarCraft- and Age-of-Empires-style maps scrolling until
// the next touch elsewhere. `touchControls.edgeInset: N` moves the guest
// cursor N pixels inside the game screen when a direct touch ends within N of
// its edge. Asserted against the real lib/browser-input.js bridge:
//   * a tap at the left edge of an exclusive 640x480 screen ends with a
//     teleported move to x = inset, after the click itself;
//   * a tap in the middle sends no extra move;
//   * without edgeInset the edge tap is left alone (opt-in per game).

const assert = require('assert');

const listeners = new Map();
const canvasListeners = new Map();
const canvas = {
  width: 640, height: 480, style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 480 }),
  focus() {}, setAttribute() {}, requestPointerLock() {},
  addEventListener(type, fn) { canvasListeners.set(type, fn); },
};
global.window = {
  addEventListener(type, fn) {
    listeners.set(type, (listeners.get(type) || []).concat(fn));
  },
  removeEventListener(type, fn) {
    listeners.set(type, (listeners.get(type) || []).filter(entry => entry !== fn));
  },
};
global.document = {
  pointerLockElement: null, activeElement: canvas,
  getElementById: () => null, querySelectorAll: () => [], elementFromPoint: () => null,
  visibilityState: 'visible', addEventListener() {},
};
global.setInterval = () => 1;
global.clearInterval = () => {};

const events = [];
// A scaled presentation, like a real one: the 640-pixel canvas shows a
// 576x432 guest screen, and canvas -> guest floors. Events are recorded in
// GUEST pixels, which is what the game sees. (With identity scaling the
// first version of the fix passed here and still landed one pixel short in
// StarCraft.)
const SCALE = 640 / 576;
const toGuest = v => Math.floor(v / SCALE);
const renderer = {
  windows: {}, _mouseX: 0, _mouseY: 0,
  _exclusivePresentationViewport: { nativeX: 0, nativeY: 0, nativeW: 576, nativeH: 432 },
  _unmapExclusiveInputPoint: (x, y) => ({ x: x * SCALE, y: y * SCALE }),
  wantsRelativeMouse: () => false,
  handleMouseMove(x, y, opts) {
    this._mouseX = toGuest(x); this._mouseY = toGuest(y);
    events.push(['move', this._mouseX, this._mouseY, !!(opts && opts.teleport)]);
  },
  handleMouseDown: (x, y, b) => events.push(['down', toGuest(x), toGuest(y), b]),
  handleMouseUp: (x, y, b) => events.push(['up', toGuest(x), toGuest(y), b]),
  handleMenuHover() {},
};
const runningApps = [{ name: 'starcraft_shareware', mobileTouch: 'direct',
  touchControls: { edgeInset: 8 }, wine: { running: true } }];
const timers = new Map(); let timerId = 0;
const browserInput = require('../lib/browser-input');
browserInput.wireCanvasInput(canvas, renderer, {
  runningApps, setTimeout: fn => {timers.set(++timerId, fn);return timerId;}, clearTimeout: id => timers.delete(id),
});

const touchStart = canvasListeners.get('touchstart');
const tev = (touches, changed) => ({ touches, changedTouches: changed || touches,
  preventDefault() {}, stopPropagation() {} });
const finger = (identifier, clientX, clientY) => ({ identifier, clientX, clientY });
const tap = (id, x, y) => {
  const f = finger(id, x, y);
  touchStart(tev([f], [f]));
  (listeners.get('touchend') || []).at(-1)(tev([], [f]));
};

// Left edge (canvas 1,201 = guest 0,180): the click lands where the finger
// was, then the cursor steps edgeInset guest pixels in -- exactly 8, not 7.
events.length = 0;
tap(1, 1, 201);
const up = events.findIndex(e => e[0] === 'up');
assert(up >= 0, 'the edge tap should still click');
assert.deepStrictEqual(events[up], ['up', 0, 180, 0], 'the click belongs to the touched point');
assert.deepStrictEqual(events.slice(up + 1), [['move', 8, 180, true]],
  'after the click the cursor should move exactly edgeInset guest pixels inside, as a teleport');

// Bottom-right corner (guest 575,431 on a 576x432 screen) clamps both axes.
events.length = 0;
tap(2, 639, 479);
assert.deepStrictEqual(events.at(-1), ['move', 567, 423, true],
  'a corner release should clamp both axes inside the inset');

// Away from the edges nothing extra happens.
events.length = 0;
tap(3, 321, 241);
assert.deepStrictEqual(events.at(-1), ['up', 288, 216, 0],
  'a tap away from the edge should end with its own release');

// Opt-in: without edgeInset an edge tap leaves the cursor where it was.
delete runningApps[0].touchControls;
events.length = 0;
tap(4, 1, 201);
assert.deepStrictEqual(events.at(-1), ['up', 0, 180, 0],
  'without touchControls.edgeInset the bridge must not move the cursor');

console.log('PASS  touch release near the screen edge parks the cursor inside edgeInset');

// Native controls stay directly tappable even for relative/aim-only games.
for (const aimOnly of [false, true]) {
  runningApps[0].mobileTouch = 'trackpad';
  runningApps[0].touchControls = { aimOnly };
  renderer.touchWantsImmediatePress = (x, y) => x >= 400 && y >= 200;
  renderer._mouseX = 20; renderer._mouseY = 30;
  events.length = 0;
  tap(10 + Number(aimOnly), 450, 250);
  assert.deepStrictEqual(events.filter(e => e[0] === 'down' || e[0] === 'up'),
    [['down', toGuest(450), toGuest(250), 0], ['up', toGuest(450), toGuest(250), 0]],
    'native button must receive paired input at the finger, independent of aim mode');
}
console.log('PASS native controls override relative touch mode');

// A game-surface tap keeps trackpad/aim-only semantics.
renderer.touchWantsImmediatePress = () => false;
for (const aimOnly of [false, true]) {
  runningApps[0].touchControls = { aimOnly };
  renderer._mouseX = 20; renderer._mouseY = 30;
  events.length = 0;
  tap(20 + Number(aimOnly), 250, 150);
  assert.deepStrictEqual(events.filter(e => e[0] === 'down' || e[0] === 'up'),
    aimOnly ? [] : [['down', 20, 30, 0], ['up', 20, 30, 0]],
    'game surface retains relative tap or aim-only semantics');
}

// Exercise the real renderer predicate for menus in scaled phone coordinates.
class MenuRenderer {}
require('../lib/renderer-input').installInputHandlers(MenuRenderer);
const mr = new MenuRenderer();
let menuOpen = false, bar = true;
mr._mapExclusiveInputPoint = (x,y) => ({x:x/2,y:y/2,outside:x<0});
mr._openMenuContext = () => menuOpen ? {} : null;
mr._inputWindowAtPoint = () => ({hwnd:1});
mr._hasMenuBar = () => bar;
mr._ensureWatMenu = () => {};
mr._menuBarPos = () => ({barX:10,barY:20,barH:18});
assert.strictEqual(mr.touchWantsImmediatePress(80,50),true,'native menu bar uses direct touch');
assert.strictEqual(mr.touchWantsImmediatePress(80,100),false,'game client stays relative');
bar=false;assert.strictEqual(mr.touchWantsImmediatePress(80,50),false,'no menu means no override');
menuOpen=true;assert.strictEqual(mr.touchWantsImmediatePress(80,100),true,'open menu receives direct touch');
assert.strictEqual(mr.touchWantsImmediatePress(-1,100),false,'outside presentation remains outside');

// Opted-in taps remain pressed across a guest poll, then pair exactly once.
runningApps[0].touchControls = {trackpadTapHoldMs:100};
events.length=0;tap(30,250,150);
assert.deepStrictEqual(events.filter(e=>e[0]==='down'||e[0]==='up'),[['down',20,30,0]]);
assert.strictEqual(timers.size,1);[...timers.values()][0]();
assert.deepStrictEqual(events.filter(e=>e[0]==='down'||e[0]==='up'),[['down',20,30,0],['up',20,30,0]]);
assert.strictEqual(timers.size,0);

// Clear tap-drag history through an aim-only gesture, then verify blur cleanup.
runningApps[0].touchControls={aimOnly:true};tap(31,250,150);
runningApps[0].touchControls={trackpadTapHoldMs:100};events.length=0;tap(32,250,150);
assert.strictEqual(timers.size,1);
for(const fn of listeners.get('blur')||[])fn();
assert.strictEqual(timers.size,0,'blur cancels deferred release');
assert.deepStrictEqual(events.filter(e=>e[0]==='down'||e[0]==='up'),[['down',20,30,0],['up',20,30,0]]);
for(const fn of listeners.get('blur')||[])fn();
assert.strictEqual(events.filter(e=>e[0]==='up').length,1,'cleanup is idempotent');

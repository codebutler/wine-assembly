#!/usr/bin/env node
'use strict';

// MOBILE-RIGHT-CLUSTER-OVERLAP-20261011: a fullscreen game (DirectDraw, GL)
// owns the display, so its picture was centred in the whole phone screen --
// and in portrait that put a 4:3 frame's foot (y~585 at 390x844) under a
// shooter's right touch column, whose top row starts at y~562 (Daikatana's and
// Kingpin's HUD). The exclusive fit now reserves the column's measured height
// in portrait only: no scale is lost on a tall phone, the picture just centres
// in the space above. Landscape (side rails), Fill (overlays by definition),
// chrome-only pills and desktop mode reserve nothing.

const assert = require('assert');
const { createCanvas } = require('../lib/canvas-compat');
const { Win98Renderer } = require('../lib/renderer');

const DPR = 3;
const renderer = new Win98Renderer(createCanvas(640, 480));
renderer.singleAppMode = true;
renderer.viewMode = 'fit';
renderer.presentationScaleMode = 'nearest';
renderer.presentationCanvas = { width: 390 * DPR, height: 844 * DPR };
const column = 282;  // measured: Weapon/Use top at 562 in a 844 CSS px page
let reserves = true;
renderer.touchOverlay = {
  reservesBand: () => reserves,
  getOccupiedFraction: () => column / 844,
};

const inset = renderer._exclusiveTouchInset();
assert.strictEqual(inset, column * DPR, 'portrait reserves the measured column');

const game = { hwnd: 7, x: 0, y: 0, w: 640, h: 480 };
const transform = renderer._computeExclusiveTransform(game);
const before = renderer._computeExclusivePresentationViewport(transform, true, 0, false);
const after = renderer._computeExclusivePresentationViewport(transform, true, inset, false);
const outH = 844 * DPR;
assert(before.dstY + before.dstH > outH - inset,
  'centred in the whole screen, the picture runs under the column (the bug)');
assert(after.dstY + after.dstH <= outH - inset,
  'with the inset the picture ends above the column');
assert.strictEqual(after.dstW, before.dstW, 'a 4:3 picture on a tall phone loses no scale');

renderer.touchOverlay.getOccupiedFraction = () => 0.6;
assert.strictEqual(renderer._exclusiveTouchInset(), Math.round(0.35 * outH),
  'a runaway measurement is capped like the single-app band');
renderer.touchOverlay.getOccupiedFraction = () => column / 844;

reserves = false;
assert.strictEqual(renderer._exclusiveTouchInset(), 0, 'chrome-only pills reserve nothing');
reserves = true;

renderer.viewMode = 'zoom';
assert.strictEqual(renderer._exclusiveTouchInset(), 0, 'Fill overlays the controls');
renderer.viewMode = 'fit';

renderer.presentationCanvas = { width: 844 * DPR, height: 390 * DPR };
assert.strictEqual(renderer._exclusiveTouchInset(), 0, 'landscape controls are side rails');
renderer.presentationCanvas = { width: 390 * DPR, height: 844 * DPR };

renderer.singleAppMode = false;
assert.strictEqual(renderer._exclusiveTouchInset(), 0, 'the desktop shell reserves nothing');

console.log('PASS exclusive fit reserves the portrait touch column, nothing elsewhere');

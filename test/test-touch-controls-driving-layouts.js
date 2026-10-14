#!/usr/bin/env node
'use strict';

// MOBILE-L2-DRIVE-20261011: the phone layouts of the driving games share
// need_for_speed's shape (drivingTouchControls in lib/apps.js): an 8-way pad
// (or, for a mouse-driven game, a mouse stick) at the bottom left, large Gas
// and Brake at the bottom right with the game's extras on the row above, and
// one-shot Esc/Enter at the top left. Each game's keys come from its own
// defaults, cited beside the layout; this test cannot check that a key is
// RIGHT, but it refuses layouts that are wrong for any driving game: no way
// to steer, no gas or brake, a button bound to nothing, a held menu key, a
// row too crowded for a 390 px portrait screen, a one-shot key a state-polling
// game could miss, or no way back to the menu.
// It also pins the three games whose keys are not the arrows.

const assert = require('assert');
const { APPS } = require('../lib/apps');

const DRIVE_IDS = [
  'carmageddon_tdr2000_demo', 'carmageddon2_demo', 'cmr2_demo', 'colin_mcrae_rally_demo',
  'daytona_usa_deluxe_demo', 'dethkarz_demo', 'driver_demo', 'mcm',
  'midtown_madness_trial', 'monster_truck_madness2_trial', 're_volt_demo', 'rollcage_demo',
];

const isVk = v => Number.isInteger(v) && v > 0 && v < 0x100;
const keysOf = v => (Array.isArray(v) ? v : (v === undefined ? null : [v]));

for (const id of DRIVE_IDS) {
  const app = APPS[id];
  assert.ok(app, `${id} is registered`);
  const tc = app.touchControls;
  assert.ok(tc, `${id} has a touch layout`);
  assert.strictEqual(tc.screenAnchored, true, `${id}: controls anchor to the screen`);

  // Steering: a pad, or a mouse stick for a mouse-steered game.
  const pad = tc.dpad;
  assert.ok((pad && pad.pos === 'bl') || (tc.mouseJoystick && tc.mouseJoystick.pos === 'bl'),
    `${id}: steering sits at the bottom left`);
  if (pad) {
    assert.strictEqual(pad.ways, 8, `${id}: an 8-way pad (a diagonal steers and drives at once)`);
    for (const dir of ['up', 'down', 'left', 'right']) {
      const keys = pad.vks ? keysOf(pad.vks[dir]) : null;
      if (keys) keys.forEach(k => assert.ok(isVk(k), `${id}: pad ${dir} sends real keys`));
    }
    for (const dir of ['left', 'right']) {
      const keys = pad.vks ? keysOf(pad.vks[dir]) : null;
      assert.ok(!keys || keys.length > 0, `${id}: the pad steers ${dir}`);
    }
  }

  const buttons = tc.buttons || [];
  const rows = new Map();
  const labels = buttons.map(b => b.label);
  for (const b of buttons) {
    const label = `${id} "${b.label}"`;
    assert.ok(typeof b.label === 'string' && b.label.length > 0 && b.label.length <= 9, `${label}: a short label`);
    const mouse = Number.isInteger(b.mouseButton);
    assert.ok(mouse ? [0, 1, 2].includes(b.mouseButton) : isVk(b.vk), `${label}: bound to a key or mouse button`);
    if (b.pos === 'tl') {
      // Held, not one-shot: these games poll key state, and a down+up in one
      // tick can fall between two polls.
      assert.notStrictEqual(b.hold, false, `${label}: a top-left menu key is held while touched`);
      continue;
    }
    assert.strictEqual(b.pos, 'br', `${label}: driving buttons sit at the bottom right`);
    const row = b.row || 0;
    rows.set(row, (rows.get(row) || 0) + 1);
  }
  for (const [name, row] of [['Gas', 0], ['Brake', 0]]) {
    const b = buttons.find(x => x.label === name);
    assert.ok(b && (b.row || 0) === row && b.width >= 80, `${id}: a large ${name} on the bottom row`);
    if (!Number.isInteger(b.mouseButton)) assert.notStrictEqual(b.hold, false, `${id}: ${name} is held`);
  }
  assert.ok(labels.includes('Esc') && labels.includes('Enter'), `${id}: Esc and Enter reach the menus`);
  for (const [row, n] of rows) assert.ok(n <= 3, `${id}: row ${row} holds at most three buttons (390 px portrait)`);
}

// The games whose driving keys are not the arrows.
const vks = id => APPS[id].touchControls.dpad.vks;
assert.deepStrictEqual(vks('carmageddon2_demo'), { up: 0x68, down: 0x62, left: 0x64, right: 0x66 },
  'Carmageddon 2 steers on the numpad');
assert.deepStrictEqual(vks('daytona_usa_deluxe_demo'), { up: [], down: [] },
  'Daytona: Up/Down shift gears, so the pad only steers');
assert.strictEqual(APPS.daytona_usa_deluxe_demo.touchControls.buttons.find(b => b.label === 'Gas').vk, 0x58, 'Daytona: gas is X');
assert.deepStrictEqual(vks('driver_demo'), { up: [0x26, 0xDE], down: [0x28, 0xBF], left: [0x25, 0x5A], right: [0x27, 0x58] },
  "Driver: each direction holds its menu arrow and its driving key (', /, Z, X)");
const mm = APPS.midtown_madness_trial.touchControls;
assert.ok(mm.mouseJoystick && !mm.dpad, 'Midtown steers with the mouse, its default controller');
assert.deepStrictEqual(['Gas', 'Brake'].map(l => mm.buttons.find(b => b.label === l).mouseButton), [0, 2],
  'Midtown: throttle left button, brakes right button');

console.log(`PASS  ${DRIVE_IDS.length} driving-game phone layouts: steering, gas/brake, menu keys, game-specific keys`);

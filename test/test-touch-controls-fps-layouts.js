#!/usr/bin/env node
'use strict';

// MOBILE-L1-FPS-20261011: the phone layouts of the first-person, third-person
// and flight games share one shape (quake2_demo's): a held move pad at the
// bottom left, buttons at the bottom right with one wide primary action, Esc
// at the top left, and the virtual trackpad for looking. Each game's keys come
// from its own shipped defaults (tools/game-default-binds.js), so this test
// cannot check that a key is RIGHT -- the comment beside each layout cites the
// file -- but it refuses the layouts that are wrong for any game: a pad that
// does not send four keys, a button bound to nothing, a button that presses a
// key the pad already holds, a row too crowded for a 390 px portrait screen,
// no way back to the menu, or a look trackpad without relative mouse input.

const assert = require('assert');
const { APPS } = require('../lib/apps');

const FPS_IDS = [
  'hexen2_demo', 'kingpin_demo', 'sin_demo', 'heretic2_demo', 'daikatana_demo',
  'serious_sam_demo', 'quake3_demo', 'blood2_demo', 'unreal_special_demo', 'ut348_demo',
  'ut2003_demo', 'delta_force_demo', 'diehard_nakatomi_demo', 'avp_alien_demo',
  'avp_marine_demo', 'drakan_demo', 'anachronox_demo', 'morrowind', 'descent3_demo',
  'forsaken_demo', 'outwars_trial', 'die_by_the_sword_demo', 'asghan_demo',
  'crusaders_mm_demo', 'hellbender_trial', 'freespace_demo', 'sof_demo',
];

const isVk = v => Number.isInteger(v) && v > 0 && v < 0x100;
let checked = 0;
const missing = [];

for (const id of FPS_IDS) {
  const app = APPS[id];
  assert.ok(app, `${id} is registered`);
  const tc = app.touchControls;
  if (!tc) { missing.push(id); continue; }
  checked++;
  assert.strictEqual(app.mobileTouch, 'trackpad', `${id}: looking is the virtual trackpad`);
  if (tc.aimOnly) assert.strictEqual(tc.cursor, false, `${id}: an aim-only layout hides the pointer`);

  const pad = tc.dpad;
  assert.ok(pad && pad.pos === 'bl', `${id}: move pad at the bottom left`);
  assert.strictEqual(pad.hold, true, `${id}: the move pad holds its keys`);
  const padVks = ['up', 'down', 'left', 'right'].map(k => pad.vks && pad.vks[k]);
  padVks.forEach((vk, i) => assert.ok(isVk(vk), `${id}: pad direction ${i} sends a key`));
  assert.strictEqual(new Set(padVks).size, 4, `${id}: four distinct pad keys`);

  const buttons = tc.buttons || [];
  const rows = new Map();
  let wide = 0, esc = 0;
  for (const b of buttons) {
    const label = `${id} "${b.label}"`;
    assert.ok(typeof b.label === 'string' && b.label.length > 0 && b.label.length <= 7,
      `${label}: a short label`);
    const mouse = Number.isInteger(b.mouseButton);
    assert.ok(mouse ? [0, 1, 2].includes(b.mouseButton) : isVk(b.vk), `${label}: bound to a key or mouse button`);
    if (!mouse) assert.ok(!padVks.includes(b.vk), `${label}: does not press a key the pad holds`);
    if (b.vk === 0x1B) {
      esc++;
      assert.strictEqual(b.pos, 'tl', `${label}: Esc sits at the top left`);
      continue;
    }
    // A one-shot menu key (FreeSpace's and Descent 3's F2 options) may join
    // Esc at the top left, away from the thumbs.
    if (b.pos === 'tl') {
      assert.strictEqual(b.hold, false, `${label}: a top-left key is a one-shot`);
      continue;
    }
    assert.strictEqual(b.pos, 'br', `${label}: action buttons sit at the bottom right`);
    const row = b.row || 0;
    rows.set(row, (rows.get(row) || 0) + (b.width >= 152 ? 2 : 1));
    if (b.width >= 152) wide++;
  }
  assert.strictEqual(esc, 1, `${id}: one Esc button reaches the menu`);
  assert.strictEqual(wide, 1, `${id}: one wide primary action`);
  for (const [row, units] of rows) {
    assert.ok(units <= 2, `${id}: row ${row} holds at most two buttons (390 px portrait)`);
  }
  assert.ok(rows.size <= 3, `${id}: at most three button rows`);
}

assert.ok(checked > 0, 'at least one FPS layout is registered');
console.log(`PASS ${checked} FPS-lane touch layouts${missing.length ? `; still without one: ${missing.join(', ')}` : ''}`);

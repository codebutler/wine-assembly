#!/usr/bin/env node
'use strict';

// Pawn 3 asks DirectInput for IID_IDirectInputDevice7A and has no fallback if
// it is refused: CreateDeviceEx failing made it put up "This program requires
// DirectX 9 or later!" and quit, which is a misleading message -- its D3D9
// probe (three GetAdapterModeCount calls summed) passes. This drives a real
// move to prove the v7 face is complete rather than merely accepted: a v2
// vtable handed out under a v7 identity would put slots 27/28 on whatever
// interface's thunks follow ours.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { PNG } = require('pngjs');

const root = path.resolve(__dirname, '..');
const exe = path.join(root, 'binaries/wep32-community/Pawn/Pawn.exe');
if (!fs.existsSync(exe)) {
  console.log('SKIP Pawn is not present');
  process.exit(0);
}

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'pawn-dinput7-'));
const shot = path.join(temp, 'after-move.png');

// The board is the 352x352 client area of the "Pawn 3" window at 350,100, so
// a square is 44px and its centre is screen (350 + 44*file + 22, 123 + 44*rank
// + 22). Pawn 3 moves on a drag, not on two clicks: a press and release with
// no motion between them selects nothing. This drags the e-pawn up two ranks.
const input = [
  '800:mousemove:552:409',
  '1000:mousedown:552:409',
  '1200:mousemove:552:365',
  '1400:mousemove:552:321',
  '1600:mouseup:552:321',
  // Move the cursor off the board so a hover highlight cannot be mistaken for
  // the engine's move highlight below.
  '1800:mousemove:900:600',
].join(',');

const run = spawnSync(process.execPath, [
  'test/run.js',
  '--app=pawn',
  '--no-build',
  // Pawn creates a D3D9 device; without a GL provider that fails with
  // "D3D9 requires a GPU window" and the guest later traps.
  '--headless-gl',
  '--screen=1024x768',
  '--max-batches=9000',
  '--max-seconds=90',
  '--quiet-api',
  '--no-close',
  `--input=${input}`,
  `--png=${shot}`,
], { cwd: root, encoding: 'utf8', timeout: 150000, maxBuffer: 16 * 1024 * 1024 });

const output = `${run.stdout || ''}\n${run.stderr || ''}`;
assert.strictEqual(run.error, undefined, run.error && run.error.message);
assert.strictEqual(run.status, 0, output.slice(-4000));
assert(!output.includes('requires DirectX 9'),
  `Pawn still refuses to start:\n${output.slice(-4000)}`);
assert(!output.includes('D3D9 requires a GPU window'), output.slice(-4000));
assert(!output.includes('*** CRASH'), output.slice(-4000));
assert(!output.includes('UNIMPLEMENTED API'), output.slice(-4000));
assert(fs.existsSync(shot), `no frame was captured\n${output.slice(-4000)}`);

const png = PNG.sync.read(fs.readFileSync(shot));
const count = (x0, y0, x1, y1, predicate) => {
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * png.width + x) * 4;
      if (predicate(png.data[i], png.data[i + 1], png.data[i + 2])) n++;
    }
  }
  return n;
};

// The board itself: white pieces, black pieces, and wood squares between them.
const whitePieces = count(0, 0, 352, 352, (r, g, b) => r > 200 && g > 200 && b > 180);
const blackPieces = count(0, 0, 352, 352, (r, g, b) => r < 60 && g < 60 && b < 40);
const wood = count(0, 0, 352, 352, (r, g, b) => r > 90 && r > b * 1.4 && g > b);
assert(whitePieces > 2000, `white pieces are missing (${whitePieces} px)`);
assert(blackPieces > 2000, `black pieces are missing (${blackPieces} px)`);
assert(wood > 60000, `the board is missing (${wood} px)`);

// Pawn 3 outlines the engine's own last move in yellow. Those pixels exist
// only after our drag was accepted as a legal move AND the engine replied, so
// this one predicate covers the whole round trip -- input routing, the v7
// device, and the engine actually running.
const highlight = count(0, 0, 352, 352, (r, g, b) => r > 180 && g > 180 && b < 100);
assert(highlight > 100,
  `the engine did not answer the move (${highlight} highlight px)\n${output.slice(-2000)}`);

console.log(`PASS Pawn creates its IDirectInputDevice7 and plays a move ` +
  `(${whitePieces} white, ${blackPieces} black, ${highlight} highlight px)`);

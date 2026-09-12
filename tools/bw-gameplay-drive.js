#!/usr/bin/env node
'use strict';
// Drive Black & White 2 from its intro to in-game, unattended.
//
// The probe (tools/black-white-software-probe.js) samples a live run and
// relays control commands, but somebody still has to press the four things
// that separate the intro from a loaded level: Return to accept the default
// profile, New Game, then Continue. Those presses took an agent hours of
// polling to place by hand, and the run they were placed in is terminal the
// moment it traps — so the sequence belongs in a file, not in a session.
//
// This is a state machine over the probe's own NDJSON samples:
//
//   wait for intro.finishFrame to stop advancing  ->  Return down/up
//   ->  move to 0,0 then to the New Game hotspot, press, release
//   ->  move to the Continue hotspot, press, release
//   ->  keep sampling while the level loads, capturing frames
//
// Every press is a separate down and up with a gap between them, because a
// same-batch click is invisible to a per-frame button sampler, and every
// press is released before the next phase: a held button changes what the
// next screen does with the pointer.
//
// The pointer is moved to 0,0 first on purpose. The game reads relative
// mouse motion, so its internal cursor starts wherever the emulator's last
// absolute position left it; one move to the origin gives the deltas a known
// starting point, and the second move lands on the target.
//
// Usage:
//   node tools/bw-gameplay-drive.js --wasm=/path/to/wine.wasm [--seconds=9000]
//     [--out=DIR] [--game=DIR] [--new-game=X,Y] [--continue=X,Y]
//
// Exit status is the probe's: a nonzero one is the guest trapping, and the
// probe's run.log names where. Artifacts (frames, run.log, samples.ndjson)
// are in the directory the probe prints on its first line.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const arg = (name, fallback) =>
  args.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;

const wasm = arg('wasm', null);
if (!wasm) throw Error('--wasm=PATH is required: freeze the artifact under test');
const seconds = Number(arg('seconds', '9000'));
if (!Number.isFinite(seconds) || seconds < 60 || seconds > 14400) {
  throw Error('seconds must be 60..14400');
}
const point = (name, fallback) => {
  const [x, y] = String(arg(name, fallback)).split(',').map(Number);
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw Error(`--${name} needs X,Y`);
  return { x, y };
};
// Measured on a 1280x960 software run at the default CLI window size.
const NEW_GAME = point('new-game', '156,446');
const CONTINUE = point('continue', '321,451');
const out = path.resolve(arg('out', fs.mkdtempSync(path.join(require('os').tmpdir(), 'bw-drive-'))));
fs.mkdirSync(out, { recursive: true });
const root = path.resolve(__dirname, '..');

const transcript = fs.createWriteStream(path.join(out, 'drive.log'));
const say = line => {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  transcript.write(stamped + '\n');
};

const probe = spawn(process.execPath, [
  'tools/black-white-software-probe.js',
  `--seconds=${seconds}`,
  '--max-batches=1000000000',
  '--capture-every=120',
  '--control-stdin',
  '--allocation-probe',
  `--wasm=${path.resolve(wasm)}`,
  ...(arg('game', null) ? [`--game=${arg('game')}`] : []),
], { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });

let seq = 0;
const pending = new Map();
let probeArtifacts = null;
let ended = false;
let lastSample = null;

probe.stderr.on('data', data => transcript.write(data));
readline.createInterface({ input: probe.stdout }).on('line', line => {
  transcript.write(line + '\n');
  if (line.startsWith('Artifacts:')) {
    probeArtifacts = line.split(/\s+/)[1];
    say(`probe artifacts: ${probeArtifacts}`);
    return;
  }
  if (line.startsWith('[ctl] ')) {
    let reply;
    try { reply = JSON.parse(line.slice(6)); } catch (_) { return; }
    const waiter = pending.get(reply.id);
    if (!waiter) return;
    pending.delete(reply.id);
    reply.ok ? waiter.resolve(reply.value) : waiter.reject(Error(reply.error));
    return;
  }
  if (line.startsWith('{')) {
    try { lastSample = JSON.parse(line); } catch (_) { /* not a sample */ }
  }
});

const exited = new Promise(resolve => {
  probe.on('exit', (code, signal) => {
    ended = true;
    for (const waiter of pending.values()) waiter.reject(Error(`probe exited ${code}/${signal}`));
    pending.clear();
    resolve({ code, signal });
  });
});

const send = (action, fields = {}) => new Promise((resolve, reject) => {
  if (ended) { reject(Error('probe already exited')); return; }
  const id = ++seq;
  pending.set(id, { resolve, reject });
  probe.stdin.write(JSON.stringify({ id, action, ...fields }) + '\n');
});
const input = cmd => send('input', { cmd });
const png = name => send('png', { path: path.join(out, name) })
  .then(() => say(`captured ${name}`), error => say(`capture ${name} failed: ${error.message}`));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Wait for a predicate over the probe's samples, or give up. Returns the
// sample that satisfied it, or null on timeout — a timeout is reported and
// the drive continues, because a missed cue is still worth a screenshot.
async function waitFor(what, predicate, timeoutSeconds) {
  const deadline = Date.now() + timeoutSeconds * 1000;
  say(`waiting for ${what} (up to ${timeoutSeconds}s)`);
  while (Date.now() < deadline && !ended) {
    if (lastSample && predicate(lastSample)) {
      say(`${what}: reached at ${Math.round(lastSample.seconds)}s`);
      return lastSample;
    }
    await sleep(2000);
  }
  say(`${what}: NOT reached (${ended ? 'probe exited' : 'timed out'})`);
  return null;
}

async function press(x, y, label) {
  await input(`mousemove:0:0`);
  await sleep(8000);
  await input(`mousemove:${x}:${y}`);
  await sleep(20000);
  await png(`${label}-before-press.png`);
  await input(`mousedown:${x}:${y}`);
  await sleep(12000);
  await input(`mouseup:${x}:${y}`);
  say(`${label}: pressed and released at ${x},${y}`);
}

(async () => {
  await send('ping');
  say('probe attached');

  // The intro's own frame counter is the cue. It stops at 1787 with
  // finishFrame one behind it; treat "finishFrame has caught up and stopped
  // moving" as the end rather than pinning the exact number.
  let stable = 0;
  let previous = -1;
  const introDone = await waitFor('intro end', sample => {
    const frame = sample.intro && sample.intro.frame;
    if (!frame) return false;
    stable = frame === previous ? stable + 1 : 0;
    previous = frame;
    return frame >= 1700 && stable >= 6;
  }, Math.min(seconds - 600, 5400));
  await png('01-intro-end.png');
  if (!introDone) say('proceeding anyway: the profile prompt may already be up');

  await sleep(20000);
  await input('keydown:13');
  await sleep(12000);
  await input('keyup:13');
  say('profile: Return pressed and released');
  await sleep(90000);
  await png('02-profile-accepted.png');

  await press(NEW_GAME.x, NEW_GAME.y, '03-new-game');
  await sleep(150000);
  await png('04-tutorial.png');

  await press(CONTINUE.x, CONTINUE.y, '05-continue');
  say('continue pressed — this is where the 10878976-byte commit happens');

  // Loading. Capture periodically: the interesting outcomes are a level that
  // appears, a screen that never changes, and a process that exits.
  for (let i = 1; i <= 10 && !ended; i++) {
    await sleep(60000);
    await png(`06-loading-${String(i).padStart(2, '0')}.png`);
    if (lastSample) {
      say(`loading +${i}min: eip=0x${(lastSample.eip >>> 0).toString(16)} ` +
        `failed=${lastSample.probe.failed} lastError=${lastSample.probe.lastError}`);
    }
  }
  if (!ended) {
    await png('07-final.png');
    say('drive complete, quitting the probe');
    await send('quit').catch(() => {});
  }
})().catch(error => {
  say(`drive error: ${error && error.message || error}`);
}).finally(async () => {
  const result = await exited;
  say(`probe exited code=${result.code} signal=${result.signal}`);
  say(`artifacts: ${out}${probeArtifacts ? ` and ${probeArtifacts}` : ''}`);
  transcript.end();
  process.exitCode = result.code === 0 ? 0 : 1;
});

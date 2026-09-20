#!/usr/bin/env node
// Blobby Volley over the virtual LAN: two real volley.exe processes, one
// hosting and one joining, with DirectPlay carried by the dpl/1 frames of
// src/09d4-dplay-net.wat across one ProcessHub segment.
//
// test-blobby-network.js drives each branch of the lobby alone. This is the
// match itself: the host opens a session and waits, the guest finds it by
// broadcast, joins, and both sides start exchanging game records.
//
// The evidence is on the wire (--trace-net) and in the host's reaction to it:
//   host  T1 parked at 0x44b5de        it is in its "waiting for a guest" loop
//                                      (the return from its Sleep(100))
//   host  -> ENUM_REPLY, JOIN_ACK      it answered the search and the join
//   host  -> DATA                      its wait loop saw DPSYS_CREATEPLAYER for
//                                      the guest and started the match: game
//                                      records are only sent from the game loop
//   both  <- DATA                      game records arrived in each direction
//
// Deliberately NOT --trace-api for everything: in a match the game paces its
// frames with a GetTickCount spin, and tracing every call of it turns one
// batch into minutes of formatting, which reads exactly like a hung peer.
//
// Menus are keyboard-driven for the reason test-blobby-network.js gives.

'use strict';

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { ProcessHub } = require('../lib/vlan-wire');
const { colorBox } = require('../tools/png-color-box');

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'packages', 'freeware', 'blobby-volley', 'volley.exe');
const OUT = path.join(ROOT, 'build', 'blobby-vlan');

if (!fs.existsSync(EXE)) {
  console.log('SKIP  volley.exe not found at', EXE);
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

const DOWN = 40, UP = 38, ENTER = 13, LEFT = 37, RIGHT = 39;
const key = (batch, vk) => [`${batch}:keydown:${vk}`, `${batch + 10}:keyup:${vk}`];

// Finding the host's player in a screenshot. Player one is a flat saturated
// red that nothing else on the beach comes near -- the one other red in the
// picture is the score, which is why the band starts below it rather than at
// the top of the window. It is deliberately not tied to the court's own
// coordinates: the CLI renders 640x480 and the browser 800x600, and a band
// measured off one is nowhere near the players in the other.
// The guest is player two, the right-hand green blob, and in a NETWORK game
// it is driven by the arrow keys, not the mouse: Instructions.txt 3.2.2 says
// the client "always gets the keys you specified for player two", so the
// mouse that moves player two in a local game does nothing here -- measured,
// the commands arrive and the blob ignores them. Holding RIGHT takes green
// from x=479 to x=626 and leaves red at 159.
// Green is also the colour of every palm tree, so the band is the strip the
// players stand in rather than the whole picture; the CLI renders 640x480 and
// the blob sits at y 329..399 at rest.
const GREEN = [30, 210, 30];
const COURT = [0, 322, 4096, 140];
// The blob crosses its own width in a second of held key, so a real move is
// far larger than this; the two screens should agree to within a blob's edge.
const MOVED_PX = 25;
const AGREE_PX = 12;
const fmt = v => (v === null ? 'gone' : v.toFixed(1));

// Main menu -> NETZWERKSPIEL -> MULTIPLAYER-OPTIONEN, then the host or guest
// entry, then the third entry of its settings screen (SPIEL BEGINNEN! /
// SPIELE SUCHEN). The guest then takes the first session found.
const HOST_KEYS = [
  ...key(460, DOWN), ...key(520, ENTER),
  ...key(620, ENTER),
  ...key(700, DOWN), ...key(720, DOWN), ...key(760, ENTER),
];
const GUEST_KEYS = [
  ...key(460, DOWN), ...key(520, ENTER),
  ...key(600, DOWN), ...key(620, ENTER),
  ...key(700, DOWN), ...key(720, DOWN), ...key(760, ENTER),
  ...key(1000, UP), ...key(1040, ENTER),
];

const WINDOW_BYTES = 64 * 1024;

// Extra run.js flags for one side, for probing without editing the file.
const extra = v => (v ? v.split(' ').filter(Boolean) : []);
const SIDE_ARGS = {
  host: extra(process.env.BLOBBY_HOST_ARGS),
  guest: extra(process.env.BLOBBY_GUEST_ARGS),
};

// Neither side has a batch count that means anything to the other: a host
// waiting in Sleep(100) retires batches far faster than a guest booting, and
// ran out of them before the guest ever searched. So both run on the wall
// clock and are stopped over the control channel once the checks are in.
function spawn(name, ip, input, watch) {
  const args = [
    `--exe=${EXE}`,
    '--vlan-wire',
    `--vlan-ip=${ip}`,
    '--trace-net',
    // The one line that names the guest thread's EIP without tracing its calls.
    '--trace-sched=20',
    '--quiet-api',
    '--batch-size=200000',
    '--max-batches=100000000',
    '--max-seconds=300',
    '--control-stdin',
    '--no-close',
    `--input=${input.join(',')}`,
    ...SIDE_ARGS[name],
  ];
  console.log(`$ node test/run.js ${args.map(a => a.replace(ROOT, '.')).join(' ')}`);
  const child = fork(path.join(ROOT, 'test', 'run.js'), args,
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
  const fd = fs.openSync(path.join(OUT, `${name}.log`), 'w');
  const state = {
    name, child, window: '', exited: false, hits: new Set(), watch,
    tail: () => state.window.split('\n').slice(-25).join('\n'),
  };
  const collect = d => {
    fs.writeSync(fd, d);
    state.window = (state.window + d.toString()).slice(-WINDOW_BYTES);
    for (const [k, re] of Object.entries(watch)) {
      if (!state.hits.has(k) && re.test(state.window)) state.hits.add(k);
    }
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('exit', () => { state.exited = true; });
  return state;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(state, k, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.hits.has(k)) return true;
    if (state.exited) return false;
    await sleep(100);
  }
  return false;
}
const waitExit = s => new Promise(r => (s.exited ? r() : s.child.on('exit', r)));
const control = (s, cmd) => { if (!s.exited) s.child.stdin.write(JSON.stringify(cmd) + '\n'); };

let failures = 0;
function check(what, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}`);
  if (!ok) failures++;
}

async function main() {
  const hub = new ProcessHub();
  const host = spawn('host', '10.0.0.1', HOST_KEYS, {
    waiting: /\[sched\].*T1:\w+@0x44b5de/,
    enumReply: /\[net\] -> dpl ENUM_REPLY/,
    joinAck: /\[net\] -> dpl JOIN_ACK/,
    sent: /\[net\] -> dpl DATA/,
    data: /\[net\] <- dpl DATA/,
    exited: /T1 .*state=exited/,
  });
  hub.add(host.child);

  let guest = null;
  try {
    const opened = await waitFor(host, 'waiting', 180000);
    check('host opened a session and waits for a guest', opened);
    if (!opened) throw new Error(`host never opened\n${host.tail()}`);

    guest = spawn('guest', '10.0.0.2', GUEST_KEYS, {
      enumReq: /\[net\] -> dpl ENUM_REQ/,
      joinReq: /\[net\] -> dpl JOIN_REQ/,
      playerAdd: /\[net\] <- dpl PLAYER_ADD/,
      data: /\[net\] <- dpl DATA/,
      exited: /T1 .*state=exited/,
    });
    hub.add(guest.child);

    check('guest broadcast a session search', await waitFor(guest, 'enumReq', 180000));
    check('host answered the search', await waitFor(host, 'enumReply', 60000));
    check('guest asked to join the session', await waitFor(guest, 'joinReq', 120000));
    check('host admitted the guest', await waitFor(host, 'joinAck', 60000));
    check('guest learned the host player', await waitFor(guest, 'playerAdd', 60000));
    check('host saw the guest arrive and started the match',
      await waitFor(host, 'sent', 120000));
    check('guest receives game data from the host', await waitFor(guest, 'data', 120000));
    check('host receives game data from the guest', await waitFor(host, 'data', 120000));

    // ---- the match itself ------------------------------------------------
    //
    // Everything above is the wire: frames crossed, in both directions. That
    // is not yet a game. Player two is the guest's own blob and nothing else
    // moves it, so hold a key on the guest and photograph BOTH machines: the
    // host never saw that key, and can only know where the blob went from the
    // records the guest sent it. A green blob that ends up in the same new
    // place on the host's screen is one match being played across the wire,
    // rather than two programs each running their own.
    //
    // The captures are taken with the key still held, once the blob has run
    // out of court: released, it drifts back towards its serve position and
    // the two machines are then photographed mid-drift, milliseconds apart,
    // which is a disagreement about time rather than about the game. Held
    // against a wall, both screens are showing the same settled position.
    await sleep(15000);
    const shoot = async (tag) => {
      for (const s of [host, guest]) {
        control(s, { action: 'png', path: path.join(OUT, `${s.name}-${tag}.png`) });
      }
      await sleep(4000);
      const read = s => colorBox(path.join(OUT, `${s.name}-${tag}.png`),
        { color: GREEN, tol: 70, rect: COURT });
      return { host: read(host), guest: read(guest) };
    };

    // Two moves, because one is not evidence: a blob that happens to drift
    // the right way once proves nothing, and the second move is back.
    const hold = async (vk, tag) => {
      control(guest, { cmd: `keydown:${vk}` });
      await sleep(4000);
      const shot = await shoot(tag);
      control(guest, { cmd: `keyup:${vk}` });
      await sleep(2000);
      return shot;
    };
    const before = await shoot('before');
    const right = await hold(RIGHT, 'right');
    const after = await hold(LEFT, 'left');

    const moved = (a, b) => (a.cx === null || b.cx === null) ? null : b.cx - a.cx;
    const dHost = moved(before.host, right.host);
    const dGuest = moved(before.guest, right.guest);
    console.log(`  green blob x: host ${fmt(before.host.cx)} -> ${fmt(right.host.cx)}`
      + ` -> ${fmt(after.host.cx)}   guest ${fmt(before.guest.cx)} -> `
      + `${fmt(right.guest.cx)} -> ${fmt(after.guest.cx)}`);
    check('the guest moved its own player', dGuest !== null && dGuest > MOVED_PX);
    check('the host saw the guest\'s player move the same way',
      dHost !== null && dHost > MOVED_PX);
    check('and saw it come back',
      moved(right.host, after.host) !== null && moved(right.host, after.host) < -MOVED_PX);
    check('both screens agree where that player ended up',
      after.host.cx !== null && after.guest.cx !== null
        && Math.abs(after.host.cx - after.guest.cx) < AGREE_PX);

    for (const s of [host, guest]) {
      control(s, { action: 'png', path: path.join(OUT, `${s.name}.png`) });
      control(s, { action: 'quit' });
    }
    await Promise.race([Promise.all([waitExit(host), waitExit(guest)]), sleep(60000)]);
    check('no unimplemented API', !/UNIMPLEMENTED API:/.test(host.window + guest.window));
    check('game threads survived', !host.hits.has('exited') && !guest.hits.has('exited'));
  } catch (e) {
    console.log(String(e && e.stack || e));
    failures++;
  } finally {
    for (const s of [host, guest]) if (s && !s.exited) s.child.kill('SIGKILL');
  }
  console.log(`\nlogs and captures in ${path.relative(ROOT, OUT)}/`);
  console.log(failures ? `test-blobby-vlan: ${failures} FAILED` : 'test-blobby-vlan: all checks passed');
  process.exit(failures ? 1 : 0);
}

main();

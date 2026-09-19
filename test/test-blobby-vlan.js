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

const ROOT = path.join(__dirname, '..');
const EXE = path.join(ROOT, 'packages', 'freeware', 'blobby-volley', 'volley.exe');
const OUT = path.join(ROOT, 'build', 'blobby-vlan');

if (!fs.existsSync(EXE)) {
  console.log('SKIP  volley.exe not found at', EXE);
  process.exit(0);
}
fs.mkdirSync(OUT, { recursive: true });

const DOWN = 40, UP = 38, ENTER = 13;
const key = (batch, vk) => [`${batch}:keydown:${vk}`, `${batch + 10}:keyup:${vk}`];

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
  const host = spawn('host', '10.77.0.1', HOST_KEYS, {
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

    guest = spawn('guest', '10.77.0.2', GUEST_KEYS, {
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

    // A moment of play on both screens, then the pictures and a clean stop.
    await sleep(15000);
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

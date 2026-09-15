#!/usr/bin/env node
// Authentic UT2003 demo listen server + direct-connect client on one vln/1
// segment. This remains a candidate gate until both sides reach gameplay.

'use strict';

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const { ProcessHub } = require('../lib/vlan-wire');

const ROOT = path.join(__dirname, '..');
const SERVER_IP = '10.77.0.1';
const CLIENT_IP = '10.77.0.2';
const TMP = process.env.TMPDIR || '/private/tmp';
const WINDOW_BYTES = 128 * 1024;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const GUEST_LOGS = `(() => [...ctx.vfs.files]
  .filter(([name]) => /\\.log$/i.test(name))
  .map(([name, entry]) => ({ name, tail: Buffer.from(entry.data).toString('latin1').slice(-16000) })))()`;

function spawn(name, args, watch) {
  const child = fork(path.join(ROOT, 'test', 'run.js'), args,
    { cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe', 'ipc'] });
  const logPath = path.join(TMP, `ut2003-vlan-${name}.log`);
  const fd = fs.openSync(logPath, 'w');
  const state = { name, child, watch, hits: new Set(), window: '', exited: false, logPath };
  const collect = chunk => {
    fs.writeSync(fd, chunk);
    state.window = (state.window + chunk.toString()).slice(-WINDOW_BYTES);
    for (const re of watch) if (!state.hits.has(re) && re.test(state.window)) state.hits.add(re);
  };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('exit', () => { state.exited = true; fs.closeSync(fd); });
  return state;
}

async function waitFor(state, re, what, timeoutMs = 300000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.hits.has(re)) return;
    if (state.exited) throw new Error(`${state.name} exited before ${what}; log: ${state.logPath}`);
    await sleep(250);
  }
  throw new Error(`timed out waiting for ${what}; log: ${state.logPath}`);
}

async function waitForGuestLog(state, re, what, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.hits.has(re)) return;
    if (state.exited) throw new Error(`${state.name} exited before ${what}; log: ${state.logPath}`);
    state.child.stdin.write(`${JSON.stringify({ action: 'eval', code: GUEST_LOGS })}\n`);
    await sleep(2000);
  }
  throw new Error(`timed out waiting for ${what}; log: ${state.logPath}`);
}

const common = (ip, maxSeconds) => [
  '--app=ut2003_demo', '--vlan-wire', `--vlan-ip=${ip}`,
  '--headless-gl', '--quiet-api', '--quiet-blocks', '--trace-net',
  '--control-stdin', '--vlan-max-waits=100000000',
  '--tick-ms-per-batch=5', '--batch-size=20000',
  '--max-batches=100000000', `--max-seconds=${maxSeconds}`,
];

function requestDiagnostics(state) {
  if (!state || state.exited) return;
  state.child.stdin.write(`${JSON.stringify({ action: 'eval', code: GUEST_LOGS })}\n`);
  state.child.stdin.write(`${JSON.stringify({
    action: 'png', path: path.join(TMP, `ut2003-vlan-${state.name}.png`),
  })}\n`);
}

async function main() {
  const serverReady = /\[SetWindowText\] "Antalus: DM-Antalus \(\d+ players\)"/;
  const serverReceive = /arrived DGRAM 10\.77\.0\.2:/;
  const clientSend = /\[net\] -> type6 10\.77\.0\.2:\d+ -> 10\.77\.0\.1:7777 len=46/;
  // A network client deliberately retains the generic UT2003 window caption.
  // The guest log's player handoff is the stable point at which it owns a
  // viewport in the replicated Antalus level; the screenshot then proves the
  // D3D scene and join prompt are actually visible.
  const clientGameplay = /xPlayer setplayer WindowsViewport/;
  const server = spawn('server', [
    ...common(SERVER_IP, 700),
    '--args=DM-Antalus?game=XGame.XDeathmatch?listen -d3d -window -nosound',
  ], [serverReady, serverReceive]);
  const hub = new ProcessHub();
  hub.add(server.child);
  let client;
  try {
    await waitFor(server, serverReady, 'the listen server to enter Antalus gameplay');
    console.log('ok  UT2003 listen server entered Antalus gameplay');
    client = spawn('client', [
      ...common(CLIENT_IP, 480),
      '--args=10.77.0.1 -d3d -window -nosound',
    ], [clientSend, clientGameplay]);
    hub.add(client.child);
    await waitFor(client, clientSend, 'the client to send a datagram');
    console.log('ok  UT2003 client sent its native UDP protocol datagram');
    await waitFor(server, serverReceive, 'the server to receive the client datagram');
    console.log('ok  UT2003 server received the client datagram across vln/1');
    await waitForGuestLog(client, clientGameplay, 'the client to enter Antalus gameplay');
    console.log('ok  UT2003 client entered Antalus gameplay');
    await sleep(10000);
    server.child.stdin.write(`${JSON.stringify({ action: 'png', path: path.join(TMP, 'ut2003-vlan-server.png') })}\n`);
    client.child.stdin.write(`${JSON.stringify({ action: 'png', path: path.join(TMP, 'ut2003-vlan-client.png') })}\n`);
    await sleep(3000);
    server.child.stdin.write(`${JSON.stringify({ action: 'quit' })}\n`);
    client.child.stdin.write(`${JSON.stringify({ action: 'quit' })}\n`);
    await sleep(1000);
  } catch (err) {
    requestDiagnostics(server);
    requestDiagnostics(client);
    await sleep(3000);
    throw err;
  } finally {
    for (const state of [client, server]) {
      if (state && !state.exited) state.child.kill('SIGTERM');
    }
  }
  console.log('test-ut2003-vlan-candidate: network client gameplay observed');
}

main().catch(err => { console.error(err.stack || err); process.exitCode = 1; });

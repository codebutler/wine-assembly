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

const common = ip => [
  '--app=ut2003_demo', '--vlan-wire', `--vlan-ip=${ip}`,
  '--headless-gl', '--quiet-api', '--quiet-blocks', '--trace-net',
  '--trace-api=WSAStartup,socket,setsockopt,getsockopt,getsockname,bind,ioctlsocket,sendto,recvfrom,select,WSAGetLastError,closesocket',
  '--control-stdin', '--vlan-max-waits=100000000',
  '--max-batches=100000000', '--max-seconds=280',
];

async function main() {
  const serverBind = /bind\(s=.*(?:name=&0\.0\.0\.0:|name=0x)/;
  const serverReceive = /arrived DGRAM 10\.77\.0\.2:/;
  const clientSend = /sendto\(0x[0-9a-f]+, .*0x0000002e,/;
  const server = spawn('server', [
    ...common(SERVER_IP),
    '--args=DM-Antalus?game=XGame.XDeathmatch?listen -d3d -window -nosound',
  ], [serverBind, serverReceive]);
  const hub = new ProcessHub();
  hub.add(server.child);
  let client;
  try {
    await waitFor(server, serverBind, 'the listen server to bind');
    console.log('ok  UT2003 listen server bound its room UDP socket');
    client = spawn('client', [
      ...common(CLIENT_IP),
      '--args=10.77.0.1 -d3d -window -nosound',
    ], [clientSend]);
    hub.add(client.child);
    await waitFor(client, clientSend, 'the client to send a datagram');
    console.log('ok  UT2003 client sent its native UDP protocol datagram');
    await waitFor(server, serverReceive, 'the server to receive the client datagram');
    console.log('ok  UT2003 server received the client datagram across vln/1');
    await sleep(30000);
    server.child.stdin.write(`${JSON.stringify({ action: 'png', path: path.join(TMP, 'ut2003-vlan-server.png') })}\n`);
    client.child.stdin.write(`${JSON.stringify({ action: 'png', path: path.join(TMP, 'ut2003-vlan-client.png') })}\n`);
    await sleep(3000);
    server.child.stdin.write(`${JSON.stringify({ action: 'quit' })}\n`);
    client.child.stdin.write(`${JSON.stringify({ action: 'quit' })}\n`);
    await sleep(1000);
  } finally {
    for (const state of [client, server]) {
      if (state && !state.exited) state.child.kill('SIGTERM');
    }
  }
  console.log('test-ut2003-vlan-candidate: transport handshake observed');
}

main().catch(err => { console.error(err.stack || err); process.exitCode = 1; });

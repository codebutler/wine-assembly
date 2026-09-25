#!/usr/bin/env node

// The optional uplink beyond the virtual LAN room (net_uplink_routes /
// net_uplink_resolve, see $vsock_addr_routable in src/09d-winsock.wat).
//
// Without an uplink the room is sealed: an outside address does not route
// and a name does not resolve. With one, the host answers for exactly the
// addresses it claims, and a connection to one of them is an ordinary vln/1
// stream on the same wire -- SYN out, SYNACK/DATA/FIN back -- which this test
// terminates with a scripted uplink instead of a real relay.

'use strict';

const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
const RegionMap = require('../lib/region-map.generated.js');

const AF_INET = 2;
const SOCK_STREAM = 1;
const INVALID_SOCKET = -1;
const SOCKET_ERROR = -1;
const FIONBIO = 0x8004667e | 0;
const WSAEWOULDBLOCK = 10035;
const WSAENETUNREACH = 10051;
const WSAHOST_NOT_FOUND = 11001;

const VLN_MAGIC = 0x314E4C56;
const VLN_HDR = 28;
const SYN = 1, SYNACK = 2, DATA = 3, FIN = 4;

const ROOM_IP = 0x0A000001;        // 10.0.0.1, this process
const OUTSIDE_IP = 0xC6336401;     // 198.51.100.1 (TEST-NET-2): the uplink's stand-in
const UNCLAIMED_IP = 0xCB007101;   // 203.0.113.1 (TEST-NET-3): claimed by nobody
const PORT = 23;

function frame(type, sip, sport, dip, dport, payload = []) {
  const f = new Uint8Array(VLN_HDR + payload.length);
  const v = new DataView(f.buffer);
  v.setUint32(0, VLN_MAGIC, true);
  v.setUint32(4, type, true);
  v.setUint32(8, sip >>> 0, true);
  v.setUint32(12, sport, true);
  v.setUint32(16, dip >>> 0, true);
  v.setUint32(20, dport, true);
  v.setUint32(24, payload.length, true);
  f.set(payload, VLN_HDR);
  return f;
}

function parse(f) {
  const v = new DataView(f.buffer, f.byteOffset, f.byteLength);
  return {
    magic: v.getUint32(0, true), type: v.getUint32(4, true),
    sip: v.getUint32(8, true), sport: v.getUint32(12, true),
    dip: v.getUint32(16, true), dport: v.getUint32(20, true),
    payload: Array.from(f.subarray(VLN_HDR)),
  };
}

// A wire whose far end is the test: frames the guest sends are recorded,
// frames the test injects are delivered in order.
function scriptedWire() {
  const inbound = [];
  const sent = [];
  return {
    sent, inbound,
    send(bytes) { sent.push(parse(bytes)); return true; },
    peek() { return inbound[0] || null; },
    commit() { inbound.shift(); },
  };
}

async function makeNode(wasm, ctxExtra) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = createHostImports({
    getMemory: () => memory.buffer, renderer: null, resourceJson: {}, ...ctxExtra,
  });
  Object.assign(imports.host, {
    memory,
    create_thread: () => 0, exit_thread: () => 0, terminate_thread: () => 0,
    create_event: () => 0, set_event: () => 0, reset_event: () => 0,
    wait_single: () => 0, wait_multiple: () => 0,
    com_create_instance: () => 0x80004002,
  });
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const wat = instance.exports;
  const imageBase = wat.get_image_base() >>> 0;
  const wa = ga => RegionMap.g2w(ga, imageBase);
  const bytes = () => new Uint8Array(memory.buffer);
  const alloc = n => { const p = wat.guest_alloc(n) >>> 0; assert(p, 'guest_alloc'); return p; };
  const cstr = s => {
    const p = alloc(s.length + 1);
    const b = bytes();
    for (let i = 0; i < s.length; i++) b[wa(p) + i] = s.charCodeAt(i);
    b[wa(p) + s.length] = 0;
    return p;
  };
  const sockaddr = (ip, port) => {
    const p = alloc(16);
    const v = new DataView(memory.buffer, wa(p), 16);
    v.setUint16(0, AF_INET, true);
    v.setUint16(2, port, false);
    v.setUint32(4, ip >>> 0, false);
    return p;
  };
  const nonblocking = s => {
    const p = alloc(4);
    new DataView(memory.buffer, wa(p), 4).setUint32(0, 1, true);
    assert.strictEqual(wat.test_call_ioctlsocket(s, FIONBIO, p) | 0, 0);
  };
  const hostentAddr = he => {
    const v = new DataView(memory.buffer);
    const list = v.getUint32(wa(he) + 12, true);
    const first = v.getUint32(wa(list), true);
    return v.getUint32(wa(first), false) >>> 0;
  };
  wat.test_vsock_reset();
  wat.set_vlan_local_ip(ROOM_IP);
  assert.strictEqual(wat.test_call_WSAStartup(0x0101, alloc(400)) | 0, 0);
  return { wat, memory, wa, bytes, alloc, cstr, sockaddr, nonblocking, hostentAddr };
}

async function main() {
  const wasm = compileSrcWasm();
  let passed = 0;
  const check = async (name, fn) => { await fn(); passed++; console.log(`PASS  ${name}`); };

  await check('without an uplink, outside addresses stay unroutable and names unresolved', async () => {
    const n = await makeNode(wasm, { vlanWire: scriptedWire() });
    assert.strictEqual(n.wat.test_call_gethostbyname(n.cstr('telnet.example')) | 0, 0);
    assert.strictEqual(n.wat.test_call_WSAGetLastError() | 0, WSAHOST_NOT_FOUND);
    const s = n.wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.notStrictEqual(s, INVALID_SOCKET);
    assert.strictEqual(n.wat.test_call_connect(s, n.sockaddr(OUTSIDE_IP, PORT), 16) | 0, SOCKET_ERROR);
    assert.strictEqual(n.wat.test_call_WSAGetLastError() | 0, WSAENETUNREACH);
  });

  await check('htonl is the 32-bit network byte swap', async () => {
    const n = await makeNode(wasm, {});
    assert.strictEqual(n.wat.test_call_htonl(0x0A000001) >>> 0, 0x0100000A);
    assert.strictEqual(n.wat.test_call_htonl(n.wat.test_call_htonl(0x12345678)) >>> 0, 0x12345678);
  });

  await check('an uplink resolves names and carries a stream to the addresses it claims', async () => {
    const wire = scriptedWire();
    const resolved = [];
    const uplink = {
      routes: ip => ip === OUTSIDE_IP,
      resolve: name => { resolved.push(name); return name === 'telnet.example' ? OUTSIDE_IP : 0; },
    };
    const n = await makeNode(wasm, { vlanWire: wire, netUplink: uplink });
    const { wat } = n;

    const he = wat.test_call_gethostbyname(n.cstr('telnet.example')) >>> 0;
    assert.notStrictEqual(he, 0, 'the uplink resolves the name');
    assert.deepStrictEqual(resolved, ['telnet.example']);
    assert.strictEqual(n.hostentAddr(he), OUTSIDE_IP);
    assert.strictEqual(wat.test_call_gethostbyname(n.cstr('nowhere.example')) | 0, 0);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAHOST_NOT_FOUND);

    // An address nobody claims is still refused.
    const other = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(wat.test_call_connect(other, n.sockaddr(UNCLAIMED_IP, PORT), 16) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAENETUNREACH);

    const s = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    n.nonblocking(s);
    assert.strictEqual(wat.test_call_connect(s, n.sockaddr(OUTSIDE_IP, PORT), 16) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAEWOULDBLOCK);
    const syn = wire.sent.find(f => f.type === SYN);
    assert(syn, 'connect emits a SYN on the wire');
    assert.strictEqual(syn.dip, OUTSIDE_IP);
    assert.strictEqual(syn.dport, PORT);
    assert.strictEqual(syn.sip, ROOM_IP);

    // The uplink accepts, then speaks first (a telnet banner).
    wire.inbound.push(frame(SYNACK, OUTSIDE_IP, PORT, syn.sip, syn.sport));
    wat.vlan_pump();
    assert.strictEqual(wat.test_call_connect(s, n.sockaddr(OUTSIDE_IP, PORT), 16) | 0, 0,
      'the outstanding connect completes');

    const out = [0x68, 0x69];           // "hi"
    const ob = n.alloc(out.length);
    n.bytes().set(out, n.wa(ob));
    assert.strictEqual(wat.test_call_send(s, ob, out.length, 0) | 0, out.length);
    const data = wire.sent.filter(f => f.type === DATA);
    assert.strictEqual(data.length, 1);
    assert.deepStrictEqual(data[0].payload, out);
    assert.strictEqual(data[0].dip, OUTSIDE_IP);

    const banner = Array.from(Buffer.from('login: '));
    wire.inbound.push(frame(DATA, OUTSIDE_IP, PORT, syn.sip, syn.sport, banner));
    wire.inbound.push(frame(FIN, OUTSIDE_IP, PORT, syn.sip, syn.sport));
    wat.vlan_pump();
    const rb = n.alloc(64);
    const got = wat.test_call_recv(s, rb, 64, 0) | 0;
    assert.strictEqual(got, banner.length);
    assert.deepStrictEqual(Array.from(n.bytes().subarray(n.wa(rb), n.wa(rb) + got)), banner);
    assert.strictEqual(wat.test_call_recv(s, rb, 64, 0) | 0, 0, 'FIN reads as end of stream');
    assert.strictEqual(wat.test_call_closesocket(s) | 0, 0);
  });

  console.log(`\n${passed}/${passed} uplink checks passed`);
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});

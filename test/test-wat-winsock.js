#!/usr/bin/env node

// Slice 1 gate for the virtual LAN socket core (docs/virtual-lan-party.md).
//
// A synthetic client and server exchange fragmented bidirectional byte
// streams through the public Winsock handlers, in both blocking and
// nonblocking modes, with no Liquid War binary involved. The point is that
// the switch behaves like TCP — partial I/O, EOF, reset, backlog limits —
// rather than that a particular game happens to work.

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { compileSrcWasm } = require('./compile-src');
// $GUEST_BASE, from the map declared in src/00-regions.wat.
const RegionMap = require('../lib/region-map.generated.js');

const AF_INET = 2;
const SOCK_STREAM = 1;
const SOCK_DGRAM = 2;
const INVALID_SOCKET = -1;
const SOCKET_ERROR = -1;
const FIONBIO = 0x8004667e | 0;
const FIONREAD = 0x4004667f | 0;
const SD_SEND = 1;

const WSAEWOULDBLOCK = 10035;
const WSAENOTSOCK = 10038;
const WSAEADDRINUSE = 10048;
const WSAEADDRNOTAVAIL = 10049;
const WSAENETUNREACH = 10051;
const WSAECONNRESET = 10054;
const WSAECONNREFUSED = 10061;
const WSAESOCKTNOSUPPORT = 10044;
const WSAEAFNOSUPPORT = 10047;
const WSAEINVAL = 10022;

const ROOM_HOST = '10.0.0.1';
const GAME_PORT = 8035;

async function main() {
  const root = path.join(__dirname, '..');
  const wasm = compileSrcWasm((file, source) => file === '13-exports.wat' ? source + String.raw`
    (func (export "test_raw_seed") (param $local i32) (param $remote i32) (param $type i32) (result i32)
      (local $i i32) (local $r i32)
      (local.set $i (call $vsock_alloc)) (local.set $r (call $vsock_rec (local.get $i)))
      (store.field VSock family (local.get $r) (i32.const 2))
      (store.field VSock type (local.get $r) (local.get $type))
      (store.field VSock proto (local.get $r) (i32.const 1))
      (store.field VSock local_ip (local.get $r) (local.get $local))
      (store.field VSock remote_ip (local.get $r) (local.get $remote))
      (local.get $i))
    (func (export "test_raw_ingress") (param $p i32) (param $n i32) (result i32)
      (call $vsock_raw_ingress (call $g2w (local.get $p)) (local.get $n)))
    (func (export "test_raw_ready") (param $i i32) (result i32) (call $vsock_read_ready (local.get $i)))
    (func (export "test_socket_attribute") (param $s i32) (result i32)
      (i32.and (load.field VSock flags (call $vsock_rec (call $vsock_index (local.get $s)))) (i32.const 64)))
    (func (export "test_raw_handle") (param $i i32) (result i32) (call $vsock_handle (local.get $i)))
    (func (export "test_call_getpeername") (param $s i32) (param $p i32) (param $n i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $handle_getpeername (local.get $s) (local.get $p) (local.get $n)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "test_raw_recv") (param $i i32) (param $p i32) (param $n i32)
        (param $from i32) (param $fromlen i32) (result i32)
      (call $vsock_recvfrom_core (call $vsock_handle (local.get $i))
        (local.get $p) (local.get $n) (local.get $from) (local.get $fromlen) (i32.const 28)))
    (func (export "test_raw_wrap") (param $i i32)
      (drop (call $vsock_alloc_ring (local.get $i)))
      (store.field VSock rx_head (call $vsock_rec (local.get $i)) (i32.const 65530)))
    (func (export "test_raw_take") (param $i i32) (param $p i32) (result i32)
      (local $n i32)
      (if (i32.eqz (load.field VSock rx_len (call $vsock_rec (local.get $i)))) (then (return (i32.const 0))))
      (local.set $n (i32.add (call $vsock_ring_get32 (local.get $i) (i32.const 0)) (i32.const 12)))
      (call $vsock_ring_read (local.get $i) (local.get $p) (local.get $n)))
    (func (export "test_icmp_reply") (param $src i32) (param $n i32) (param $dst i32) (param $cap i32) (param $id i32) (result i32)
      (call $vsock_icmp_echo_reply (call $g2w (local.get $src)) (local.get $n)
        (call $g2w (local.get $dst)) (local.get $cap) (local.get $id)))
    (func (export "test_checksum") (param $p i32) (param $n i32) (result i32)
      (call $vsock_inet_checksum (call $g2w (local.get $p)) (local.get $n)))
    (func (export "test_wsa_protocols") (param $wide i32) (param $f i32) (param $p i32) (param $n i32) (result i64)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $dispatch_api_table
        (if (result i32) (local.get $wide)
          (then (call $lookup_api_id "WSAEnumProtocolsW"))
          (else (call $lookup_api_id "WSAEnumProtocolsA")))
        (local.get $f) (local.get $p) (local.get $n) (i32.const 0) (i32.const 0) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsarecv") (param $s i32) (param $b i32) (param $c i32) (param $n i32) (param $f i32) (param $over i32) (result i64)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.const 0x00300018) (local.get $over))
      (call $gs32 (i32.const 0x0030001c) (i32.const 0))
      (global.set $yield_reason (i32.const 0))
      (call $dispatch_api_table (call $lookup_api_id "WSARecv")
        (local.get $s) (local.get $b) (local.get $c) (local.get $n) (local.get $f) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsarecvfrom") (param $s i32) (param $b i32) (param $c i32) (param $n i32) (param $f i32) (param $over i32) (param $from i32) (param $fromlen i32) (result i64)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.const 0x00300020) (local.get $over))
      (call $gs32 (i32.const 0x00300024) (i32.const 0))
      (call $gs32 (i32.const 0x00300018) (local.get $from))
      (call $gs32 (i32.const 0x0030001c) (local.get $fromlen))
      (global.set $yield_reason (i32.const 0))
      (call $dispatch_api_table (call $lookup_api_id "WSARecvFrom")
        (local.get $s) (local.get $b) (local.get $c) (local.get $n) (local.get $f) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_send_core_frame") (param $s i32) (param $p i32) (param $n i32) (param $frame i32) (result i64)
      (local $r i32)
      (global.set $yield_reason (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (i32.add (i32.const 0x300000) (local.get $frame)))
      (local.set $r (call $vsock_send_core (local.get $s) (local.get $p) (local.get $n) (local.get $frame)))
      (i64.or (i64.extend_i32_u (local.get $r))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsasend") (param $s i32) (param $b i32) (param $c i32) (param $n i32) (result i64)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $gs32 (i32.const 0x00300018) (i32.const 0))
      (call $gs32 (i32.const 0x0030001c) (i32.const 0))
      (global.set $yield_reason (i32.const 0))
      (call $dispatch_api_table (call $lookup_api_id "WSASend")
        (local.get $s) (local.get $b) (local.get $c) (local.get $n) (i32.const 0) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsasocket") (param $wide i32) (param $af i32) (param $type i32) (param $proto i32) (param $info i32) (param $group i32) (param $flags i32) (result i64)
      (global.set $yield_reason (i32.const 0))
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x300000))
      (call $gs32 (i32.const 0x300018) (local.get $flags))
      (call $dispatch_api_table (if (result i32) (local.get $wide) (then (call $lookup_api_id "WSASocketW")) (else (call $lookup_api_id "WSASocketA")))
        (local.get $af) (local.get $type) (local.get $proto) (local.get $info) (local.get $group) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsa_startup") (param $data i32) (result i32)
      (call $handle_WSAStartup (i32.const 0x0202) (local.get $data)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "test_wsa_cleanup") (result i32)
      (call $handle_WSACleanup (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    (func (export "test_wsa_is_blocking_lookup") (result i32)
      (call $lookup_api_id "WSAIsBlocking"))
    (func (export "test_wsaconnect") (param $sp i32) (param $s i32) (param $addr i32)
      (param $caller i32) (param $callee i32) (param $sqos i32) (param $gqos i32) (result i64)
      (i32.store offset=16 (global.get $reg_base) (local.get $sp))
      (call $gs32 (i32.add (local.get $sp) (i32.const 24)) (local.get $sqos))
      (call $gs32 (i32.add (local.get $sp) (i32.const 28)) (local.get $gqos))
      (global.set $yield_reason (i32.const 0))
      (call $dispatch_api_table (call $lookup_api_id "WSAConnect")
        (local.get $s) (local.get $addr) (i32.const 16)
        (local.get $caller) (local.get $callee) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsa_is_blocking_dispatch") (result i64)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $dispatch_api_table (call $lookup_api_id "WSAIsBlocking")
        (i32.const 0) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsa_create_event") (result i64)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $dispatch_api_table (call $lookup_api_id "WSACreateEvent")
        (i32.const 0) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsa_event_change") (param $reset i32) (param $event i32) (result i64)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (global.set $yield_flag (i32.const 0))
      (call $dispatch_api_table
        (if (result i32) (local.get $reset)
          (then (call $lookup_api_id "WSAResetEvent"))
          (else (call $lookup_api_id "WSASetEvent")))
        (local.get $event) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsa_close_event") (param $event i32) (result i64)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $dispatch_api_table (call $lookup_api_id "WSACloseEvent")
        (local.get $event) (i32.const 0) (i32.const 0)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i64.or (i64.extend_i32_u (i32.load (global.get $reg_base)))
        (i64.shl (i64.extend_i32_u (i32.load offset=16 (global.get $reg_base))) (i64.const 32))))
    (func (export "test_wsa_network_event") (param $op i32) (param $s i32) (param $ev i32) (param $p i32) (result i32)
      (i32.store offset=16 (global.get $reg_base) (i32.const 0x00300000))
      (call $dispatch_api_table
        (if (result i32) (local.get $op)
          (then (call $lookup_api_id "WSAEnumNetworkEvents"))
          (else (call $lookup_api_id "WSAEventSelect")))
        (local.get $s) (local.get $ev) (local.get $p)
        (i32.const 0) (i32.const 0) (i32.const 0))
      (i32.load (global.get $reg_base)))
    ;; A live HWND, so WSAAsyncSelect's posts route to this thread's queue.
    (func (export "test_make_window") (result i32)
      (local $hwnd i32)
      (local.set $hwnd (global.get $next_hwnd))
      (global.set $next_hwnd (i32.add (local.get $hwnd) (i32.const 1)))
      (call $wnd_table_set (local.get $hwnd) (global.get $WNDPROC_CTRL_NATIVE))
      (local.get $hwnd))
  ` : source);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const hostContext = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const imports = createHostImports(hostContext);
  const realCreateEvent = imports.host.create_event;
  let failCreateEvent = false;
  const eventCalls = [];
  imports.host.create_event = (...args) => {
    eventCalls.push(args);
    return failCreateEvent ? 0 : realCreateEvent(...args);
  };
  Object.assign(imports.host, {
    memory,
    create_thread: () => 0,
    exit_thread: () => 0,
    terminate_thread: () => 0,
    com_create_instance: () => 0x80004002,
  });
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  // Guest threads instantiate the same module over process-shared memory.
  const sibling = (await WebAssembly.instantiate(wasm, imports)).instance.exports;
  const wat = instance.exports;
  const bytes = new Uint8Array(memory.buffer);
  const imageBase = wat.get_image_base() >>> 0;
  let passed = 0;

  const wa = ga => RegionMap.g2w(ga, imageBase);

  function check(name, fn) {
    fn();
    passed++;
    console.log(`PASS  ${name}`);
  }

  function alloc(n) {
    const p = wat.guest_alloc(n) >>> 0;
    assert(p, 'guest_alloc failed');
    return p;
  }

  function cstr(s) {
    const p = alloc(s.length + 1);
    for (let i = 0; i < s.length; i++) bytes[wa(p) + i] = s.charCodeAt(i);
    bytes[wa(p) + s.length] = 0;
    return p;
  }

  function readCstr(ga) {
    let out = '';
    for (let i = 0; i < 64; i++) {
      const c = bytes[wa(ga) + i];
      if (!c) break;
      out += String.fromCharCode(c);
    }
    return out;
  }

  // sockaddr_in { short family; u_short port (net); u_long addr (net); char pad[8] }
  function sockaddr(ip, port) {
    const p = alloc(16);
    const v = new DataView(memory.buffer, wa(p), 16);
    v.setUint16(0, AF_INET, true);
    v.setUint16(2, port, false);
    const o = ip.split('.').map(Number);
    v.setUint8(4, o[0]); v.setUint8(5, o[1]); v.setUint8(6, o[2]); v.setUint8(7, o[3]);
    for (let i = 8; i < 16; i++) v.setUint8(i, 0);
    return p;
  }

  function readSockaddr(ga) {
    const v = new DataView(memory.buffer, wa(ga), 16);
    return {
      family: v.getUint16(0, true),
      port: v.getUint16(2, false),
      ip: [v.getUint8(4), v.getUint8(5), v.getUint8(6), v.getUint8(7)].join('.'),
    };
  }

  // fd_set { u_int count; SOCKET array[64] }
  function fdset(handles) {
    const p = alloc(4 + 64 * 4);
    const v = new DataView(memory.buffer, wa(p), 4 + 64 * 4);
    v.setUint32(0, handles.length, true);
    handles.forEach((h, i) => v.setUint32(4 + i * 4, h >>> 0, true));
    return p;
  }

  function fdsetList(ga) {
    const v = new DataView(memory.buffer, wa(ga), 4 + 64 * 4);
    const n = v.getUint32(0, true);
    const out = [];
    for (let i = 0; i < n; i++) out.push(v.getUint32(4 + i * 4, true) | 0);
    return out;
  }

  function timeval(sec, usec) {
    const p = alloc(8);
    const v = new DataView(memory.buffer, wa(p), 8);
    v.setUint32(0, sec, true);
    v.setUint32(4, usec, true);
    return p;
  }

  function buf(dataOrLen) {
    if (typeof dataOrLen === 'number') return alloc(dataOrLen);
    const p = alloc(dataOrLen.length);
    for (let i = 0; i < dataOrLen.length; i++) bytes[wa(p) + i] = dataOrLen[i];
    return p;
  }

  function readBuf(ga, n) {
    return Array.from(bytes.subarray(wa(ga), wa(ga) + n));
  }

  function setNonblocking(s, on) {
    const p = alloc(4);
    new DataView(memory.buffer, wa(p), 4).setUint32(0, on ? 1 : 0, true);
    assert.strictEqual(wat.test_call_ioctlsocket(s, FIONBIO, p) | 0, 0);
  }

  // Bring up a listening server and a connected client pair. Both halves
  // are nonblocking so a would-block is an assertion, never a hang.
  function connectedPair() {
    const srv = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.notStrictEqual(srv, INVALID_SOCKET);
    setNonblocking(srv, true);
    assert.strictEqual(wat.test_call_bind(srv, sockaddr('0.0.0.0', GAME_PORT), 16) | 0, 0);
    assert.strictEqual(wat.test_call_listen(srv, 5) | 0, 0);

    const cli = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.notStrictEqual(cli, INVALID_SOCKET);
    setNonblocking(cli, true);
    assert.strictEqual(wat.test_call_connect(cli, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, 0);

    const acc = wat.test_call_accept(srv, 0, 0) | 0;
    assert.notStrictEqual(acc, INVALID_SOCKET);
    setNonblocking(acc, true);
    return { srv, cli, acc };
  }

  // ---- byte order and address helpers --------------------------------

  wat.test_vsock_reset();

  check('Winsock startup references belong to the process across instances', () => {
    const data=alloc(400);
    assert.strictEqual(wat.test_wsa_startup(data)|0,0);
    assert.strictEqual(wat.test_wsa_startup(data)|0,0);
    const socket=wat.test_call_socket(AF_INET,SOCK_STREAM,0)|0;
    assert(socket>0);
    assert.strictEqual(sibling.test_wsa_cleanup()|0,0,
      'another guest thread can release a process startup reference');
    const mode=buf(4);
    assert.strictEqual(wat.test_call_ioctlsocket(socket,FIONBIO,mode)|0,0,
      'one remaining process reference keeps sockets alive');
    assert.strictEqual(wat.test_wsa_cleanup()|0,0);
    assert.strictEqual(wat.test_call_closesocket(socket)|0,SOCKET_ERROR,
      'only the last matching cleanup tears down sockets');
    assert.strictEqual(sibling.test_wsa_cleanup()|0,SOCKET_ERROR);
    assert.strictEqual(sibling.test_call_WSAGetLastError()|0,10093);
    assert.strictEqual(sibling.test_wsa_startup(data)|0,0);
    assert.strictEqual(wat.test_wsa_cleanup()|0,0,
      'startup on the other instance works after the zero-count error');
  });

  check('WSACreateEvent resolves and creates a real manual-reset event', () => {
    const api = require('../src/api_table.json').find(a => a.name === 'WSACreateEvent');
    assert(api, 'WSACreateEvent must resolve by name');
    assert.strictEqual(api.nargs, 0);
    const create = () => {
      const result = wat.test_wsa_create_event();
      assert.strictEqual(Number(result >> 32n), 0x00300004, 'zero-argument stdcall stack');
      return Number(result & 0xffffffffn);
    };
    assert.strictEqual(create(), 0, 'requires process startup');
    assert.strictEqual(wat.test_call_WSAGetLastError(), 10093);
    assert.strictEqual(eventCalls.length, 0, 'failure creates no host object');
    assert.strictEqual(sibling.test_wsa_startup(alloc(400)), 0);
    const event = create(), other = create();
    assert(event > 0 && other > 0 && event !== other, 'unnamed events are distinct');
    assert.deepStrictEqual(eventCalls, [[1,0,0,0], [1,0,0,0]]);
    assert.strictEqual(imports.host.wait_single(event, 0), 258, 'initially nonsignaled');
    imports.host.set_event(event);
    assert.strictEqual(imports.host.wait_single(event, 0), 0);
    assert.strictEqual(imports.host.wait_single(event, 0), 0, 'manual reset survives a wait');
    assert.strictEqual(imports.host.wait_single(other, 0), 258, 'other event stays independent');
    imports.host.reset_event(event);
    assert.strictEqual(imports.host.wait_single(event, 0), 258);
    failCreateEvent = true;
    try {
      assert.strictEqual(create(), 0);
      assert.strictEqual(wat.test_call_WSAGetLastError(), 8, 'WSA_NOT_ENOUGH_MEMORY');
    } finally { failCreateEvent = false; }
    assert.strictEqual(wat.test_wsa_cleanup(), 0);
  });

  check('WSA event changes enforce startup, handle lifetime and event state', () => {
    for (const name of ['WSASetEvent','WSAResetEvent']) {
      const api = require('../src/api_table.json').find(a => a.name === name);
      assert(api, name + ' must resolve');
      assert.strictEqual(api.nargs, 1);
    }
    const change = (reset, handle) => {
      const result = wat.test_wsa_event_change(reset, handle);
      assert.strictEqual(Number(result >> 32n), 0x00300008);
      return Number(result & 0xffffffffn);
    };
    for (const reset of [0, 1]) {
      assert.strictEqual(change(reset, 0), 0);
      assert.strictEqual(wat.test_call_WSAGetLastError(), 10093);
    }
    wat.test_wsa_startup(alloc(400));
    const event = Number(wat.test_wsa_create_event() & 0xffffffffn);
    const mutex = imports.host.create_event(0, 1, 0, 2);
    for (const bad of [0, 0x12345678, mutex, (mutex | 0x80000000) >>> 0]) {
      for (const reset of [0, 1]) {
        assert.strictEqual(change(reset, bad), 0, 'invalid/non-event handle');
        assert.strictEqual(wat.test_call_WSAGetLastError(), 6, 'WSA_INVALID_HANDLE');
      }
    }
    assert.strictEqual(change(0, event), 1);
    assert.strictEqual(imports.host.wait_single(event, 0), 0);
    assert.strictEqual(imports.host.wait_single(event, 0), 0);
    assert.strictEqual(change(1, event), 1);
    assert.strictEqual(imports.host.wait_single(event, 0), 258);
    assert.strictEqual(hostContext.closeSyncHandle(event), true);
    for (const reset of [0,1]) {
      assert.strictEqual(change(reset, event), 0);
      assert.strictEqual(wat.test_call_WSAGetLastError(), 6);
    }
    assert.strictEqual(hostContext.closeSyncHandle(mutex), true);
    wat.test_wsa_cleanup();
  });

  check('WSACloseEvent closes only live events and checks initialization', () => {
    const api = require('../src/api_table.json').find(a => a.name === 'WSACloseEvent');
    assert(api, 'WSACloseEvent must resolve');
    assert.strictEqual(api.nargs, 1);
    const close = handle => {
      const result = wat.test_wsa_close_event(handle);
      assert.strictEqual(Number(result >> 32n), 0x00300008);
      return Number(result & 0xffffffffn);
    };
    assert.strictEqual(close(0), 0);
    assert.strictEqual(wat.test_call_WSAGetLastError(), 10093);
    wat.test_wsa_startup(alloc(400));
    const event = Number(wat.test_wsa_create_event() & 0xffffffffn);
    const mutex = imports.host.create_event(0, 1, 0, 2);
    for (const bad of [0, 0x12345678, mutex]) {
      assert.strictEqual(close(bad), 0);
      assert.strictEqual(wat.test_call_WSAGetLastError(), 6);
    }
    assert.strictEqual(close(event), 1);
    assert.strictEqual(close(event), 0, 'double close must fail');
    assert.strictEqual(wat.test_call_WSAGetLastError(), 6);
    assert.strictEqual(imports.host.set_event(event), 0, 'closed event cannot be signaled');
    assert.strictEqual(hostContext.closeSyncHandle(mutex), true, 'failed event close preserves mutex');
    wat.test_wsa_cleanup();
  });

  check('socket event broker atomically enumerates and shares process records', () => {
    const { processSharedCtx } = require('../lib/worker-imports');
    const broker = imports.host.socket_event;
    assert.strictEqual(typeof broker, 'function', 'socket event broker must exist');
    const child = createHostImports({ ...processSharedCtx(hostContext), getMemory: () => memory.buffer });
    const event = imports.host.create_event(1, 0, 0, 0);
    const out = wa(alloc(44)), view = new DataView(memory.buffer, out, 44);
    const select = (socket, mask) => broker(0, socket, event, mask, 0);
    const post = (socket, bit, error=0) => broker(1, socket, bit, error, 0);
    const enumerate = (socket, handle=event, ptr=out) => child.host.socket_event(2, socket, handle, 0, ptr);
    assert.strictEqual(select(7, 0x21), 0);
    post(7, 2); // unselected FD_WRITE must not signal or leak into the record
    assert.strictEqual(imports.host.wait_single(event, 0), 258);
    post(7, 1); post(7, 32, 10054);
    assert.strictEqual(imports.host.wait_single(event, 0), 0);
    for (let i=0;i<11;i++) view.setUint32(i*4, 0xdeadbeef, true);
    assert.strictEqual(enumerate(7, 0x12345678), 10022);
    assert.strictEqual(view.getUint32(0,true), 0xdeadbeef, 'failure leaves output untouched');
    assert.strictEqual(imports.host.wait_single(event,0),0,'failure preserves event signal');
    assert.strictEqual(enumerate(7,event,memory.buffer.byteLength-4),10014);
    assert.strictEqual(enumerate(7),0);
    assert.strictEqual(view.getUint32(0,true),0x21);
    assert.strictEqual(view.getUint32(4,true),0);
    assert.strictEqual(view.getUint32(24,true),10054);
    assert.strictEqual(view.getUint32(8,true),0xdeadbeef,'unreported error slots stay untouched');
    assert.strictEqual(imports.host.wait_single(event,0),258);
    assert.strictEqual(enumerate(7),0);
    assert.strictEqual(view.getUint32(0,true),0,'record cleared');
    post(7,1);
    assert.strictEqual(imports.host.wait_single(event,0),0,'next notification signals after reset');
    assert.strictEqual(enumerate(7,0),0);
    assert.strictEqual(imports.host.wait_single(event,0),0,'NULL event does not reset');
    imports.host.reset_event(event);
    assert.strictEqual(broker(4,8,7,0,0),0,'accepted socket inherits association');
    child.host.socket_event(1,8,32,10061,0);
    assert.strictEqual(enumerate(8),0);
    assert.strictEqual(view.getUint32(0,true),32);
    assert.strictEqual(view.getUint32(24,true),10061);
    assert.strictEqual(broker(3,8,0,0,0),0);
    post(8,1);
    assert.strictEqual(enumerate(8),0);
    assert.strictEqual(view.getUint32(0,true),0,'cancel removes association and pending record');
    assert.strictEqual(select(7,0),0);
    post(7,1);
    assert.strictEqual(enumerate(7),0);
    assert.strictEqual(view.getUint32(0,true),0);
    assert.strictEqual(broker(0,7,0x12345678,1,0),10022);
    assert.strictEqual(select(7,0x80000000),10022,'unsupported mask rejected');
    assert.strictEqual(imports.host.close_event(event),1);
  });

  check('protocol enumeration sizes, filters and reports usable virtual transports', () => {
    wat.test_vsock_reset();
    const n=buf(4), out=buf(2000), filter=buf(16);
    const dv=new DataView(memory.buffer); const set=(p,v)=>dv.setUint32(wa(p),v,true),get=p=>dv.getUint32(wa(p),true);
    const run=(wide,f,p,cap)=>{set(n,cap);const r=wat.test_wsa_protocols(wide,f,p,n);assert.strictEqual(Number(r>>32n),0x300010,'stdcall pop');return Number(BigInt.asIntN(32,r));};
    assert.strictEqual(run(0,0,out,2000),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10093);
    wat.test_wsa_startup(alloc(400));
    bytes.fill(0xa5,wa(out),wa(out)+2000);
    assert.strictEqual(run(0,0,0,0),-1);assert.strictEqual(get(n),1116);assert.strictEqual(wat.test_call_WSAGetLastError(),10055);
    assert.strictEqual(run(0,0,out,1115),-1);assert(readBuf(out,2000).every(v=>v===0xa5),'short output untouched');
    assert.strictEqual(run(0,0,out,2000),3);assert.strictEqual(get(n),1116);
    for(const [i,protocol,type,flags] of [[0,6,1,38],[1,17,2,521]]){
      const p=out+i*372;assert.strictEqual(get(p),flags);assert.strictEqual(get(p+36),i+1);assert.strictEqual(get(p+40),1);
      assert.strictEqual(get(p+76),2);assert.strictEqual(get(p+80),16);assert.strictEqual(get(p+88),type);assert.strictEqual(get(p+92),protocol);
      const sock=wat.test_call_socket(get(p+76),type,protocol);assert(sock>0);wat.test_call_closesocket(sock);
      assert.strictEqual(get(p+112),0);assert.strictEqual(bytes[wa(p)+371],0);
    }
    assert.strictEqual(bytes[wa(out)+1116],0xa5,'guard after records');
    assert.strictEqual(get(out+744+16),0);assert.strictEqual(get(out+744+76),6);assert.strictEqual(get(out+744+92),1000);assert.strictEqual(get(out+744+96),255);
    set(filter,1001);set(filter+4,0);assert.strictEqual(run(0,filter,out,2000),1);assert.strictEqual(get(out+76),6);
    set(filter,17);set(filter+4,17);set(filter+8,0);
    assert.strictEqual(run(1,filter,out,2000),1);assert.strictEqual(get(n),628);assert.strictEqual(get(out+92),17);
    const name=Buffer.from(memory.buffer,wa(out)+116,512).toString('utf16le').split('\0')[0];assert.strictEqual(name,'Wine Assembly virtual UDP/IPv4');
    set(filter,999);set(filter+4,0);assert.strictEqual(run(0,filter,0,0),0);assert.strictEqual(get(n),0);
    set(filter,0);assert.strictEqual(run(0,filter,0,0),0);
    assert.strictEqual(run(0,0,0,1116),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10014);
    assert.strictEqual(run(0,0xfffffffc,out,2000),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10014);
    assert.strictEqual(Number(BigInt.asIntN(32,wat.test_wsa_protocols(0,0,out,0))),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10014);
  });

  check('WSARecv scatters stream data, parks whole call frame and validates before consume', () => {
    wat.test_vsock_reset();wat.test_wsa_startup(alloc(400));
    const {cli,acc}=connectedPair(),a=buf(2),b=buf(5),desc=buf(16),n=buf(4),f=buf(4);
    const dv=new DataView(memory.buffer),set=(p,v)=>dv.setUint32(wa(p),v,true),get=p=>dv.getUint32(wa(p),true);
    set(desc,2);set(desc+4,a);set(desc+8,5);set(desc+12,b);set(f,0);set(n,0x1234);
    const receive=(over=0)=>wat.test_wsarecv(acc,desc,2,n,f,over), result=r=>Number(BigInt.asIntN(32,r));
    let r=receive();assert.strictEqual(result(r),-1);assert.strictEqual(Number(r>>32n),0x300020);assert.strictEqual(wat.test_call_WSAGetLastError(),10035);assert.strictEqual(get(n),0x1234);
    setNonblocking(acc,false);r=receive();assert.strictEqual(wat.get_yield_reason(),8);assert.strictEqual(Number(r>>32n),0x300000,'park restores full WSARecv frame');assert.strictEqual(get(n),0x1234);
    assert.strictEqual(wat.test_call_send(cli,buf([1,2,3,4,5]),5,0),5);
    set(desc+12,0);r=receive();assert.strictEqual(result(r),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10014);
    set(desc+12,b);r=receive();assert.strictEqual(result(r),0);assert.strictEqual(Number(r>>32n),0x300020);assert.strictEqual(get(n),5);assert.deepStrictEqual(readBuf(a,2),[1,2]);assert.deepStrictEqual(readBuf(b,3),[3,4,5]);assert.strictEqual(get(f),0);
    wat.test_call_shutdown(cli,SD_SEND);r=receive();assert.strictEqual(result(r),0);assert.strictEqual(get(n),0);
    set(f,2);assert.throws(()=>receive(),WebAssembly.RuntimeError,'unimplemented PEEK must not consume');set(f,0);
    assert.throws(()=>receive(1),WebAssembly.RuntimeError,'overlapped must not falsely complete');
  });
  check('WSARecv preserves datagram boundaries and scatters truncated prefix', () => {
    const frames=[];hostContext.vlanWire={send:frame=>{frames.push(frame);return true;},peek:()=>frames[0],commit:()=>frames.shift()};
    wat.test_vsock_reset();wat.test_wsa_startup(alloc(400));
    const s=wat.test_call_socket(AF_INET,SOCK_DGRAM,17),c=wat.test_call_socket(AF_INET,SOCK_DGRAM,17),addr=sockaddr(ROOM_HOST,GAME_PORT);
    assert.strictEqual(wat.test_call_bind(s,addr,16),0);setNonblocking(s,true);
    const a=buf(2),b=buf(2),d=buf(16),n=buf(4),f=buf(4),dv=new DataView(memory.buffer),set=(p,v)=>dv.setUint32(wa(p),v,true);
    set(d,2);set(d+4,a);set(d+8,2);set(d+12,b);set(f,0);
    assert.strictEqual(wat.test_call_sendto(c,buf([9,8,7,6,5]),5,0,addr,16),5);
    assert.strictEqual(Number(BigInt.asIntN(32,wat.test_wsarecv(s,d,2,n,f,0))),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10040);assert.deepStrictEqual(readBuf(a,2),[9,8]);assert.deepStrictEqual(readBuf(b,2),[7,6]);
    assert.strictEqual(wat.test_call_sendto(c,buf([4,3,2]),3,0,addr,16),3);
    assert.strictEqual(Number(BigInt.asIntN(32,wat.test_wsarecv(s,d,2,n,f,0))),0);assert.strictEqual(dv.getUint32(wa(n),true),3);assert.deepStrictEqual(readBuf(a,2),[4,3]);assert.strictEqual(readBuf(b,1)[0],2);
    delete hostContext.vlanWire;
  });

  check('stream send primitive restores both caller frames without duplicating bytes', () => {
    for(const frame of [20,32]){
      wat.test_vsock_reset();wat.test_wsa_startup(alloc(400));
      const {cli,acc}=connectedPair(),data=buf(100000),one=buf([0x79]),out=buf(100000);
      const filled=wat.test_call_send(cli,data,100000,0);assert(filled>0&&filled<100000);
      setNonblocking(cli,false);
      let r=wat.test_send_core_frame(cli,one,1,frame);assert.strictEqual(Number(BigInt.asIntN(32,r)),-2);assert.strictEqual(Number(r>>32n),0x300000);assert.strictEqual(wat.get_yield_reason(),8);
      assert.strictEqual(wat.test_call_recv(acc,out,filled,0),filled);
      r=wat.test_send_core_frame(cli,one,1,frame);assert.strictEqual(Number(BigInt.asIntN(32,r)),1);assert.strictEqual(Number(r>>32n),0x300000+frame);
      assert.strictEqual(wat.test_call_recv(acc,out,2,0),1);assert.strictEqual(readBuf(out,1)[0],0x79);
      assert.strictEqual(wat.test_call_recv(acc,out,2,0),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10035);
    }
  });

  check('WSASend blocking gather resumes every byte once and nonblocking returns a prefix', () => {
    for(const blocking of [false,true]) {
      wat.test_vsock_reset();wat.test_wsa_startup(alloc(400));
      const {cli,acc}=connectedPair();setNonblocking(cli,!blocking);
      const first=Array.from({length:37001},(_,i)=>i%251),second=Array.from({length:63007},(_,i)=>(i+17)%251),expected=first.concat(second);
      const a=buf(first),b=buf(second),d=buf(16),n=buf(4),out=buf(110000),dv=new DataView(memory.buffer),set=(p,v)=>dv.setUint32(wa(p),v,true);
      set(d,first.length);set(d+4,a);set(d+8,second.length);set(d+12,b);set(n,0x1234);
      const collected=[];let completed=false,parks=0;
      for(let i=0;i<20;i++) {
        const r=wat.test_wsasend(cli,d,2,n);
        if(wat.get_yield_reason()===8){parks++;assert.strictEqual(Number(r>>32n),0x300000);assert.strictEqual(dv.getUint32(wa(n),true),0x1234,'no premature completion');}
        else {assert.strictEqual(Number(BigInt.asIntN(32,r)),0);assert.strictEqual(Number(r>>32n),0x300020);completed=true;}
        const got=wat.test_call_recv(acc,out,110000,0);assert(got>0);collected.push(...readBuf(out,got));
        if(completed)break;
      }
      assert(completed);assert.deepStrictEqual(collected,expected.slice(0,collected.length));assert.strictEqual(dv.getUint32(wa(n),true),collected.length);
      if(blocking){assert(parks>0);assert.strictEqual(collected.length,expected.length);}else{assert.strictEqual(parks,0);assert(collected.length<expected.length);}
      assert.strictEqual(wat.test_call_recv(acc,out,110000,0),-1);
      // A new call at the same stack address starts at byte zero.
      set(d,3);set(d+8,0);assert.strictEqual(Number(BigInt.asIntN(32,wat.test_wsasend(cli,d,2,n))),0);
      assert.strictEqual(wat.test_call_recv(acc,out,110000,0),3);assert.deepStrictEqual(readBuf(out,3),first.slice(0,3));
      // An invalid later buffer must not send a valid prefix first.
      set(d+8,2);set(d+12,0);assert.strictEqual(Number(BigInt.asIntN(32,wat.test_wsasend(cli,d,2,n))),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10014);
      assert.strictEqual(wat.test_call_recv(acc,out,110000,0),-1);
    }
  });

  check('IPv4 ICMP echo packets preserve payload and reject malformed input without writes', () => {
    const checksum = bytes => {
      let sum=0;
      for(let i=0;i<bytes.length;i+=2) sum += bytes[i]*256+(bytes[i+1]||0);
      while(sum>65535)sum=(sum%65536)+Math.floor(sum/65536);
      return 65535-sum;
    };
    const packet = n => {
      const b=Buffer.alloc(n+28);b[0]=0x45;b.writeUInt16BE(b.length,2);
      b.writeUInt16BE(0xabcd,4);b[6]=0x40;b[8]=32;b[9]=1;
      b.writeUInt32BE(0x0a000001,12);b.writeUInt32BE(0x0a000002,16);
      b[20]=8;b.writeUInt16BE(0x1234,24);b.writeUInt16BE(0x5678,26);
      for(let i=28;i<b.length;i++)b[i]=(i*43+7)&255;
      b.writeUInt16BE(checksum(b.subarray(20)),22);
      b.writeUInt16BE(checksum(b.subarray(0,20)),10);return b;
    };
    const vector=buf(Buffer.from('0001f203f4f5f6f7','hex'));
    assert.strictEqual(wat.test_checksum(vector,8),0x220d,'known checksum vector');
    for(const n of [0,1,2,31,1025,65507]){
      const input=packet(n),src=buf(input),dst=buf(input.length+4);
      new Uint8Array(memory.buffer,wa(dst),input.length+4).fill(0xa5);
      assert.strictEqual(wat.test_icmp_reply(src,input.length,dst,input.length,0x2468),input.length);
      const reply=Buffer.from(new Uint8Array(memory.buffer,wa(dst),input.length));
      assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,wa(src),input.length)),input);
      assert.strictEqual(checksum(reply.subarray(0,20)),0);assert.strictEqual(checksum(reply.subarray(20)),0);
      assert.strictEqual(reply.readUInt32BE(12),0x0a000002);assert.strictEqual(reply.readUInt32BE(16),0x0a000001);
      assert.strictEqual(reply.readUInt16BE(4),0x2468);assert.strictEqual(reply[8],64);assert.strictEqual(reply[20],0);
      assert.deepStrictEqual(reply.subarray(24),input.subarray(24),'identifier, sequence and all payload bytes');
      assert.deepStrictEqual([...new Uint8Array(memory.buffer,wa(dst)+input.length,4)],[165,165,165,165]);
      assert.strictEqual(wat.test_icmp_reply(src,input.length,src,input.length,0x2468),input.length);
      assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,wa(src),input.length)),reply,'in-place response');
    }
    const original=packet(3),dst=buf(100);
    const reject=(b,n=b.length,cap=100)=>{
      new Uint8Array(memory.buffer,wa(dst),100).fill(0xa5);
      assert.strictEqual(wat.test_icmp_reply(buf(b),n,dst,cap,1),0);
      assert(new Uint8Array(memory.buffer,wa(dst),100).every(x=>x===0xa5));
    };
    reject(original,27);reject(original,original.length-1);reject(original,original.length,original.length-1);
    for(const [offset,value]of [[0,0x46],[0,0x65],[6,0x20],[6,0x80],[7,1],[8,0],[9,17],[20,0],[21,1],[30,0]]){
      const bad=Buffer.from(original);bad[offset]=value;
      if(offset<20){bad.writeUInt16BE(0,10);bad.writeUInt16BE(checksum(bad.subarray(0,20)),10);}
      else if(offset<24){bad.writeUInt16BE(0,22);bad.writeUInt16BE(checksum(bad.subarray(20)),22);}
      reject(bad);
    }
    const badHeader=Buffer.from(original);badHeader[10]^=1;reject(badHeader);
  });

  check('raw ICMP ingress fans out full IPv4 datagrams with address filtering and bounded queues', () => {
    wat.test_vsock_reset();wat.test_wsa_startup(alloc(400));
    const local=0x7f000001, remote=0x0a000009;
    const any=wat.test_raw_seed(0,0,3),bound=wat.test_raw_seed(local,remote,3);
    const wrongLocal=wat.test_raw_seed(0x7f000002,0,3),wrongPeer=wat.test_raw_seed(0,0x0a000008,3),udp=wat.test_raw_seed(0,0,2);
    wat.test_raw_wrap(bound);
    const checksum=b=>{let s=0;for(let i=0;i<b.length;i+=2)s+=b[i]*256+(b[i+1]||0);while(s>65535)s=(s&65535)+Math.floor(s/65536);return 65535-s;};
    const packet=Buffer.alloc(29);packet[0]=0x45;packet.writeUInt16BE(29,2);packet[8]=64;packet[9]=1;
    packet.writeUInt32BE(remote,12);packet.writeUInt32BE(local,16);packet[20]=0;packet[24]=0x34;packet[28]=0x51;
    const seal=b=>{b.writeUInt16BE(0,10);b.writeUInt16BE(0,22);b.writeUInt16BE(checksum(b.subarray(20)),22);b.writeUInt16BE(checksum(b.subarray(0,20)),10);};seal(packet);
    const p=buf(packet),out=buf(100),receive=()=>wat.test_raw_ingress(p,packet.length);
    assert.strictEqual(wat.test_raw_ready(any),0);assert.strictEqual(receive(),2);
    for(const i of [any,bound]){
      assert.strictEqual(wat.test_raw_ready(i),1);assert.strictEqual(wat.test_raw_take(i,out),41);
      const b=Buffer.from(new Uint8Array(memory.buffer,wa(out),41));assert.strictEqual(b.readUInt32LE(0),29);
      assert.strictEqual(b.readUInt32LE(4),remote);assert.strictEqual(b.readUInt32LE(8),0);assert.deepStrictEqual(b.subarray(12),packet);
      assert.strictEqual(wat.test_raw_ready(i),0);
    }
    for(const i of [wrongLocal,wrongPeer,udp])assert.strictEqual(wat.test_raw_ready(i),0);
    // Core receive keeps the IP header but hides our private queue prefix.
    // Public raw allocation remains disabled until send/overlapped are ready.
    const from=buf(16),fromlen=buf(4),available=buf(4),nonblock=buf([1,0,0,0]);
    const putlen=n=>new DataView(memory.buffer).setInt32(wa(fromlen),n,true);
    receive();receive();
    const queued=()=>{assert.strictEqual(wat.test_call_ioctlsocket(wat.test_raw_handle(any),FIONREAD,available),0);
      return new DataView(memory.buffer).getUint32(wa(available),true);};
    assert.strictEqual(queued(),58,'count packet bytes without queue headers');
    putlen(16);
    for(const [dst,n,addr,addrlen,error] of [[out,-1,from,fromlen,10022],
      [0,29,from,fromlen,10014],[out,29,from,0,10014],[out,29,0xffffffff,fromlen,10014]]){
      assert.strictEqual(wat.test_raw_recv(any,dst,n,addr,addrlen),-1);
      assert.strictEqual(wat.test_call_WSAGetLastError(),error);assert.strictEqual(queued(),58);
    }
    putlen(8);assert.strictEqual(wat.test_raw_recv(any,out,100,from,fromlen),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10014);assert.strictEqual(queued(),58);
    putlen(16);assert.strictEqual(wat.test_raw_recv(any,out,100,from,fromlen),29);
    assert.deepStrictEqual(Buffer.from(readBuf(out,29)),packet);
    const address=Buffer.from(readBuf(from,16));assert.strictEqual(address.readUInt16LE(0),2);
    assert.strictEqual(address.readUInt16BE(2),0);assert.strictEqual(address.readUInt32BE(4),remote);
    assert.strictEqual(queued(),29);
    assert.strictEqual(wat.test_raw_recv(any,out,7,0,0),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10040);
    assert.deepStrictEqual(Buffer.from(readBuf(out,7)),packet.subarray(0,7));assert.strictEqual(queued(),0);
    wat.test_call_ioctlsocket(wat.test_raw_handle(any),FIONBIO,nonblock);
    assert.strictEqual(wat.test_raw_recv(any,out,100,0,0),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10035);
    while(wat.test_raw_take(bound,out)){} // drain the other fanout recipient
    const handle=wat.test_raw_handle(any);
    receive();receive();
    assert.throws(()=>wat.test_call_recv(handle,out,100,2),WebAssembly.RuntimeError);
    assert.throws(()=>wat.test_call_recvfrom(handle,out,100,2,0,0),WebAssembly.RuntimeError);
    assert.strictEqual(queued(),58,'unsupported PEEK never consumes');
    assert.strictEqual(wat.test_call_recv(handle,out,100,0),29);
    assert.deepStrictEqual(Buffer.from(readBuf(out,29)),packet);assert.strictEqual(queued(),29);
    assert.strictEqual(wat.test_call_recvfrom(handle,out,100,0,from,fromlen),29);
    assert.deepStrictEqual(Buffer.from(readBuf(out,29)),packet);assert.strictEqual(queued(),0);
    const desc=buf(16),part=buf(24),count=buf(4),flags=buf(4),dv=new DataView(memory.buffer);
    const set=(p,n)=>dv.setUint32(wa(p),n,true),get=p=>dv.getUint32(wa(p),true);
    set(desc,5);set(desc+4,out);set(desc+8,24);set(desc+12,part);set(flags,0);set(count,0x1234);
    receive();let result=wat.test_wsarecv(handle,desc,2,count,flags,0);
    assert.strictEqual(Number(BigInt.asIntN(32,result)),0);assert.strictEqual(get(count),29);
    assert.deepStrictEqual(Buffer.from([...readBuf(out,5),...readBuf(part,24)]),packet);
    receive();set(desc+8,2);set(count,0x1234);result=wat.test_wsarecv(handle,desc,2,count,flags,0);
    assert.strictEqual(Number(BigInt.asIntN(32,result)),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10040);
    assert.deepStrictEqual(Buffer.from([...readBuf(out,5),...readBuf(part,2)]),packet.subarray(0,7));
    assert.strictEqual(get(count),0x1234);assert.strictEqual(queued(),0);
    set(nonblock,0);wat.test_call_ioctlsocket(handle,FIONBIO,nonblock);
    result=wat.test_wsarecv(handle,desc,2,count,flags,0);
    assert.strictEqual(wat.get_yield_reason(),8);assert.strictEqual(Number(result>>32n),0x300000,'raw WSARecv restores entire frame');
    set(nonblock,1);wat.test_call_ioctlsocket(handle,FIONBIO,nonblock);
    // WSARecvFrom validates all buffers before consuming, including sockaddr.
    const recvfrom=()=>wat.test_wsarecvfrom(handle,desc,2,count,flags,0,from,fromlen);
    receive();set(desc+12,0);result=recvfrom();
    assert.strictEqual(Number(BigInt.asIntN(32,result)),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10014);
    assert.strictEqual(queued(),29);set(desc+12,part);
    putlen(8);result=recvfrom();assert.strictEqual(Number(BigInt.asIntN(32,result)),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10014);assert.strictEqual(queued(),29);putlen(16);
    set(flags,2);assert.throws(recvfrom,WebAssembly.RuntimeError);set(flags,0);assert.strictEqual(queued(),29);
    assert.throws(()=>wat.test_wsarecvfrom(handle,desc,2,count,flags,1,from,fromlen),WebAssembly.RuntimeError);
    assert.strictEqual(queued(),29);result=recvfrom();
    assert.strictEqual(Number(BigInt.asIntN(32,result)),-1);assert.strictEqual(Number(result>>32n),0x300028);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10040);assert.strictEqual(queued(),0);
    assert.deepStrictEqual(Buffer.from([...readBuf(out,5),...readBuf(part,2)]),packet.subarray(0,7));
    receive();set(desc+8,24);result=recvfrom();assert.strictEqual(Number(BigInt.asIntN(32,result)),0);
    assert.strictEqual(get(count),29);assert.deepStrictEqual(Buffer.from([...readBuf(out,5),...readBuf(part,24)]),packet);
    assert.strictEqual(Buffer.from(readBuf(from,16)).readUInt32BE(4),remote);
    set(nonblock,0);wat.test_call_ioctlsocket(handle,FIONBIO,nonblock);result=recvfrom();
    assert.strictEqual(wat.get_yield_reason(),8);assert.strictEqual(Number(result>>32n),0x300000,'raw WSARecvFrom restores 40-byte frame');
    set(nonblock,1);wat.test_call_ioctlsocket(handle,FIONBIO,nonblock);
    while(wat.test_raw_take(bound,out)){}
    const {LoopbackSegment,describeFrame}=require('../lib/vlan-wire');
    const segment=new LoopbackSegment(),sender=segment.attach(),receiver=segment.attach();
    const frame=Buffer.alloc(28+packet.length);
    frame.writeUInt32LE(0x314e4c56,0);frame.writeUInt32LE(9,4);frame.writeUInt32LE(remote,8);
    frame.writeUInt32LE(local,16);frame.writeUInt32LE(packet.length,24);packet.copy(frame,28);
    assert(describeFrame(frame).startsWith('ICMP '));hostContext.vlanWire=receiver;
    try {
      sender.send(frame);wat.vlan_pump();assert.strictEqual(receiver.pending,0);
      for(const i of [any,bound]){assert.strictEqual(wat.test_raw_take(i,out),41);assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer,wa(out)+12,29)),packet);}
      const request=Buffer.from(packet);request[20]=8;seal(request);
      const echoFrame=Buffer.from(frame);request.copy(echoFrame,28);sender.send(echoFrame);wat.vlan_pump();
      assert.strictEqual(sender.pending,1,'local stack replies to room echo request');
      const reply=Buffer.from(sender.peek()),replyIP=reply.subarray(28);sender.commit();
      assert.strictEqual(reply.readUInt32LE(8),local);assert.strictEqual(reply.readUInt32LE(16),remote);
      assert.strictEqual(replyIP[20],0);assert.deepStrictEqual(replyIP.subarray(24),request.subarray(24));
      assert.strictEqual(checksum(replyIP.subarray(0,20)),0);assert.strictEqual(checksum(replyIP.subarray(20)),0);
      for(const i of [any,bound]){assert.strictEqual(wat.test_raw_take(i,out),41);
        assert.deepStrictEqual(Buffer.from(readBuf(out+12,29)),request,'response construction must not alter queued request');}
      const corruptEcho=Buffer.from(echoFrame);corruptEcho[56]^=1;sender.send(corruptEcho);wat.vlan_pump();
      assert.strictEqual(sender.pending,0,'bad checksum never generates a reply');
      const foreignEcho=Buffer.from(echoFrame);foreignEcho.writeUInt32LE(0x0a000008,16);
      sender.send(foreignEcho);wat.vlan_pump();assert.strictEqual(sender.pending,0,'foreign destination never generates a reply');
      for(const [offset,value]of [[8,remote+1],[16,0x7f000002],[12,7],[20,7]]){
        const bad=Buffer.from(frame);bad.writeUInt32LE(value,offset);sender.send(bad);
      }
      sender.send(Buffer.from(frame.subarray(0,30)));wat.vlan_pump();
      assert.strictEqual(receiver.pending,0,'invalid frames do not block the room');
      assert.strictEqual(wat.test_raw_ready(any),0,'outer identity mismatch must not reach raw queues');
      for(let i=0;i<514;i++)sender.send(frame);
      assert.strictEqual(receiver.pending,512,'raw traffic has datagram queue bounds');
      assert.strictEqual(receiver.droppedFrames,2);
      wat.vlan_pump();wat.vlan_pump();assert.strictEqual(receiver.pending,0,'full raw receive queue never stalls wire');
      for(const i of [any,bound]){let count=0;while(wat.test_raw_take(i,out))count++;assert.strictEqual(count,32);}
    } finally {delete hostContext.vlanWire;}
    for(let i=0;i<32;i++)assert.strictEqual(receive(),2);
    assert.strictEqual(receive(),0,'full datagram queues drop rather than overwrite');
    assert.strictEqual(wat.test_raw_take(any,out),41);assert.strictEqual(receive(),1,'one full receiver does not prevent delivery to another');
    const foreign=Buffer.from(packet);foreign.writeUInt32BE(0x0a0000fe,16);seal(foreign);
    assert.strictEqual(wat.test_raw_ingress(buf(foreign),29),0,'foreign destination is never routed locally');
    const corrupt=Buffer.from(packet);corrupt[28]^=1;assert.strictEqual(wat.test_raw_ingress(buf(corrupt),29),0);
    wat.test_vsock_reset();assert.strictEqual(receive(),0,'closed sockets receive nothing');
  });

  check('raw bind ignores ports, rejects foreign sources and reports write readiness', () => {
    wat.test_vsock_reset();wat.test_wsa_startup(alloc(400));
    const a=Number(BigInt.asIntN(32,wat.test_wsasocket(0,2,3,1,0,0,1))),b=Number(BigInt.asIntN(32,wat.test_wsasocket(1,2,3,1,0,0,0)));
    assert(a>0 && b>0,'A/W create real synchronous raw sockets');
    const writable=s=>wat.test_call_select(0,0,fdset([s]),0,timeval(0,0));
    assert.strictEqual(writable(a),1);
    assert.strictEqual(wat.test_call_bind(a,sockaddr('10.0.0.9',77),16),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10049);
    for(const s of [a,b])assert.strictEqual(wat.test_call_bind(s,sockaddr('0.0.0.0',77),16),0,'raw binds do not collide on ports');
    const name=buf(16),len=buf([16,0,0,0]);
    assert.strictEqual(wat.test_call_getsockname(a,name,len),0);
    const address=Buffer.from(readBuf(name,16));assert.strictEqual(address.readUInt16BE(2),0);
    assert.strictEqual(address.readUInt32BE(4),0,'wildcard receive filter survives bind');
    assert.strictEqual(writable(a),1);assert.strictEqual(wat.test_call_listen(a,5),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10045);assert.strictEqual(writable(a),1);
    assert.strictEqual(wat.test_call_connect(a,sockaddr(ROOM_HOST,0),16),0);assert.strictEqual(writable(a),1);
    const request=buf([8,0,0,0,0x12,0x34,0,1]);
    new DataView(memory.buffer).setUint16(wa(request)+2,wat.test_checksum(request,8),false);
    assert.strictEqual(wat.test_call_send(a,request,8,0),8);
    const packet=buf(64);
    assert.strictEqual(wat.test_call_recv(a,packet,64,0),28);assert.strictEqual(readBuf(packet+20,1)[0],8);
    assert.strictEqual(wat.test_call_recv(a,packet,64,0),28);assert.strictEqual(readBuf(packet+20,1)[0],0);
    assert.strictEqual(wat.test_checksum(packet+20,8),0,'public socket completes real local echo');
    wat.test_call_shutdown(a,SD_SEND);assert.strictEqual(writable(a),0);
    wat.test_vsock_reset();
  });

  check('raw sendto emits bounded IPv4 envelopes and preserves wire backpressure', () => {
    wat.test_vsock_reset();wat.test_wsa_startup(alloc(400));
    const rawIndex=wat.test_raw_seed(0x0a000001,0,3),s=wat.test_raw_handle(rawIndex);setNonblocking(s,true);
    const {LoopbackSegment}=require('../lib/vlan-wire'),segment=new LoopbackSegment();
    const sender=segment.attach(),receiver=segment.attach();hostContext.vlanWire=sender;
    const body=Buffer.from([8,0,0,0,0x12,0x34,0,1,0x51]);
    const p=buf(body),to=sockaddr('10.0.0.9',99);
    const send=(ptr=p,len=body.length,addr=to)=>wat.test_call_sendto(s,ptr,len,0,addr,16);
    try {
      assert.strictEqual(wat.test_call_send(s,p,9,0),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10057);
      assert.strictEqual(send(),9);assert.strictEqual(receiver.pending,1);
      const frame=Buffer.from(receiver.peek()),ip=frame.subarray(28);
      assert.strictEqual(frame.readUInt32LE(4),9);assert.strictEqual(frame.readUInt32LE(8),0x0a000001);
      assert.strictEqual(frame.readUInt32LE(12),0);assert.strictEqual(frame.readUInt32LE(16),0x0a000009);
      assert.strictEqual(frame.readUInt32LE(20),0);assert.strictEqual(frame.readUInt32LE(24),29);
      assert.strictEqual(ip[0],0x45);assert.strictEqual(ip.readUInt16BE(2),29);
      assert.strictEqual(ip.readUInt16BE(6),0x4000);assert.strictEqual(ip[8],64);assert.strictEqual(ip[9],1);
      assert.strictEqual(ip.readUInt32BE(12),0x0a000001);assert.strictEqual(ip.readUInt32BE(16),0x0a000009);
      assert.strictEqual(wat.test_checksum(buf(ip.subarray(0,20)),20),0);
      assert.deepStrictEqual(ip.subarray(20),body,'caller ICMP checksum and payload are preserved');receiver.commit();
      for(const [ptr,n,addr,error] of [[0,9,to,10014],[p,-1,to,10022],[p,7,to,10022],
        [p,4077,to,10040],[p,9,0,10014],[p,9,sockaddr('8.8.8.8',0),10051]]){
        assert.strictEqual(send(ptr,n,addr),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),error);
        assert.strictEqual(receiver.pending,0);
      }
      const large=buf(4076);assert.strictEqual(send(large,4076),4076);
      assert.strictEqual(receiver.peek().length,28+4096);receiver.commit();
      assert.throws(()=>wat.test_call_sendto(s,p,9,1,to,16),WebAssembly.RuntimeError);
      assert.strictEqual(receiver.pending,0);
      const originalSend=sender.send.bind(sender);sender.send=()=>false;
      assert.strictEqual(send(),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10035);
      setNonblocking(s,false);send();assert.strictEqual(wat.get_yield_reason(),8);
      sender.send=originalSend;assert.strictEqual(send(),9);assert.strictEqual(receiver.pending,1);
      receiver.commit();
      const echo=Buffer.from(body);echo.writeUInt16BE(wat.test_checksum(buf(echo),echo.length),2);
      assert.strictEqual(send(buf(echo),echo.length,sockaddr(ROOM_HOST,0)),9);
      assert.strictEqual(receiver.pending,0,'local echo never leaves the process');
      const output=buf(100);
      assert.strictEqual(wat.test_raw_recv(rawIndex,output,100,0,0),29);
      assert.strictEqual(readBuf(output+20,1)[0],8);
      assert.strictEqual(wat.test_raw_recv(rawIndex,output,100,0,0),29);
      assert.strictEqual(readBuf(output+20,1)[0],0);
      assert.strictEqual(wat.test_checksum(output+20,9),0);
      assert.deepStrictEqual(Buffer.from(readBuf(output+24,5)),echo.subarray(4));
      assert.strictEqual(wat.test_raw_ready(rawIndex),0,'echo reply does not loop');
      assert.strictEqual(wat.test_call_connect(s,to,16),0);assert.strictEqual(receiver.pending,0,'raw connect sends no SYN');
      const peer=buf(16),peerlen=buf([16,0,0,0]);
      assert.strictEqual(wat.test_call_getpeername(s,peer,peerlen),0);
      assert.strictEqual(Buffer.from(readBuf(peer,16)).readUInt32BE(4),0x0a000009);
      assert.strictEqual(wat.test_call_send(s,p,9,0),9);assert.strictEqual(receiver.pending,1);receiver.commit();
      const desc=buf(16),count=buf(4),dv=new DataView(memory.buffer),set=(ptr,n)=>dv.setUint32(wa(ptr),n,true);
      set(desc,4);set(desc+4,p);set(desc+8,5);set(desc+12,p+4);set(count,0x1234);
      let r=wat.test_wsasend(s,desc,2,count);assert.strictEqual(Number(BigInt.asIntN(32,r)),0);
      assert.strictEqual(dv.getUint32(wa(count),true),9);assert.strictEqual(receiver.pending,1);
      assert.deepStrictEqual(Buffer.from(receiver.peek()).subarray(48),body);receiver.commit();
      set(desc,4076);set(desc+4,large);set(desc+8,1);
      r=wat.test_wsasend(s,desc,2,count);assert.strictEqual(Number(BigInt.asIntN(32,r)),-1);
      assert.strictEqual(wat.test_call_WSAGetLastError(),10040);assert.strictEqual(receiver.pending,0,'oversize gather never splits');
      set(desc,4);set(desc+4,p);set(desc+8,5);sender.send=()=>false;set(count,0x1234);
      r=wat.test_wsasend(s,desc,2,count);assert.strictEqual(wat.get_yield_reason(),8);
      assert.strictEqual(Number(r>>32n),0x300000);assert.strictEqual(dv.getUint32(wa(count),true),0x1234);
      sender.send=originalSend;r=wat.test_wsasend(s,desc,2,count);
      assert.strictEqual(Number(BigInt.asIntN(32,r)),0);assert.strictEqual(receiver.pending,1);receiver.commit();
      assert.strictEqual(wat.test_call_connect(s,sockaddr('8.8.8.8',0),16),-1);
      assert.strictEqual(wat.test_call_send(s,p,9,0),9,'failed reconnect preserves old destination');receiver.commit();
      assert.strictEqual(wat.test_call_connect(s,sockaddr('10.0.0.8',0),16),0);
      assert.strictEqual(wat.test_call_send(s,p,9,0),9);assert.strictEqual(Buffer.from(receiver.peek()).readUInt32LE(16),0x0a000008);receiver.commit();
      wat.test_call_shutdown(s,SD_SEND);assert.strictEqual(wat.test_call_send(s,p,9,0),-1);
      assert.strictEqual(wat.test_call_WSAGetLastError(),10058);assert.strictEqual(receiver.pending,0,'raw shutdown sends no FIN');
    } finally {delete hostContext.vlanWire;wat.test_vsock_reset();}
  });

  check('WSASocket validates catalog selections and parks the full creation frame', () => {
    wat.test_vsock_reset();const value=r=>Number(BigInt.asIntN(32,r));
    assert.strictEqual(value(wat.test_wsasocket(0,2,1,6,0,0,0)),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10093);
    wat.test_wsa_startup(alloc(400));const n=buf(4),out=buf(2000),dv=new DataView(memory.buffer);
    for(const wide of [0,1]){
      dv.setUint32(wa(n),2000,true);wat.test_wsa_protocols(wide,0,out,n);
      for(let i=0;i<3;i++){const info=out+i*(wide?628:372),r=wat.test_wsasocket(wide,-1,-1,-1,info,0,0);assert(value(r)>0);assert.strictEqual(Number(r>>32n),0x30001c);assert.strictEqual(wat.test_call_closesocket(value(r)),0);}
      dv.setUint32(wa(out)+20,0,true);assert.strictEqual(value(wat.test_wsasocket(wide,-1,-1,-1,out,0,0)),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10022);
    }
    assert.strictEqual(value(wat.test_wsasocket(0,2,1,6,1,0,0)),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10014);
    for(const [group,flags] of [[1,0],[0,2]]){assert.strictEqual(value(wat.test_wsasocket(0,2,1,6,0,group,flags)),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10022);}
    let probes=0;hostContext.openLanLink=()=>{probes++;return true;};
    for(const wide of [0,1]){
      const raw=value(wat.test_wsasocket(wide,2,3,1,0,0,1));assert(raw>0);assert.strictEqual(wat.test_socket_attribute(raw),64);
      assert.throws(()=>wat.test_wsarecv(raw,0,0,0,0,1),WebAssembly.RuntimeError,'unimplemented operation must not falsely complete');
      wat.test_call_closesocket(raw);
      const plain=value(wat.test_wsasocket(wide,2,3,1,0,0,0));assert.strictEqual(wat.test_socket_attribute(plain),0,'reused slot clears creation attribute');wat.test_call_closesocket(plain);
      assert.strictEqual(value(wat.test_wsasocket(wide,2,3,6,0,0,0)),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10043);
      assert.strictEqual(value(wat.test_wsasocket(wide,2,4,0,0,0,0)),-1);assert.strictEqual(wat.test_call_WSAGetLastError(),10044);
      assert.strictEqual(value(wat.test_wsasocket(wide,99,1,6,0,0,1)),-1);
      assert.strictEqual(wat.test_call_WSAGetLastError(),10047);
      const tcp=value(wat.test_wsasocket(wide,2,1,6,0,0,1));assert(tcp>0);assert.strictEqual(wat.test_socket_attribute(tcp),64);
      assert.strictEqual(wat.test_call_bind(tcp,sockaddr(ROOM_HOST,8035+wide),16),0);assert.strictEqual(wat.test_call_listen(tcp,1),0);
      const client=wat.test_call_socket(2,1,6);assert.strictEqual(wat.test_call_connect(client,sockaddr(ROOM_HOST,8035+wide),16),0);
      const accepted=wat.test_call_accept(tcp,0,0);assert(accepted>0);assert.strictEqual(wat.test_socket_attribute(accepted),64);
      for(const h of [client,accepted,tcp])wat.test_call_closesocket(h);
    }
    assert.strictEqual(probes,8,'only successfully validated allocations open lobby');delete hostContext.openLanLink;
    let calls=0;hostContext.openLanLink=()=>{calls++;return false;};const r=wat.test_wsasocket(0,0,2,17,0,0,0);assert.strictEqual(wat.get_yield_reason(),8);assert.strictEqual(Number(r>>32n),0x300000);assert.strictEqual(calls,1);
    hostContext.openLanLink=()=>true;const opened=wat.test_wsasocket(0,0,2,17,0,0,0);assert(value(opened)>0);assert.strictEqual(Number(opened>>32n),0x30001c);wat.test_call_closesocket(value(opened));delete hostContext.openLanLink;
  });

  check('network event APIs report real TCP read, write and close readiness', () => {
    for (const name of ['WSAEventSelect','WSAEnumNetworkEvents']) assert(require('../src/api_table.json').some(a=>a.name===name),name);
    wat.test_vsock_reset();
    wat.test_wsa_startup(alloc(400));
    const {srv,cli,acc} = connectedPair();
    const event = Number(wat.test_wsa_create_event() & 0xffffffffn), out=alloc(44);
    const view=new DataView(memory.buffer,wa(out),44);
    const select=(s,mask)=>wat.test_wsa_network_event(0,s,event,mask);
    const enumerate=(s,ev=event)=>wat.test_wsa_network_event(1,s,ev,out);
    assert.strictEqual(select(acc,0x23),0);
    assert.strictEqual(enumerate(acc),0);
    assert.strictEqual(view.getUint32(0,true),2,'connected socket initially writable');
    assert.strictEqual(wat.test_call_send(cli,buf([1,2,3]),3,0),3);
    assert.strictEqual(imports.host.wait_single(event,0),0);
    assert.strictEqual(sibling.test_wsa_network_event(1,acc,event,out),0);
    assert.strictEqual(view.getUint32(0,true),1,'read event crosses instance');
    assert.strictEqual(imports.host.wait_single(event,0),258);
    assert.strictEqual(wat.test_call_recv(acc,buf(1),1,0),1);
    assert.strictEqual(enumerate(acc),0);
    assert.strictEqual(view.getUint32(0,true),1,'partial recv reenables read');
    assert.strictEqual(wat.test_call_closesocket(cli),0);
    assert.strictEqual(enumerate(acc,0x12345678),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10022);
    assert.strictEqual(enumerate(acc),0);
    assert.strictEqual(view.getUint32(0,true),32);
    assert.strictEqual(view.getUint32(24,true),10054);
    assert.strictEqual(wat.test_call_WSAAsyncSelect(acc,0,0,0),0);
    assert.strictEqual(enumerate(acc),0);
    assert.strictEqual(view.getUint32(0,true),0);
    wat.test_call_closesocket(acc); wat.test_call_closesocket(srv);
    assert.strictEqual(enumerate(acc),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10038);
    wat.test_wsa_close_event(event); wat.test_wsa_cleanup();
  });

  check('network FD_WRITE rearms only after a would-block send', () => {
    wat.test_vsock_reset(); wat.test_wsa_startup(alloc(400));
    const {srv,cli,acc}=connectedPair();
    const ev=Number(wat.test_wsa_create_event() & 0xffffffffn),out=alloc(44);
    const mask=()=>new DataView(memory.buffer,wa(out),44).getUint32(0,true);
    const enumerate=()=>wat.test_wsa_network_event(1,cli,ev,out);
    assert.strictEqual(wat.test_wsa_network_event(0,cli,ev,2),0);
    enumerate(); assert.strictEqual(mask(),2);
    const payload=buf(100000);
    assert(wat.test_call_send(cli,payload,100000,0)>0);
    assert.strictEqual(wat.test_call_send(cli,payload,1,0),-1);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10035);
    assert.strictEqual(wat.test_call_recv(acc,buf(1),1,0),1);
    enumerate(); assert.strictEqual(mask(),2);
    wat.test_call_recv(acc,buf(1),1,0);
    enumerate(); assert.strictEqual(mask(),0,'read without another blocked send emits no write event');
    wat.test_wsa_close_event(ev); wat.test_wsa_cleanup();
  });
  check('accepted sockets inherit event selection and close cancels it', () => {
    wat.test_vsock_reset(); wat.test_wsa_startup(alloc(400));
    const srv=wat.test_call_socket(AF_INET,SOCK_STREAM,0);
    wat.test_call_bind(srv,sockaddr('0.0.0.0',GAME_PORT),16); wat.test_call_listen(srv,5);
    const ev=Number(wat.test_wsa_create_event() & 0xffffffffn),out=alloc(44);
    const mask=()=>new DataView(memory.buffer,wa(out),44).getUint32(0,true);
    assert.strictEqual(wat.test_wsa_network_event(0,srv,ev,11),0);
    const cli=wat.test_call_socket(AF_INET,SOCK_STREAM,0);
    assert.strictEqual(wat.test_call_connect(cli,sockaddr(ROOM_HOST,GAME_PORT),16),0);
    assert.strictEqual(wat.test_wsa_network_event(1,srv,ev,out),0); assert.strictEqual(mask(),8);
    const acc=wat.test_call_accept(srv,0,0);
    assert(acc>0);
    assert.strictEqual(wat.test_wsa_network_event(1,acc,ev,out),0); assert.strictEqual(mask(),2);
    wat.test_call_send(cli,buf([4]),1,0);
    assert.strictEqual(wat.test_wsa_network_event(1,acc,ev,out),0); assert.strictEqual(mask(),1);
    wat.test_call_closesocket(acc);
    const replacement=wat.test_call_socket(AF_INET,SOCK_STREAM,0);
    assert.strictEqual(wat.test_wsa_network_event(1,replacement,ev,out),0); assert.strictEqual(mask(),0);
    wat.test_wsa_close_event(ev); wat.test_wsa_cleanup();
  });

  check('WSAConnect is registered with seven arguments', () => {
    const api = require('../src/api_table.json').find(api => api.name === 'WSAConnect');
    assert(api, 'WSAConnect must resolve by name');
    assert.strictEqual(api.nargs, 7);
  });
  const wsaStack = alloc(64);
  function wsaConnect(s, addr, caller=0, callee=0, sqos=0, gqos=0) {
    const v=wat.test_wsaconnect(wsaStack,s,addr,caller,callee,sqos,gqos);
    assert.strictEqual(Number(v >> 32n), wsaStack+32, 'WSAConnect pops all seven args');
    return Number(v & 0xffffffffn)|0;
  }
  check('WSAConnect provider errors preserve the socket and stack', () => {
    const s=wat.test_call_socket(AF_INET,SOCK_STREAM,0)|0, addr=sockaddr(ROOM_HOST,GAME_PORT);
    for(const [args,error] of [ [[-1,addr],10038], [[s,addr,0,0,0,1],10022],
      [[s,addr,0,0,1,0],10045], [[s,addr,1],10043] ]) {
      assert.strictEqual(wsaConnect(...args),SOCKET_ERROR);
      assert.strictEqual(wat.test_call_WSAGetLastError(),error);
    }
    assert.strictEqual(wsaConnect(s,addr),SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError(),WSAECONNREFUSED);
    wat.test_call_closesocket(s);
  });
  check('WSAConnect establishes TCP and reports no callee data', () => {
    const srv=wat.test_call_socket(AF_INET,SOCK_STREAM,0)|0;
    assert.strictEqual(wat.test_call_bind(srv,sockaddr('0.0.0.0',GAME_PORT),16),0);
    assert.strictEqual(wat.test_call_listen(srv,5),0);
    const cli=wat.test_call_socket(AF_INET,SOCK_STREAM,0)|0, data=alloc(8);
    new DataView(memory.buffer).setUint32(wa(data),123,true);
    assert.strictEqual(wsaConnect(cli,sockaddr(ROOM_HOST,GAME_PORT),0,data),0);
    assert.strictEqual(new DataView(memory.buffer).getUint32(wa(data),true),0);
    const acc=wat.test_call_accept(srv,0,0)|0;
    assert.notStrictEqual(acc,INVALID_SOCKET);
    assert.strictEqual(wsaConnect(cli,sockaddr(ROOM_HOST,GAME_PORT)),SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError(),10056);
    for(const s of [cli,acc,srv])wat.test_call_closesocket(s);
  });
  check('WSAConnect blocking retries retain the complete seven-argument frame', () => {
    const s=wat.test_call_socket(AF_INET,SOCK_STREAM,0)|0, addr=sockaddr('10.0.0.2',GAME_PORT);
    for(let n=0;n<3;n++) {
      const v=wat.test_wsaconnect(wsaStack,s,addr,0,0,0,0);
      assert.strictEqual(Number(v >> 32n),wsaStack,'park restores original ESP');
      assert.strictEqual(wat.get_yield_reason(),8,'waiting for virtual wire');
    }
    setNonblocking(s,true);
    assert.strictEqual(wsaConnect(s,addr),SOCKET_ERROR);
    assert([10035,10037].includes(wat.test_call_WSAGetLastError()));
    wat.test_call_closesocket(s);
  });

  check('WSAIsBlocking reports no nested blocking hook', () => {
    assert.strictEqual(wat.test_call_WSAIsBlocking() | 0, 0);
  });
  check('WSAIsBlocking is name-resolvable and dispatched with its zero-argument ABI', () => {
    const api = require('../src/api_table.json').find(api => api.name === 'WSAIsBlocking');
    assert(api, 'WSAIsBlocking must be registered, not only directly testable');
    assert.strictEqual(api.nargs, 0);
    assert.strictEqual(wat.test_wsa_is_blocking_lookup(), api.id);
    const result = wat.test_wsa_is_blocking_dispatch();
    assert.strictEqual(Number(result & 0xffffffffn), 0);
    assert.strictEqual(Number(result >> 32n), 0x00300004);
  });

  check('htons/ntohs swap 16-bit values', () => {
    assert.strictEqual(wat.test_call_htons(8035) | 0, 0x631f);  // 0x1f63 swapped
    assert.strictEqual(wat.test_call_ntohs(0x6331) | 0, 0x3163);
    for (const value of [0, 1, 0xff, 0x1234, 0x8001, 0xffff]) {
      const hostToNetwork = wat.test_call_htons(value) & 0xffff;
      const networkToHost = wat.test_call_ntohs(value) & 0xffff;
      assert.strictEqual(networkToHost, hostToNetwork,
        `both directions use the same Intel/network byte swap for 0x${value.toString(16)}`);
      assert.strictEqual(wat.test_call_ntohs(hostToNetwork) & 0xffff, value,
        `ntohs reverses htons for 0x${value.toString(16)}`);
    }
  });

  check('inet_addr parses dotted quads in network order', () => {
    assert.strictEqual(wat.test_call_inet_addr(cstr('10.77.0.1')) >>> 0, 0x01004d0a);
    assert.strictEqual(wat.test_call_inet_addr(cstr('127.0.0.1')) >>> 0, 0x0100007f);
    assert.strictEqual(wat.test_call_inet_addr(cstr('0.0.0.0')) >>> 0, 0);
  });

  // Winsock's inet_addr widens the LAST part to fill whatever octets the
  // text left out, which is the whole reason a person can type four
  // characters into a game's host-IP box instead of eleven.
  check('inet_addr accepts the short forms real Winsock accepts', () => {
    assert.strictEqual(wat.test_call_inet_addr(cstr('10.1')) >>> 0, 0x0100000a,
      '"10.1" is 10.0.0.1: the last part fills the low 24 bits');
    assert.strictEqual(wat.test_call_inet_addr(cstr('10.0.1')) >>> 0, 0x0100000a,
      '"10.0.1" is 10.0.0.1: the last part fills the low 16 bits');
    assert.strictEqual(wat.test_call_inet_addr(cstr('127.1')) >>> 0, 0x0100007f);
    assert.strictEqual(wat.test_call_inet_addr(cstr('10.77.0')) >>> 0, 0x00004d0a,
      '"10.77.0" is 10.77.0.0, not a malformed quad');
    // The widened part is one number, not octets: 10.258 carries into the
    // third byte the way the C library does it.
    assert.strictEqual(wat.test_call_inet_addr(cstr('10.258')) >>> 0, 0x0201000a);
    assert.strictEqual(wat.test_call_inet_addr(cstr('10.16777215')) >>> 0, 0xffffff0a);
  });

  check('inet_addr rejects malformed input with INADDR_NONE', () => {
    // A leading part is still one octet however short the text is, the
    // widened part still has a ceiling, and the bare "a" form stays out —
    // a number with no dots in a host box is a mistake, not an address.
    for (const bad of ['10.77.0.1.2', '10.77.0.256', 'localhost', '', '10..0.1',
      '256.1', '10.16777216', '10.0.65536', '10', '0x0a.1', '10.1.']) {
      assert.strictEqual(wat.test_call_inet_addr(cstr(bad)) | 0, -1, `expected failure for "${bad}"`);
    }
  });

  check('inet_ntoa round-trips through inet_addr', () => {
    for (const ip of ['10.77.0.1', '10.77.0.254', '127.0.0.1', '0.0.0.0']) {
      const net = wat.test_call_inet_addr(cstr(ip)) >>> 0;
      assert.strictEqual(readCstr(wat.test_call_inet_ntoa(net) >>> 0), ip);
    }
  });

  check('gethostbyname resolves numeric room addresses only', () => {
    const he = wat.test_call_gethostbyname(cstr(ROOM_HOST)) >>> 0;
    assert(he, 'expected a hostent for a numeric address');
    const v = new DataView(memory.buffer, wa(he), 16);
    assert.strictEqual(v.getUint16(8, true), AF_INET);
    assert.strictEqual(v.getUint16(10, true), 4);
    const list = v.getUint32(12, true) >>> 0;
    const addrPtr = new DataView(memory.buffer, wa(list), 8).getUint32(0, true) >>> 0;
    // Network order, derived from ROOM_HOST rather than written out, so the
    // room can move without this becoming a puzzle.
    const hostBytes = ROOM_HOST.split('.').map(Number);
    const hostNet = new DataView(new Uint8Array(hostBytes).buffer).getUint32(0, true) >>> 0;
    assert.strictEqual(new DataView(memory.buffer, wa(addrPtr), 4).getUint32(0, true) >>> 0, hostNet);
    assert.strictEqual(readCstr(v.getUint32(0, true) >>> 0), ROOM_HOST);
    assert.strictEqual(wat.test_call_gethostbyname(cstr('liquidwar.example')) | 0, 0);
  });

  // ---- socket creation and validation --------------------------------

  check('socket accepts UDP and rejects unsupported families and types', () => {
    wat.test_vsock_reset();
    assert.strictEqual(wat.test_call_socket(23, SOCK_STREAM, 0) | 0, INVALID_SOCKET);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAEAFNOSUPPORT);
    assert.notStrictEqual(wat.test_call_socket(AF_INET, SOCK_DGRAM, 17) | 0, INVALID_SOCKET);
    assert.strictEqual(wat.test_call_socket(AF_INET, 4, 0) | 0, INVALID_SOCKET);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAESOCKTNOSUPPORT);
  });

  check('operations on a non-socket handle report WSAENOTSOCK', () => {
    wat.test_vsock_reset();
    for (const bogus of [0, 1, 0x70000002, 0x53000005]) {
      assert.strictEqual(wat.test_call_listen(bogus, 5) | 0, SOCKET_ERROR);
      assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAENOTSOCK);
    }
  });

  check('a closed handle stops being a socket', () => {
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(wat.test_call_closesocket(s) | 0, 0);
    assert.strictEqual(wat.test_call_closesocket(s) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAENOTSOCK);
  });

  // ---- addressing and isolation --------------------------------------

  check('bind refuses addresses outside the room', () => {
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(wat.test_call_bind(s, sockaddr('192.168.1.10', GAME_PORT), 16) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAEADDRNOTAVAIL);
  });

  check('connect to an address outside the room is unreachable', () => {
    wat.test_vsock_reset();
    for (const ip of ['8.8.8.8', '192.168.1.10', '169.254.1.1', '172.16.0.1']) {
      const s = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
      assert.strictEqual(wat.test_call_connect(s, sockaddr(ip, GAME_PORT), 16) | 0, SOCKET_ERROR,
        `expected ${ip} to be unroutable`);
      assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAENETUNREACH);
    }
  });

  check('a second bind to the same port reports WSAEADDRINUSE', () => {
    wat.test_vsock_reset();
    const a = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    const b = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(wat.test_call_bind(a, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, 0);
    assert.strictEqual(wat.test_call_bind(b, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAEADDRINUSE);
  });

  check('TCP and UDP bind the same port number independently', () => {
    // Jazz Jackrabbit 2's server binds UDP 10052 and then TCP 10052; a shared
    // port space failed the second with WSAEADDRINUSE ("Could not start Server").
    wat.test_vsock_reset();
    const u = wat.test_call_socket(AF_INET, SOCK_DGRAM, 0) | 0;
    const t = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(wat.test_call_bind(u, sockaddr('0.0.0.0', 10052), 16) | 0, 0);
    assert.strictEqual(wat.test_call_bind(t, sockaddr('0.0.0.0', 10052), 16) | 0, 0,
      'a stream socket may take the port a datagram socket holds');
    const u2 = wat.test_call_socket(AF_INET, SOCK_DGRAM, 0) | 0;
    assert.strictEqual(wat.test_call_bind(u2, sockaddr('0.0.0.0', 10052), 16) | 0, SOCKET_ERROR,
      'a second datagram socket on that port still collides');
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAEADDRINUSE);
  });

  check('port 0 allocates from the room ephemeral range', () => {
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(wat.test_call_bind(s, sockaddr(ROOM_HOST, 0), 16) | 0, 0);
    assert.strictEqual(wat.test_call_listen(s, 1) | 0, 0);
    const c = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(c, true);
    // The listener took an ephemeral port, so the fixed game port is free.
    assert.strictEqual(wat.test_call_connect(c, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAECONNREFUSED);
  });

  // ---- listener lifecycle ---------------------------------------------

  check('listen requires a bound socket', () => {
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(wat.test_call_listen(s, 5) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAEINVAL);
  });

  check('connect with no listener is refused', () => {
    wat.test_vsock_reset();
    const c = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(c, true);
    assert.strictEqual(wat.test_call_connect(c, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAECONNREFUSED);
  });

  check('backlog is enforced and clamped', () => {
    wat.test_vsock_reset();
    const srv = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    wat.test_call_bind(srv, sockaddr(ROOM_HOST, GAME_PORT), 16);
    assert.strictEqual(wat.test_call_listen(srv, 2) | 0, 0);
    const conns = [];
    for (let i = 0; i < 2; i++) {
      const c = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
      setNonblocking(c, true);
      assert.strictEqual(wat.test_call_connect(c, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, 0);
      conns.push(c);
    }
    const overflow = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(overflow, true);
    assert.strictEqual(wat.test_call_connect(overflow, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAECONNREFUSED);
    // Draining one slot makes room again.
    assert.notStrictEqual(wat.test_call_accept(srv, 0, 0) | 0, INVALID_SOCKET);
    assert.strictEqual(wat.test_call_connect(overflow, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, 0);
  });

  check('accept reports the connecting peer address', () => {
    wat.test_vsock_reset();
    const srv = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    wat.test_call_bind(srv, sockaddr(ROOM_HOST, GAME_PORT), 16);
    wat.test_call_listen(srv, 4);
    const cli = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    const cliAddr = sockaddr(ROOM_HOST, 51000);
    assert.strictEqual(wat.test_call_bind(cli, cliAddr, 16) | 0, 0);
    assert.strictEqual(wat.test_call_connect(cli, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, 0);

    const out = alloc(16);
    const outLen = alloc(4);
    new DataView(memory.buffer, wa(outLen), 4).setUint32(0, 16, true);
    const acc = wat.test_call_accept(srv, out, outLen) | 0;
    assert.notStrictEqual(acc, INVALID_SOCKET);
    assert.deepStrictEqual(readSockaddr(out), { family: AF_INET, port: 51000, ip: ROOM_HOST });
    assert.strictEqual(new DataView(memory.buffer, wa(outLen), 4).getUint32(0, true), 16);
  });

  check('accept on an empty nonblocking backlog would block', () => {
    wat.test_vsock_reset();
    const srv = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(srv, true);
    wat.test_call_bind(srv, sockaddr(ROOM_HOST, GAME_PORT), 16);
    wat.test_call_listen(srv, 4);
    assert.strictEqual(wat.test_call_accept(srv, 0, 0) | 0, INVALID_SOCKET);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAEWOULDBLOCK);
  });

  // ---- byte stream semantics ------------------------------------------

  check('send and recv move bytes in both directions', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    const msg = [...Buffer.from('LIQUIDWAR-HELLO')];
    const src = buf(msg);
    assert.strictEqual(wat.test_call_send(cli, src, msg.length, 0) | 0, msg.length);
    const dst = buf(64);
    assert.strictEqual(wat.test_call_recv(acc, dst, 64, 0) | 0, msg.length);
    assert.deepStrictEqual(readBuf(dst, msg.length), msg);

    const reply = [...Buffer.from('OK')];
    assert.strictEqual(wat.test_call_send(acc, buf(reply), reply.length, 0) | 0, reply.length);
    const back = buf(8);
    assert.strictEqual(wat.test_call_recv(cli, back, 8, 0) | 0, reply.length);
    assert.deepStrictEqual(readBuf(back, reply.length), reply);
  });

  check('the stream has no message boundaries', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    // Three sends, one recv: the reader sees one run of bytes.
    for (const part of ['aaa', 'bb', 'cccc']) {
      const d = [...Buffer.from(part)];
      assert.strictEqual(wat.test_call_send(cli, buf(d), d.length, 0) | 0, d.length);
    }
    const dst = buf(64);
    assert.strictEqual(wat.test_call_recv(acc, dst, 64, 0) | 0, 9);
    assert.strictEqual(Buffer.from(readBuf(dst, 9)).toString(), 'aaabbcccc');

    // One send, byte-at-a-time recv: the reader chooses the split.
    const payload = [...Buffer.from('fragmented')];
    assert.strictEqual(wat.test_call_send(cli, buf(payload), payload.length, 0) | 0, payload.length);
    let got = '';
    for (let i = 0; i < payload.length; i++) {
      const one = buf(1);
      assert.strictEqual(wat.test_call_recv(acc, one, 1, 0) | 0, 1);
      got += Buffer.from(readBuf(one, 1)).toString();
    }
    assert.strictEqual(got, 'fragmented');
  });

  check('send reports a partial count when the peer buffer fills', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    const big = 16384 + 4096;
    const src = alloc(big);
    for (let i = 0; i < big; i++) bytes[wa(src) + i] = i & 0xff;
    const first = wat.test_call_send(cli, src, big, 0) | 0;
    assert(first > 0 && first < big, `expected a partial send, got ${first}`);
    // The accepted prefix must be exact, so draining it and resending the
    // remainder reconstructs the original bytes.
    const drain = alloc(big);
    let total = 0;
    while (total < first) {
      const n = wat.test_call_recv(acc, drain + total, first - total, 0) | 0;
      assert(n > 0);
      total += n;
    }
    assert.strictEqual(total, first);
    for (let i = 0; i < first; i++) {
      assert.strictEqual(bytes[wa(drain) + i], i & 0xff, `byte ${i} corrupted`);
    }
    // Once drained the socket accepts more.
    assert(wat.test_call_send(cli, src, big - first, 0) | 0 > 0);
  });

  check('recv on an empty nonblocking socket would block', () => {
    wat.test_vsock_reset();
    const { acc } = connectedPair();
    assert.strictEqual(wat.test_call_recv(acc, buf(16), 16, 0) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAEWOULDBLOCK);
  });

  check('FIONREAD reports queued bytes', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    const p = alloc(4);
    const view = new DataView(memory.buffer, wa(p), 4);
    assert.strictEqual(wat.test_call_ioctlsocket(acc, FIONREAD, p) | 0, 0);
    assert.strictEqual(view.getUint32(0, true), 0);
    wat.test_call_send(cli, buf([1, 2, 3, 4, 5]), 5, 0);
    assert.strictEqual(wat.test_call_ioctlsocket(acc, FIONREAD, p) | 0, 0);
    assert.strictEqual(view.getUint32(0, true), 5);
  });

  // ---- half close, EOF, reset -----------------------------------------

  check('shutdown(SD_SEND) delivers an orderly EOF after buffered bytes', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    const d = [...Buffer.from('tail')];
    wat.test_call_send(cli, buf(d), d.length, 0);
    assert.strictEqual(wat.test_call_shutdown(cli, SD_SEND) | 0, 0);
    // Buffered data still arrives before the EOF.
    const dst = buf(16);
    assert.strictEqual(wat.test_call_recv(acc, dst, 16, 0) | 0, 4);
    assert.strictEqual(wat.test_call_recv(acc, dst, 16, 0) | 0, 0);
    assert.strictEqual(wat.test_call_recv(acc, dst, 16, 0) | 0, 0, 'EOF must be sticky');
    // The reverse direction stays usable after a half close.
    assert.strictEqual(wat.test_call_send(acc, buf([9]), 1, 0) | 0, 1);
    assert.strictEqual(wat.test_call_recv(cli, dst, 16, 0) | 0, 1);
  });

  check('closing with the write half open resets the peer', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    assert.strictEqual(wat.test_call_closesocket(cli) | 0, 0);
    assert.strictEqual(wat.test_call_recv(acc, buf(16), 16, 0) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAECONNRESET);
  });

  check('closing after shutdown is an orderly EOF, not a reset', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    wat.test_call_shutdown(cli, SD_SEND);
    assert.strictEqual(wat.test_call_closesocket(cli) | 0, 0);
    assert.strictEqual(wat.test_call_recv(acc, buf(16), 16, 0) | 0, 0);
  });

  check('a reset surfaces after buffered bytes are drained', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    wat.test_call_send(cli, buf([7, 7, 7]), 3, 0);
    wat.test_call_closesocket(cli);
    const dst = buf(16);
    assert.strictEqual(wat.test_call_recv(acc, dst, 16, 0) | 0, 3, 'queued bytes survive the reset');
    assert.strictEqual(wat.test_call_recv(acc, dst, 16, 0) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAECONNRESET);
  });

  check('send after the peer is gone reports WSAECONNRESET', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    wat.test_call_closesocket(acc);
    assert.strictEqual(wat.test_call_send(cli, buf([1]), 1, 0) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAECONNRESET);
  });

  // ---- select ----------------------------------------------------------

  check('select reports a listener with a pending connection as readable', () => {
    wat.test_vsock_reset();
    const srv = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(srv, true);
    wat.test_call_bind(srv, sockaddr(ROOM_HOST, GAME_PORT), 16);
    wat.test_call_listen(srv, 4);

    let set = fdset([srv]);
    assert.strictEqual(wat.test_call_select(0, set, 0, 0, timeval(0, 0)) | 0, 0);
    assert.deepStrictEqual(fdsetList(set), []);

    const cli = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(cli, true);
    wat.test_call_connect(cli, sockaddr(ROOM_HOST, GAME_PORT), 16);

    set = fdset([srv]);
    assert.strictEqual(wat.test_call_select(0, set, 0, 0, timeval(0, 0)) | 0, 1);
    assert.deepStrictEqual(fdsetList(set), [srv]);
    assert.strictEqual(wat.test_call___WSAFDIsSet(srv, set) | 0, 1);
  });

  check('select rewrites each set to only ready handles', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    const idle = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(idle, true);
    wat.test_call_send(cli, buf([1, 2]), 2, 0);

    const set = fdset([idle, acc, cli]);
    assert.strictEqual(wat.test_call_select(0, set, 0, 0, timeval(0, 0)) | 0, 1);
    assert.deepStrictEqual(fdsetList(set), [acc]);
    assert.strictEqual(wat.test_call___WSAFDIsSet(acc, set) | 0, 1);
    assert.strictEqual(wat.test_call___WSAFDIsSet(cli, set) | 0, 0);
    assert.strictEqual(wat.test_call___WSAFDIsSet(idle, set) | 0, 0);
  });

  check('select counts ready handles across all three sets', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    wat.test_call_send(cli, buf([1]), 1, 0);
    const r = fdset([acc, cli]);
    const w = fdset([acc, cli]);
    const e = fdset([acc, cli]);
    // acc is readable; both halves are writable; neither is in error.
    assert.strictEqual(wat.test_call_select(0, r, w, e, timeval(0, 0)) | 0, 3);
    assert.deepStrictEqual(fdsetList(r), [acc]);
    assert.deepStrictEqual(fdsetList(w), [acc, cli]);
    assert.deepStrictEqual(fdsetList(e), []);
  });

  check('an EOF socket is readable, and a full peer is not writable', () => {
    wat.test_vsock_reset();
    const { cli, acc } = connectedPair();
    wat.test_call_shutdown(cli, SD_SEND);
    let set = fdset([acc]);
    assert.strictEqual(wat.test_call_select(0, set, 0, 0, timeval(0, 0)) | 0, 1,
      'an orderly EOF must be read-ready');

    // Fill the peer receive ring so the writer stops being write-ready.
    const chunk = alloc(16384);
    let sent = 0;
    for (let i = 0; i < 8; i++) {
      const n = wat.test_call_send(acc, chunk, 16384, 0) | 0;
      if (n <= 0) break;
      sent += n;
    }
    assert(sent > 0);
    set = fdset([acc]);
    assert.strictEqual(wat.test_call_select(0, 0, set, 0, timeval(0, 0)) | 0, 0,
      'a writer whose peer ring is full must not be write-ready');
  });

  check('select ignores handles that are not sockets', () => {
    wat.test_vsock_reset();
    const set = fdset([0x70000002, 0, 0x53000030]);
    assert.strictEqual(wat.test_call_select(0, set, 0, 0, timeval(0, 0)) | 0, 0);
    assert.deepStrictEqual(fdsetList(set), []);
  });

  // ---- socket options ---------------------------------------------------

  check('setsockopt accepts the options Liquid War uses', () => {
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    const val = alloc(4);
    new DataView(memory.buffer, wa(val), 4).setUint32(0, 1, true);
    assert.strictEqual(wat.test_call_setsockopt(s, 0xffff, 0x0004, val, 4) | 0, 0, 'SO_REUSEADDR');
    assert.strictEqual(wat.test_call_setsockopt(s, 6, 1, val, 4) | 0, 0, 'TCP_NODELAY');
    assert.strictEqual(wat.test_call_setsockopt(s, 0xffff, 0x1234, val, 4) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, 10042, 'WSAENOPROTOOPT');
  });

  check('setsockopt enables UDP broadcast', () => {
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_DGRAM, 17) | 0;
    const val = alloc(4);
    new DataView(memory.buffer, wa(val), 4).setUint32(0, 1, true);
    assert.strictEqual(
      wat.test_call_setsockopt(s, 0xffff, 0x0020, val, 4) | 0,
      0,
      'SO_BROADCAST',
    );
  });

  check('getsockopt reports the effective UDP receive buffer', () => {
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_DGRAM, 17) | 0;
    const val = alloc(4);
    const len = alloc(4);
    const valueView = new DataView(memory.buffer, wa(val), 4);
    const lenView = new DataView(memory.buffer, wa(len), 4);
    lenView.setUint32(0, 4, true);
    assert.strictEqual(wat.test_call_getsockopt(s, 0xffff, 0x1002, val, len) | 0, 0);
    assert.strictEqual(valueView.getUint32(0, true), 16384, 'SO_RCVBUF');
    assert.strictEqual(lenView.getUint32(0, true), 4, 'integer option length');
  });

  check('getsockname reports a UDP socket bound to a wildcard address', () => {
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_DGRAM, 17) | 0;
    assert.strictEqual(wat.test_call_bind(s, sockaddr('0.0.0.0', 7787), 16) | 0, 0);
    const name = alloc(16);
    const len = alloc(4);
    new DataView(memory.buffer, wa(len), 4).setUint32(0, 16, true);
    assert.strictEqual(wat.test_call_getsockname(s, name, len) | 0, 0);
    assert.deepStrictEqual(readSockaddr(name), { family: AF_INET, port: 7787, ip: ROOM_HOST });
  });

  check('ioctlsocket rejects unsupported commands', () => {
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(wat.test_call_ioctlsocket(s, 0x1234, alloc(4)) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAEINVAL);
  });

  // ---- a full synthetic session ------------------------------------------

  check('a synthetic client and server complete a fragmented session', () => {
    wat.test_vsock_reset();
    const srv = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(srv, true);
    assert.strictEqual(wat.test_call_bind(srv, sockaddr('0.0.0.0', GAME_PORT), 16) | 0, 0);
    assert.strictEqual(wat.test_call_listen(srv, 6) | 0, 0);

    // Three clients join the room, as six-team Liquid War would.
    const clients = [];
    for (let i = 0; i < 3; i++) {
      const c = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
      setNonblocking(c, true);
      assert.strictEqual(wat.test_call_connect(c, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, 0);
      clients.push(c);
    }
    const set = fdset([srv]);
    assert.strictEqual(wat.test_call_select(0, set, 0, 0, timeval(0, 0)) | 0, 1);

    const served = [];
    for (let i = 0; i < 3; i++) {
      const a = wat.test_call_accept(srv, 0, 0) | 0;
      assert.notStrictEqual(a, INVALID_SOCKET);
      setNonblocking(a, true);
      served.push(a);
    }
    assert.strictEqual(wat.test_call_accept(srv, 0, 0) | 0, INVALID_SOCKET);

    // Every client sends a distinct message in one-byte fragments; the
    // server must reassemble each stream independently and in order.
    const messages = clients.map((_, i) => `client-${i}-payload`);
    const maxLen = Math.max(...messages.map(m => m.length));
    for (let off = 0; off < maxLen; off++) {
      clients.forEach((c, i) => {
        if (off >= messages[i].length) return;
        const one = buf([messages[i].charCodeAt(off)]);
        assert.strictEqual(wat.test_call_send(c, one, 1, 0) | 0, 1);
      });
    }
    served.forEach((a, i) => {
      const dst = buf(64);
      let total = 0;
      for (;;) {
        const n = wat.test_call_recv(a, dst + total, 64 - total, 0) | 0;
        if (n <= 0) break;
        total += n;
        if (total >= messages[i].length) break;
      }
      assert.strictEqual(Buffer.from(readBuf(dst, total)).toString(), messages[i]);
    });

    // The server answers each client, then closes the room down cleanly.
    served.forEach((a, i) => {
      const reply = [...Buffer.from(`ack-${i}`)];
      assert.strictEqual(wat.test_call_send(a, buf(reply), reply.length, 0) | 0, reply.length);
      assert.strictEqual(wat.test_call_shutdown(a, SD_SEND) | 0, 0);
    });
    clients.forEach((c, i) => {
      const dst = buf(32);
      const n = wat.test_call_recv(c, dst, 32, 0) | 0;
      assert.strictEqual(Buffer.from(readBuf(dst, n)).toString(), `ack-${i}`);
      assert.strictEqual(wat.test_call_recv(c, dst, 32, 0) | 0, 0, 'server EOF');
      assert.strictEqual(wat.test_call_closesocket(c) | 0, 0);
    });
    served.forEach(a => assert.strictEqual(wat.test_call_closesocket(a) | 0, 0));
    assert.strictEqual(wat.test_call_closesocket(srv) | 0, 0);
  });

  check('closing a listener drops its unaccepted backlog', () => {
    wat.test_vsock_reset();
    const srv = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    wat.test_call_bind(srv, sockaddr(ROOM_HOST, GAME_PORT), 16);
    wat.test_call_listen(srv, 4);
    const cli = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(cli, true);
    assert.strictEqual(wat.test_call_connect(cli, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, 0);
    assert.strictEqual(wat.test_call_closesocket(srv) | 0, 0);
    // The queued child never reached the application, so its peer resets.
    assert.strictEqual(wat.test_call_recv(cli, buf(8), 8, 0) | 0, SOCKET_ERROR);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, WSAECONNRESET);
  });

  // SimCity 2000 Network Edition's server accepts under the listener's
  // FD_ACCEPT-only mask and only then asks for FD_READ; the client's login is
  // already buffered, so registering has to announce it.
  check('WSAAsyncSelect announces conditions that already hold', () => {
    wat.test_vsock_reset();
    const { srv, cli, acc } = connectedPair();
    const msg = Buffer.from('login');
    assert.strictEqual(wat.test_call_send(cli, buf(msg), msg.length, 0) | 0, msg.length);
    const posted = () => {
      const out = [];
      for (let i = 0; i < (wat.get_post_queue_count() | 0); i++) {
        out.push({ msg: wat.post_queue_peek(i, 1) | 0, wParam: wat.post_queue_peek(i, 2) | 0,
          lParam: wat.post_queue_peek(i, 3) | 0 });
      }
      return out;
    };
    const hwnd = wat.test_make_window() | 0;
    wat.set_post_queue_count(0);
    assert.strictEqual(wat.test_call_WSAAsyncSelect(acc, hwnd, 0x501, 0x23) | 0, 0);
    const events = posted().filter(m => m.msg === 0x501 && m.wParam === acc).map(m => m.lParam);
    assert(events.includes(0x01), `pending data posts FD_READ (got ${events})`);
    assert(events.includes(0x02), `a connected socket posts FD_WRITE (got ${events})`);

    const cli2 = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    setNonblocking(cli2, true);
    assert.strictEqual(wat.test_call_connect(cli2, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, 0);
    wat.set_post_queue_count(0);
    assert.strictEqual(wat.test_call_WSAAsyncSelect(srv, hwnd, 0x501, 0x08) | 0, 0);
    assert(posted().some(m => m.msg === 0x501 && m.wParam === srv && m.lParam === 0x08),
      'a queued connection posts FD_ACCEPT');
    wat.set_post_queue_count(0);
  });

  check('WSAAsyncSelect registrations live in one process-wide table', () => {
    // Every guest thread is its own WASM instance over this memory. A
    // per-instance table lost the listener's registration when Jazz
    // Jackrabbit 2 accepted on its network thread, and the wire's FD_READ was
    // checked against the wrong instance's (empty) table. The table is found
    // through LOCK_TABLE+0x104, which every instance reads.
    wat.test_vsock_reset();
    const s = wat.test_call_socket(AF_INET, SOCK_DGRAM, 0) | 0;
    const hwnd = wat.test_make_window() | 0;
    assert.strictEqual(wat.test_call_WSAAsyncSelect(s, hwnd, 0x402, 0x03) | 0, 0);
    const slot = RegionMap.BASE.LOCK_TABLE + 0x104;
    const view = new DataView(memory.buffer);
    const table = view.getUint32(slot, true);
    assert(table, 'the table address is published in shared memory');
    const rec = wa(table + ((s >>> 0) - 0x53000000) * 12);
    assert.deepStrictEqual([view.getUint32(rec, true), view.getUint32(rec + 4, true), view.getUint32(rec + 8, true)],
      [hwnd >>> 0, 0x402, 0x03], 'the socket\'s slot holds {hWnd, wMsg, lEvent}');
    wat.set_post_queue_count(0);
  });

  check('closing a socket cancels notification ownership before slot reuse', () => {
    wat.test_vsock_reset();
    const { srv, cli, acc } = connectedPair();
    const hwnd = wat.test_make_window() | 0;
    assert.strictEqual(wat.test_call_WSAAsyncSelect(acc, hwnd, 0x502, 0x01) | 0, 0);
    assert.strictEqual(wat.test_call_closesocket(acc) | 0, 0);
    const replacement = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
    assert.strictEqual(replacement, acc, 'exercise the same recycled slot');
    setNonblocking(replacement, true);
    assert.strictEqual(wat.test_call_connect(replacement, sockaddr(ROOM_HOST, GAME_PORT), 16) | 0, 0);
    const sender = wat.test_call_accept(srv, 0, 0) | 0;
    assert(sender > 0);
    wat.set_post_queue_count(0);
    const payload = buf(Buffer.from('new owner'));
    assert.strictEqual(wat.test_call_send(sender, payload, 9, 0) | 0, 9);
    assert.strictEqual(wat.test_call_recv(replacement, buf(1), 1, 0) | 0, 1);
    assert.strictEqual(wat.get_post_queue_count() | 0, 0,
      'the new socket must not notify the closed socket window');
    assert.strictEqual(wat.test_call_WSAAsyncSelect(replacement, hwnd, 0x503, 0x01) | 0, 0);
    assert.strictEqual(wat.get_post_queue_count() | 0, 1, 'a new registration still reports pending data');
    assert.strictEqual(wat.post_queue_peek(0, 1) | 0, 0x503);
    wat.set_post_queue_count(0);
  });

  check('the socket table is bounded and recovers after close', () => {
    wat.test_vsock_reset();
    const open = [];
    for (;;) {
      const s = wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0;
      if (s === INVALID_SOCKET) break;
      open.push(s);
      assert(open.length <= 128, 'socket table must be bounded');
    }
    assert.strictEqual(open.length, 128);
    assert.strictEqual(wat.test_call_WSAGetLastError() | 0, 10024, 'WSAEMFILE');
    assert.strictEqual(wat.test_call_closesocket(open.pop()) | 0, 0);
    assert.notStrictEqual(wat.test_call_socket(AF_INET, SOCK_STREAM, 0) | 0, INVALID_SOCKET);
  });

  console.log(`\n${passed}/${passed} winsock checks passed`);
}

main().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});

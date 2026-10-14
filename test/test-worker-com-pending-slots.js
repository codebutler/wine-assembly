#!/usr/bin/env node
'use strict';

// COM activation from two guest threads at once (DLL-CONCURRENT-MAPPING).
//
// CoCreateInstance on a server that is not loaded yet is two host calls: the
// activation (com_create_instance answers CO_E_DLLNOTFOUND and records the
// server it needs) and then com_get_pending_dll, which hands that name back so
// the thread can park while the host loads it. The host kept ONE pending name
// for the whole process and wrote it into ONE shared scratch string, so a
// second thread's activation between a thread's two calls made it read -- and
// load, and retry against -- the other thread's server. The broker now keeps
// each slot's pending name, and the name is written into the caller's own
// buffer.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const RPC = require('../lib/guest-rpc');
const { createStorageImports } = require('../lib/storage');

const root = path.join(__dirname, '..');
const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
const bytes = () => new Uint8Array(memory.buffer);
const cstr = (wa) => { let s = ''; for (let i = wa; bytes()[i]; i++) s += String.fromCharCode(bytes()[i]); return s; };

// 1. The broker keeps each slot's pending name.
{
  const SERVERS = { 1: 'c:\\demo\\a\\server_a.dll', 2: 'c:\\demo\\b\\server_b.dll' };
  const state = { pending: null };
  const table = {
    com_create_instance: (clsid) => { state.pending = SERVERS[clsid]; return 0x800401F0 | 0; },
    com_get_pending_dll: (dest, cap) => {
      if (!state.pending) return 0;
      const n = Math.min(state.pending.length, cap - 1);
      for (let i = 0; i < n; i++) bytes()[dest + i] = state.pending.charCodeAt(i);
      bytes()[dest + n] = 0;
      return dest;
    },
  };
  Object.defineProperty(table, 'comPendingScope', {
    enumerable: false,
    value: { save: () => state.pending, restore: (v) => { state.pending = v; } },
  });
  const sigs = {
    com_create_instance: { params: ['i32', 'i32', 'i32', 'i32', 'i32'], results: ['i32'] },
    com_get_pending_dll: { params: ['i32', 'i32'], results: ['i32'] },
  };
  const broker = RPC.createMainBroker(memory, table, sigs, {});
  const workerFor = slot => RPC.createWorkerImports(memory, sigs, message => {
    if (message.t === 'rpc') broker.serveRpc(message.slot);
  }, { slot }).imports.host;
  const t0 = workerFor(0), t1 = workerFor(1);
  const BUF0 = 0x00500000, BUF1 = 0x00500200;
  // Thread 0 needs server A; before it asks for the name, thread 1 needs B.
  assert.strictEqual(t0.com_create_instance(1, 0, 0, 0, 0) | 0, 0x800401F0 | 0);
  assert.strictEqual(t1.com_create_instance(2, 0, 0, 0, 0) | 0, 0x800401F0 | 0);
  assert.strictEqual(t0.com_get_pending_dll(BUF0, 260) >>> 0, BUF0);
  assert.strictEqual(cstr(BUF0), SERVERS[1], 'thread 0 gets the server ITS activation needs, not thread 1\'s');
  assert.strictEqual(t1.com_get_pending_dll(BUF1, 260) >>> 0, BUF1);
  assert.strictEqual(cstr(BUF1), SERVERS[2], 'thread 1 gets its own');
  assert.strictEqual(cstr(BUF0), SERVERS[1], 'and thread 0\'s copy is untouched by thread 1\'s read');
}

// 2. storage.js writes the name into the caller's buffer, not shared scratch.
{
  const SCRATCH = 0x900;
  const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} } };
  const storage = createStorageImports(ctx);
  assert.ok(storage.comPendingScope, 'storage.js exposes the per-thread pending-name scope');
  assert.ok(!Object.keys(storage).includes('comPendingScope'), 'and not as an enumerable import');
  assert.strictEqual(storage.com_get_pending_dll(0x00501000, 260), 0, 'nothing pending: 0');
  for (let i = 0; i < 64; i++) bytes()[SCRATCH + i] = 0x5a;
  storage.comPendingScope.restore('c:\\demo\\wmadmod.dll');
  const DEST = 0x00501000;
  assert.strictEqual(storage.com_get_pending_dll(DEST, 260) >>> 0, DEST, 'answers the caller\'s buffer');
  assert.strictEqual(cstr(DEST), 'c:\\demo\\wmadmod.dll');
  assert.strictEqual(bytes()[SCRATCH], 0x5a, 'the shared scratch string is not written');
  assert.strictEqual(storage.com_get_pending_dll(DEST, 8) >>> 0, DEST);
  assert.strictEqual(cstr(DEST), 'c:\\demo', 'a short buffer gets a truncated, terminated name');
}

// 3. The wiring: the host table carries the scope; the WAT asks with a buffer.
{
  const hostImports = fs.readFileSync(path.join(root, 'lib', 'host-imports.js'), 'utf8');
  assert(/defineProperty\(host, 'comPendingScope'/.test(hostImports), 'host-imports.js puts the scope on the host table');
  const sigs = JSON.parse(fs.readFileSync(path.join(root, 'lib', 'host-import-sigs.generated.json'), 'utf8'));
  const sig = sigs.sigs && sigs.sigs.com_get_pending_dll;
  assert.deepStrictEqual(sig && sig.params, ['i32', 'i32'], 'com_get_pending_dll takes (dest, capacity)');
}

console.log('PASS test-worker-com-pending-slots');

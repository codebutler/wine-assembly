'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const RPC = require('../lib/guest-rpc');
const source = fs.readFileSync(path.join(__dirname, '../lib/guest-rpc.js'), 'utf8');
assert.equal(RPC.CTRL_INTS, 64);
assert.equal(RPC.RPC_STRIDE, 256);
const digest = JSON.parse(source.match(/const WAIT_DIGEST = (\[[^;]+\]);/)[1]);
const allocated = [...digest, ...['WAIT_VERSION', 'WAIT_SEQUENCE', 'WAIT_ACK', 'WAIT_RESERVED'].map(k => RPC.SLOT[k])];
assert.equal(new Set(allocated).size, 12);
const occupied = new Set([...Array(28).keys(), 32, 33, ...Array.from({ length: 13 }, (_, i) => i + 40)]);
for (const word of allocated) { assert(word >= 0 && word < 64); assert(!occupied.has(word)); }
assert.deepEqual(allocated, [28, 29, 30, 31, 34, 35, 36, 37, 53, 54, 55, 56]);
const host = fs.readFileSync(path.join(__dirname, '../lib/guest-thread-host.js'), 'utf8');
assert(host.includes('this.slot : msg.slot, msg.waitEntry)'));
assert(host.includes("this._ask({ t: 'completeWait', result, waitStackBytes, waitToken, namedWaitSequence })"));
const worker = fs.readFileSync(path.join(__dirname, '../lib/guest-worker.js'), 'utf8');
assert(worker.includes('namedWaitSequence: namedWaitTransport?.getNamedWaitSequence() || 0'));
assert(worker.includes('!namedWaitTransport?.consumeNamedWait(msg.namedWaitSequence)'));
assert.equal(RPC.SYNC_OBJECTS, 4096, 'nested rejection must scan the entire allocated sync table');
const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
const sync = new Int32Array(memory.buffer, RPC.SYNC_TABLE, RPC.SYNC_OBJECTS * RPC.SYNC_ENTRY_INTS);
sync.set([123, 1, 1, 0], 0);
sync.set([456, 4, 0, 0], (RPC.SYNC_OBJECTS - 1) * RPC.SYNC_ENTRY_INTS);
const sigs = { wait_single: { params: ['i32', 'i32'], results: ['i32'] },
  wait_multiple: { params: ['i32', 'i32', 'i32', 'i32'], results: ['i32'] } };
RPC.createMainBroker(memory, {}, sigs);
const h = RPC.createWorkerImports(memory, sigs, m => assert.notEqual(m.t, 'rpc', 'nested named wait must reject before broker'),
  { getSyncMsgDepth: () => 1 }).imports.host;
assert.equal(h.wait_single(456, 50) >>> 0, 0xffffffff);
new Uint32Array(memory.buffer, 65536, 2).set([123, 456]);
assert.equal(h.wait_multiple(2, 65536, 0, 50) >>> 0, 0xffffffff);
assert.equal(sync[2], 1, 'unsupported multiwait must not consume its local member');
console.log('PASS named-entry shared ABI allocation, notification consumer and completion identity wiring');

#!/usr/bin/env node
'use strict';
// Actual private WAT token state and the real sync-depth hooks in a tiny
// module. This does NOT establish deferred callback or guest longjmp support.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseSource } = require('../tools/watx');
const { compileClosure } = require('../tools/watx-closure');
const { createAudioHost } = require('../lib/host-audio');
const src = name => fs.readFileSync(path.join(__dirname, '../src', name), 'utf8');
const cache = src('04-cache.wat');
const ownership = cache.slice(cache.indexOf(';; BEGIN CALLBACK INVOCATION OWNERSHIP'),
  cache.indexOf(';; END CALLBACK INVOCATION OWNERSHIP'));
const render = node => Array.isArray(node) ? `(${node.slice(1).map(render).join(' ')})` : node;
const helpers = parseSource(src('04-cache.wat'), '04-cache.wat')
  .filter(node => node[1] === 'func' && ['$sync_depth_enter', '$sync_depth_leave'].includes(node[2]))
  .map(render).join('\n');
const source = `(import "host" "memory" (memory 1 1 shared))
  (import "host" "beep_process_begin" (func $host_beep_process_begin (param i32 i32) (result i32)))
  (import "host" "beep_thread_begin" (func $host_beep_thread_begin (param i32 i32 i32 i32 i32) (result i32)))
  (region.declare-fixed $CALLBACK_OWNERSHIP (base 0) (size 0x2110) (align 16))
  (global $current_thread_id (mut i32) (i32.const 1))
  ${['spill_active','ip','spill_base','spill_end','spill_pins','spill_desk_forced','sync_msg_depth']
    .map(name => `(global $${name} (mut i32) (i32.const 0))`).join('\n')}
  (func $dbg_recompute)
  ${ownership}
  ${helpers}
  (export "beginProcess" (func $invocation_process_begin))
  (export "beginThread" (func $invocation_thread_begin))
  (export "current" (func $invocation_current))
  (export "enter" (func $invocation_enter))
  (export "leave" (func $invocation_leave))
  (export "syncEnter" (func $sync_depth_enter))
  (export "syncLeave" (func $sync_depth_leave))
  (func (export "setTid") (param i32) (global.set $current_thread_id (local.get 0)))
  (func (export "setDepth") (param i32) (global.set $sync_msg_depth (local.get 0)))
  (func (export "depth") (result i32) (global.get $invocation_depth))
  (func (export "syncDepth") (result i32) (global.get $sync_msg_depth))
  (func (export "root") (result i64) (global.get $invocation_root))
  (func (export "epoch") (result i64) (global.get $invocation_epoch))`;
const compiled = compileClosure({ source, vfs: new Map() }, { tailCalls: true });
assert(compiled.success, compiled.error);
const mod = new WebAssembly.Module(compiled.wasmBinary);
const memory = new WebAssembly.Memory({ initial: 1, maximum: 1, shared: true });
const audio = createAudioHost({getMemory:()=>memory.buffer},{}).imports;
const instance = tid => {
  const x = new WebAssembly.Instance(mod, { host: { memory,
    beep_process_begin:audio.beep_process_begin,beep_thread_begin:audio.beep_thread_begin } }).exports;
  x.setTid(tid); return x;
};
const x = instance(1);
const state = who => ({ bytes: Buffer.from(new Uint8Array(memory.buffer)), depth: who.depth(),
  syncDepth: who.syncDepth(), root: who.root(), epoch: who.epoch() });
const rejectsUnchanged = (who, fn) => {
  const before = state(who);
  assert.throws(fn, WebAssembly.RuntimeError);
  assert.deepStrictEqual(state(who), before, 'rejection must not mutate token state');
};
x.beginProcess();
const root = x.current();
const uninitializedAlias = instance(1);
rejectsUnchanged(uninitializedAlias, () => uninitializedAlias.syncEnter());
const child = x.enter();
assert.notStrictEqual(child, root);
const nested = x.enter();
rejectsUnchanged(x, () => x.leave(child));
x.leave(nested); x.leave(child);
assert.strictEqual(x.current(), root);
const sibling = x.enter();
assert.notStrictEqual(sibling, child, 'equal-depth siblings have different identities');
rejectsUnchanged(x, () => x.leave(child));
x.leave(sibling);
rejectsUnchanged(x, () => x.leave(root));

// Real synchronous hooks, with a counter deliberately independent of identity.
x.syncEnter();
const sync = x.current();
x.setDepth(10);
assert.strictEqual(x.current(), sync, 'depth is not identity');
x.syncLeave();
assert.strictEqual(x.current(), root);
assert.strictEqual(x.syncDepth(), 9);
x.setDepth(0);
const worker = instance(2); worker.beginThread(1);
const wc = worker.enter();
rejectsUnchanged(worker, () => worker.leave(sync));
worker.leave(wc);
assert.strictEqual(x.current(), root, 'worker nesting preserves main root');
worker.setTid(3);
rejectsUnchanged(worker, () => worker.enter());
worker.setTid(2);
const replacement = instance(2); replacement.beginThread(1);
rejectsUnchanged(worker, () => worker.current());
assert.notStrictEqual(replacement.current(), worker.root(), 'slot reuse changes root');
const epoch = x.epoch();
x.enter(); // Simulate an aborted callback: do not silently pop its identity.
x.beginProcess();
assert.notStrictEqual(x.epoch(), epoch);
assert.notStrictEqual(x.current(), root, 'same-memory process replacement retires old context');
rejectsUnchanged(replacement, () => replacement.enter());
const levels = [];
for (let i = 0; i < 63; i++) levels.push(x.enter());
rejectsUnchanged(x, () => x.enter());
for (const id of levels.reverse()) x.leave(id);
rejectsUnchanged(x, () => x.beginThread(16));

// Only the fixture writes the private allocator to approach exhaustion.
const view = new DataView(memory.buffer);
view.setBigUint64(0, (1n << 64n) - 2n, true);
const last = x.enter();
assert.strictEqual(BigInt.asUintN(64, last), (1n << 64n) - 1n);
rejectsUnchanged(x, () => x.enter());
x.leave(last);
rejectsUnchanged(x, () => x.beginProcess());
console.log('callback invocation token tests PASS (sync family only)');

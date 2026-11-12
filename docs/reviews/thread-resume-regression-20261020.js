#!/usr/bin/env node
'use strict';

// Source-level scheduler acceptance. No Worker, browser, full VM or build.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const Module = require('module');
const root = path.resolve(__dirname, '../..');
const managerPath = path.join(root, 'lib/thread-manager.js');
const control = process.argv[2];

function replaceOnce(source, before, after) {
  assert.strictEqual(source.split(before).length, 2, 'mutation anchor must be unique');
  return source.replace(before, after);
}

// Mutations exist only in this process's module cache, never in the checkout.
if (control && control !== '--stale-fixture') {
  let source = fs.readFileSync(managerPath, 'utf8');
  const gate = '        if (thread.suspendCount > 0) continue;';
  if (control === '--skip-resumed') {
    source = replaceOnce(source, gate, gate + '\n        if (thread.suspendCount === 0) continue;');
  } else if (control === '--run-suspended') {
    // Both gates must be removed: activeCount otherwise prevents dispatch.
    source = replaceOnce(source,
      "if (t.state === 'active' && !(t.suspendCount > 0)) activeCount++;",
      "if (t.state === 'active') activeCount++;");
    source = replaceOnce(source, gate, '        // mutation: ignore suspend count');
  } else if (control === '--keep-self-yield') {
    source = replaceOnce(source,
      '          e.clear_yield();\n        } else if (yieldReason === 13)',
      '          // mutation: leave yield 11 pending\n        } else if (yieldReason === 13)');
  } else if (control === '--skip-attach') {
    source = replaceOnce(source,
      '    if (thread._dllAttachNotified || !this._callDllMain) return true;',
      '    return true; // mutation: skip thread attach');
  } else throw new Error('unknown control: ' + control);
  const mod = new Module(managerPath, module);
  mod.filename = managerPath;
  mod.paths = Module._nodeModulePaths(path.dirname(managerPath));
  require.cache[managerPath] = mod;
  mod._compile(source, managerPath);
}

if (control && control !== '--skip-attach') {
  const testPath = path.join(root, 'test/test-thread-manager.js');
  if (control === '--stale-fixture') {
    const source = replaceOnce(fs.readFileSync(testPath, 'utf8'),
      '    _dllAttachNotified: true,', '    _dllAttachNotified: false,');
    const mod = new Module(testPath, module);
    mod.filename = testPath;
    mod.paths = Module._nodeModulePaths(path.dirname(testPath));
    mod._compile(source, testPath);
  } else require(testPath);
  throw new Error('control unexpectedly passed the complete ThreadManager suite');
}

const { ThreadManager } = require(managerPath);

// Model current DLL exports, including a real shared callback gate and empty
// lifecycle tables. These addresses are fixture storage, not production bases.
function fixture() {
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
  const lock = new Int32Array(memory.buffer, 65536, 2);
  let runs = 0, metadataDepth = 0;
  const exports = {
    memory,
    get_sync_table: () => 0,
    get_dll_callback_lock: () => 65536,
    get_dll_callback_owner: () => 2,
    get_dll_lifecycle_table: () => 65600,
    get_dll_lifecycle_stride: () => 60,
    get_dll_table: () => 66000,
    get_dll_count: () => 0,
    dll_load_lock_begin: () => { metadataDepth++; },
    dll_load_lock_release_once: () => { assert(metadataDepth > 0); metadataDepth--; },
    get_eip: () => 0x401000,
    get_yield_reason: () => 0,
    get_sleep_yielded: () => 0,
    run: () => { runs++; },
  };
  const tm = new ThreadManager({}, memory, { exports: { get_sync_table: () => 0 } },
    () => ({ host: {} }));
  const logs = [];
  tm._log = line => logs.push(line);
  const worker = { tid: 1, state: 'active', suspendCount: 2,
    sleepCount: 0, sleepUntil: 0, waitPolls: 0, instance: { exports } };
  const handle = 0xe1010;
  tm.threads.set(handle, worker);
  return { tm, worker, handle, lock, logs, runs: () => runs,
    metadataDepth: () => metadataDepth };
}

for (const blockedGate of [false, true]) {
  const f = fixture();
  f.tm.runSlice(100);
  assert.strictEqual(f.runs(), 0, 'cold suspended worker cannot execute');
  assert.strictEqual(f.worker._dllAttachOperation, undefined, 'suspension precedes attach');
  assert.strictEqual(f.tm.resumeThread(f.handle), 2);
  f.tm.runSlice(100);
  assert.strictEqual(f.worker._dllAttachOperation, undefined, 'partial resume cannot attach');
  assert.strictEqual(f.tm.resumeThread(f.handle), 1);
  if (blockedGate) {
    Atomics.store(f.lock, 0, 99);
    Atomics.store(f.lock, 1, 1);
    f.tm.runSlice(100);
    assert.strictEqual(f.runs(), 0, 'foreign callback owner blocks cold entry');
    assert(!f.worker._dllAttachNotified, 'blocked attach is not published');
    assert.deepStrictEqual(Array.from(f.lock), [99, 1], 'foreign ownership preserved');
    Atomics.store(f.lock, 0, 0);
    Atomics.store(f.lock, 1, 0);
  }
  f.tm.runSlice(100);
  assert.strictEqual(f.runs(), 0, 'first cold quantum completes attach, not threadproc');
  assert.strictEqual(f.worker._dllAttachNotified, true, 'real notification publishes ready state');
  assert.strictEqual(f.worker._dllAttachOperation, null, 'completed continuation retired');
  assert.deepStrictEqual(Array.from(f.lock), [0, 0], 'notification releases callback gate');
  assert.strictEqual(f.metadataDepth(), 0, 'metadata lock balanced');
  f.tm.runSlice(100);
  assert.strictEqual(f.runs(), 1, 'ready worker executes the next quantum');
  assert.strictEqual(f.tm.suspendThread(f.handle), 0);
  f.tm.runSlice(100);
  assert.strictEqual(f.runs(), 1, 'started worker remains suspended');
  assert.strictEqual(f.tm.resumeThread(f.handle), 1);
  f.tm.runSlice(100);
  assert.strictEqual(f.runs(), 2, 'started worker executes immediately after final resume');
  assert.strictEqual(f.worker.state, 'active');
  assert.deepStrictEqual(f.logs, [], 'no hidden scheduler crash');
}
console.log('PASS cold attach, callback-gate contention, nested suspension and warm resume');

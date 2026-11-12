#!/usr/bin/env node
'use strict';
// Production import closures + ThreadManager + both actual fork statements.
// Memory/exports and launch arguments are fixtures, not a PE/full CLI launch.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const base = 'f503b7997f87607e5575b6028342b557f775aae6';
const baseline = process.argv.includes('--baseline');
const independent = process.argv.includes('--independent-control');
function source(file) {
  return baseline ? cp.execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8' })
    : fs.readFileSync(path.join(root, file), 'utf8');
}
const tmModule = new Module(path.join(root, 'lib/thread-manager.js'), module);
tmModule.filename = path.join(root, 'lib/thread-manager.js');
tmModule.paths = module.paths;
tmModule._compile(source('lib/thread-manager.js'), tmModule.filename);
const { ThreadManager } = tmModule.exports;
const { readSyncObjectName } = require('../lib/mem-utils');
const cli = source('test/run.js');
const start = cli.indexOf('  const win32ThreadId = () => threadManager.currentWin32ThreadId();');
const end = cli.indexOf('  // Check if a DLL file exists', start);
assert(start >= 0 && end > start);
const forkStatements = [...cli.matchAll(/    const child = fork\(__filename, args, .*?\);/g)].map(m => m[0]);
assert.equal(forkStatements.length, 2);
function provider() {
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
  const manager = new ThreadManager({}, memory, { exports: { get_sync_table: () => 0 } }, () => ({}));
  const ctx = { exports: { get_sync_msg_depth: () => 0 } }, h = {};
  new Function('h', 'threadManager', 'memory', 'readSyncObjectName', 'ctx', cli.slice(start, end))
    (h, manager, memory, readSyncObjectName, ctx);
  const name = s => { new Uint8Array(memory.buffer).set(Buffer.from(s + '\0'), 65536); return 65536; };
  return { memory, manager, ctx, h, name };
}
const children = [];
function child(which) {
  const args = ['--child', ...(baseline ? ['--baseline'] : []), ...(independent ? ['--independent-control'] : [])];
  const c = new Function('fork', '__filename', 'args', 'ThreadManager',
    forkStatements[which] + '\nreturn child;')(cp.fork, __filename, args, ThreadManager);
  c.stderr.pipe(process.stderr);
  children.push(c);
  let sequence = 0;
  c.ask = message => new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { cleanup(); reject(Error('child RPC timeout')); }, 7000);
    const onExit = code => { cleanup(); reject(Error('child exit ' + code)); };
    const onMessage = reply => {
      if (reply.id !== id) return;
      cleanup();
      if (reply.error) reject(Object.assign(Error(reply.error), { code: reply.code })); else resolve(reply.value);
    };
    function cleanup() { clearTimeout(timer); c.off('exit', onExit); c.off('message', onMessage); }
    c.on('message', onMessage); c.once('exit', onExit); c.send({ ...message, id });
  });
  c.stop = () => new Promise(resolve => { c.once('exit', resolve); c.send({ op: 'stop' }); });
  return c;
}
async function main() {
  if (!baseline && !independent) {
    const failure = cp.spawnSync(process.execPath, [__filename, '--connection-failure'], {
      encoding: 'utf8', timeout: 7000,
      env: { ...process.env, WINE_NAMED_EVENT_ENDPOINT: JSON.stringify({ path: '/nonexistent-wine-event/socket', token: 'missing' }) },
    });
    assert.equal(failure.status, 0, failure.stderr);
    console.log('PASS failed connection initialization is latched without reconnect');
  }
  // Both launch expressions execute before any named event exists. They must
  // establish and distribute ONE namespace, including the second fork route.
  const a = child(0), b = child(1), p = provider();
  const endpoints = await Promise.all([a.ask({ op: 'endpoint' }), b.ask({ op: 'endpoint' })]);
  if (!baseline && !independent) {
    assert.equal(endpoints[0], endpoints[1]);
    assert.equal(endpoints[0], process.env.WINE_NAMED_EVENT_ENDPOINT);
  }
  const create = (name, manual = 0, state = 0) => p.h.create_event(manual, state, p.name(name), 0) >>> 0;
  const h = create('parent-event');
  // Direct original gap oracle: child opens/sets, parent acquires. Historical
  // auxiliary child calls use a tagged create result without stripping its tag;
  // test reference/reset semantics separately below using valid guest handles.
  const opened = await a.ask({ op: 'openSet', name: 'parent-event' });
  const acquired = p.h.wait_single(h, 0);
  console.log(JSON.stringify({ originalGapCorrected: { opened, acquired } }));
  if (!independent) {
    assert.notEqual(opened, 0, 'CLI child must open parent named event');
    assert.equal(acquired, 0, 'child signal must satisfy parent wait');
    assert.equal(p.h.wait_single(h, 0), 258);
  }
  const race = create('race', 0, 1);
  await Promise.all([a.ask({ op: 'hold', name: 'race', create: independent }), b.ask({ op: 'hold', name: 'race', create: independent })]);
  for (let i = 0; i < 24; i++) {
    if (i) p.h.set_event(race);
    const results = await Promise.all([a.ask({ op: 'acquire', name: 'race' }), b.ask({ op: 'acquire', name: 'race' })]);
    assert.equal(results.filter(x => x === 0).length, 1, `one winner ${JSON.stringify(results)}`);
    assert.equal(p.h.wait_single(race, 0), 258);
  }
  console.log('PASS 24 real subprocess auto-reset races');
  const manual = create('manual', 1, 1);
  await Promise.all([a.ask({ op: 'hold', name: 'manual' }), b.ask({ op: 'hold', name: 'manual' })]);
  assert.deepEqual(await Promise.all([a.ask({ op: 'acquire', name: 'manual' }), b.ask({ op: 'acquire', name: 'manual' })]), [0, 0]);
  await a.ask({ op: 'reset', name: 'manual' });
  assert.equal(p.h.wait_single(manual, 0), 258);
  assert.equal(await b.ask({ op: 'acquire', name: 'manual' }), 258);
  const again = create('manual', 0, 1);
  assert.equal(again, (manual | 0x80000000) >>> 0);
  assert.equal(p.h.wait_single(again, 0), 0xFFFFFFFF, 'private result tag is not a guest handle');
  assert.equal(p.h.wait_single(manual, 0), 258, 'existing create preserves state');
  assert.equal(p.h.close_event(manual), 1);
  assert.equal(p.h.set_event(manual), 1, 'partial ref stays live');
  assert.equal(p.h.wait_single(manual, 0), 0);
  assert.equal(p.h.wait_single(manual, 0), 0, 'existing create preserves mode');
  await a.stop(); await b.stop();
  assert.equal(p.h.set_event(manual), 1, 'child shutdown does not stop parent namespace');
  const generation = p.manager._authorityEvents.get(manual).generation;
  assert.equal(p.h.close_event(manual), 1);
  assert.equal(p.h.open_event(p.name('manual'), 0), 0);
  const recreated = create('manual');
  assert.notEqual(recreated, manual);
  assert.notEqual(p.manager._authorityEvents.get(recreated).generation, generation);
  assert.equal(p.h.wait_single(manual, 0), 0xFFFFFFFF);
  assert.equal(p.h.set_event(manual), 0);
  assert.equal(p.h.reset_event(manual), 0);
  assert.equal(p.h.close_event(manual), 0);
  assert.equal(p.h.set_event(recreated), 1);
  for (const depth of [0, 1]) {
    p.ctx.exports.get_sync_msg_depth = () => depth;
    for (const timeout of [1, 500, -1]) assert.equal(p.h.wait_single(recreated, timeout), 0xFFFFFFFF);
  }
  assert.equal(p.h.wait_single(recreated, 0), 0, 'unsupported waits did not consume');
  const local = p.h.create_event(0, 1, 0, 0);
  new Uint32Array(p.memory.buffer, 70000, 2).set([local, recreated]);
  assert.equal(p.h.wait_multiple(2, 70000, 1, 0), 0xFFFFFFFF);
  assert.equal(p.h.wait_single(local, 0), 0, 'unsupported wait-all does not consume local object');
  assert.equal(p.h.wait_single(local, 0), 258);
  p.ctx.exports.get_sync_msg_depth = () => 0;
  assert.equal(p.h.wait_single(local, 100), 0xFFFF, 'local finite scheduling sentinel preserved');
  assert.equal(p.h.wait_single(local, -1), 0xFFFF, 'local infinite scheduling sentinel preserved');
  p.h.set_event(recreated);
  assert.equal(p.h.wait_multiple(2, 70000, 0, 0), 1);
  const mutex = p.manager.createMutex(false, 'cross-kind');
  assert(mutex);
  assert.equal(create('cross-kind'), 0x80000000);
  assert.equal(p.manager.createMutex(false, 'manual'), 0x80000000);
  assert.throws(() => p.manager.createEvent(false, false, 'x'.repeat(1025)), e => e.code === 'EINVAL');
  assert.equal(p.h.set_event(recreated), 1, 'validation error does not poison client');
  console.log('PASS manual/reset/ref/generation/stale/unnamed/unsupported/error contracts');
  await worker(p, recreated);
  p.h.set_event(recreated);
  await routedWorker(p, recreated, false);
  // Real authority loss: remove owner endpoint by terminating its process is
  // covered by standalone tests. Here bridge death exercises integration's
  // unknown-outcome propagation, subsequent poison, and absence of fallback.
  p.manager._namedEventClient.timeoutMs = 100;
  await p.manager._namedEventClient.worker.terminate();
  assert.throws(() => p.h.set_event(recreated), e => e.code === 'ETIMEDOUT');
  assert.throws(() => p.h.wait_single(recreated, 0), e => e.code === 'ECLOSED');
  assert.throws(() => p.h.close_event(recreated), e => e.code === 'ECLOSED');
  assert.throws(() => create('after-poison'), e => e.code === 'ECLOSED');
  await routedWorker(p, recreated, true);
  console.log('PASS timeout throws, poisoned reuse throws, no replay/fallback');
}
async function routedWorker(p, handle, expectError) {
  const RPC = require('../lib/guest-rpc');
  const { Worker } = require('node:worker_threads');
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const sigs = { wait_single: { params: ['i32','i32'], results: ['i32'] } };
  const errors = [];
  const broker = RPC.createMainBroker(memory, p.h, sigs, { onError: (name, err) => errors.push(err.code) });
  const w = new Worker(`
    const { parentPort, workerData: d } = require('node:worker_threads');
    const RPC = require(d.rpc);
    const built = RPC.createWorkerImports(d.memory, d.sigs, m => parentPort.postMessage(m),
      { getSyncMsgDepth: () => 0 });
    try { parentPort.postMessage({ done: true, results: [
      built.imports.host.wait_single(d.handle,0), built.imports.host.wait_single(d.handle,0)] }); }
    catch (e) { parentPort.postMessage({ done: true, error: e.message }); }
  `, { eval: true, workerData: { memory, sigs, handle, rpc: path.join(root, 'lib/guest-rpc') } });
  const r = await new Promise((resolve, reject) => {
    w.once('error', reject);
    w.on('message', m => { if (m.done) resolve(m); else if (m.t === 'rpc') broker.serveRpc(m.slot); });
  });
  await w.terminate();
  if (expectError) {
    assert.match(r.error, /host import wait_single threw/);
    assert.deepEqual(errors, ['ECLOSED']);
  } else {
    assert.deepEqual(r.results, [0,258]);
    assert.deepEqual(errors, []);
  }
  console.log('PASS actual guest Worker ordinary broker route ' + (expectError ? 'propagates poison without false success' : 'acquires once from authority'));
}
async function worker(p, handle) {
  const RPC = require('../lib/guest-rpc');
  const { Worker } = require('node:worker_threads');
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const sync = new Int32Array(memory.buffer, RPC.SYNC_TABLE, 8);
  sync.set([handle, 4, 1, 0, 123, 1, 1, 0]); // malicious mirrored word must not be consumed
  const w = new Worker(`
    const { parentPort, workerData: d } = require('node:worker_threads');
    const RPC = require(d.rpc);
    const posts = [];
    const built = RPC.createWorkerImports(d.memory,
      { wait_single: { params: ['i32','i32'], results: ['i32'] } },
      m => posts.push(m.t), { slot: 0, getSyncMsgDepth: () => 1 });
    parentPort.postMessage({
      single: built.imports.host.wait_single(d.handle, 0),
      all: RPC.waitSharedSyncObjects(d.memory, [123,d.handle], true, 0),
      any: RPC.waitSharedSyncObjects(d.memory, [123,d.handle], false, 0), posts });
  `, { eval: true, workerData: { rpc: path.join(root, 'lib/guest-rpc'), memory, handle } });
  const r = await new Promise((resolve, reject) => { w.once('message', resolve); w.once('error', reject); });
  await w.terminate();
  assert.equal(r.single, 0xFFFFFFFF); assert.equal(r.all, 0xFFFFFFFF); assert.equal(r.any, 0xFFFFFFFF);
  assert.equal(sync[2], 1); assert.equal(sync[6], 1);
  assert.equal(p.h.wait_single(handle, 0), 0, 'Worker rejection left authoritative signal intact');
  console.log('PASS actual guest Worker nested wrapper explicitly fails without mirrored acquisition');
}
if (process.argv.includes('--connection-failure')) {
  const p = provider();
  assert.throws(() => p.h.open_event(p.name('missing'), 0), e => e.code === 'ECONNECTION');
  assert.throws(() => p.h.open_event(p.name('missing'), 0), e => e.code === 'ECLOSED');
} else if (process.argv.includes('--child')) {
  if (independent) delete process.env.WINE_NAMED_EVENT_ENDPOINT;
  const p = provider(), held = new Map();
  process.on('message', msg => {
    if (msg.op === 'stop') { process.disconnect(); return; }
    try {
      let value;
      if (msg.op === 'endpoint') value = process.env.WINE_NAMED_EVENT_ENDPOINT || null;
      if (msg.op === 'openSet') {
        value = p.h.open_event(p.name(msg.name), 0);
        if (value) { p.h.set_event(value); p.h.close_event(value); }
      }
      if (msg.op === 'hold') {
        value = msg.create ? p.h.create_event(0, 1, p.name(msg.name), 0) : p.h.open_event(p.name(msg.name), 0);
        assert(value); held.set(msg.name, value & 0x7fffffff);
      }
      if (msg.op === 'acquire') value = p.h.wait_single(held.get(msg.name), 0);
      if (msg.op === 'reset') value = p.h.reset_event(held.get(msg.name));
      process.send({ id: msg.id, value });
    } catch (e) { process.send({ id: msg.id, error: e.message, code: e.code }); }
  });
} else main().catch(e => { console.error(e); process.exitCode = 1; })
  .finally(() => { for (const c of children) if (c.exitCode === null) c.kill(); });

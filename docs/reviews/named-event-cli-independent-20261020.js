'use strict';
// Independent acceptance probes, no production edits. Run from any directory.
// --control removes only the new pre-acquisition multiple-wait guard in memory.
// --lost-response drops the real server's Set reply after committing the Set.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const mode = process.argv[2] || 'normal';
const tmPath = path.join(root, 'lib/thread-manager.js');
let source = fs.readFileSync(tmPath, 'utf8');
if (mode === '--control') {
  const start = source.indexOf('    for (const handle of handles) {', source.indexOf('  waitMultiple(nCount'));
  const end = source.indexOf('    // Validate process handles', start);
  assert(start > 0 && end > start);
  source = source.slice(0, start) + source.slice(end);
}
if (mode === '--control-stale') {
  const before = '!this._authorityEvents.has(handle >>> 0) || bWaitAll';
  assert.equal(source.split(before).length, 2);
  source = source.replace(before, 'bWaitAll');
}
if (mode === '--lost-response') {
  // The authority is still the actual production server, in a real Worker.
  // Only its reply is suppressed; observer-client acquisition proves commit.
  const wt = require('node:worker_threads');
  const Worker = wt.Worker;
  wt.Worker = class extends Worker {
    constructor(file, options) {
      if (options?.workerData?.role === 'authority') {
        let s = fs.readFileSync(file, 'utf8');
        const before = "        socket.write(JSON.stringify({ value }) + '\\n');";
        assert.equal(s.split(before).length, 2);
        s = s.replace(before, "        if (request.op !== 'set') socket.write(JSON.stringify({ value }) + '\\n');");
        super(s, { ...options, eval: true });
      } else super(file, options);
    }
  };
}
const loaded = new Module(tmPath, module);
loaded.filename = tmPath; loaded.paths = module.paths;
loaded._compile(source, tmPath);
const { ThreadManager } = loaded.exports;
const { readSyncObjectName } = require('../../lib/mem-utils');
const cli = fs.readFileSync(path.join(root, 'test/run.js'), 'utf8');
const start = cli.indexOf('  const win32ThreadId = () => threadManager.currentWin32ThreadId();');
const end = cli.indexOf('  // Check if a DLL file exists', start);
const managers = [];
function make() {
  const memory = new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true });
  const m = new ThreadManager({}, memory, { exports: { get_sync_table: () => 0 } }, () => ({}));
  const ctx = { exports: { get_sync_msg_depth: () => 0 } }, h = {};
  new Function('h', 'threadManager', 'memory', 'readSyncObjectName', 'ctx', cli.slice(start, end))(h, m, memory, readSyncObjectName, ctx);
  const p = { m, h, ctx, memory,
    create(name, manual = false, signaled = false) {
      new Uint8Array(memory.buffer).set(Buffer.from(name + '\0'), 65536);
      return h.create_event(+manual, +signaled, name ? 65536 : 0, 0) >>> 0;
    },
    many(handles, all = false, timeout = 0) {
      new Uint32Array(memory.buffer, 70000, handles.length).set(handles);
      return h.wait_multiple(handles.length, 70000, +all, timeout) >>> 0;
    }
  };
  managers.push(m); return p;
}
function pass(label) { console.log('PASS ' + label); }
async function main() {
  if (mode === '--owner-child') {
    const p = make(); p.create('owner-child');
    console.log(process.env.WINE_NAMED_EVENT_ENDPOINT); return;
  }
  const p = make(), observer = make();
  const named = p.create('mixed', false, true);
  const local = p.create('', false, true);
  const stale = p.create('stale'); p.h.close_event(stale);
  const recycledLocal = p.create('', false, true);
  assert.notEqual(stale, recycledLocal);
  const remote = observer.create('mixed') & 0x7fffffff;
  if (mode === '--lost-response') {
    p.m._namedEventClient.timeoutMs = 150;
    p.m.resetEvent(named);
    assert.throws(() => p.h.set_event(named), { code: 'ETIMEDOUT' });
    assert.equal(observer.h.wait_single(remote, 0), 0, 'Set committed before response loss');
    assert.equal(observer.h.wait_single(remote, 0), 258);
    const client = p.m._namedEventClient, refs = p.m._authorityEvents.get(named).refs.length;
    for (const action of [() => p.h.set_event(named), () => p.h.reset_event(named),
      () => p.h.close_event(named), () => p.h.wait_single(named, 0), () => p.create('after-loss')]) {
      assert.throws(action, { code: 'ECLOSED' });
      assert.equal(p.m._namedEventClient, client, 'no replacement connection');
    }
    assert.equal(p.m._authorityEvents.get(named).refs.length, refs, 'failed close must not change local accounting');
    pass('actual committed Set / withheld response / poisoned adapter / no reconnect or local close');
    return;
  }
  for (const depth of [0, 1]) {
    p.ctx.exports.get_sync_msg_depth = () => depth;
    for (const handles of [[local, named], [named, local], [local, stale, named], [named, stale, local], [stale, local, named]]) {
      for (const [all, timeout] of [[true, 0], [false, 1], [false, -1]]) {
        assert.equal(p.many(handles, all, timeout), 0xffffffff, 'reject whole unsupported set');
        assert.equal(p.h.wait_single(local, 0), 0, 'no local partial consumption');
        assert.equal(observer.h.wait_single(remote, 0), 0, 'no named partial consumption');
        p.h.set_event(local); p.h.set_event(named);
      }
    }
    for (const handles of [[local, stale], [named, stale], [stale, local, named]]) {
      assert.equal(p.many(handles), 0xffffffff, 'stale named handle must fail before any acquisition');
      assert.equal(p.h.wait_single(local, 0), 0); p.h.set_event(local);
      assert.equal(observer.h.wait_single(remote, 0), 0); p.h.set_event(named);
    }
    assert.equal(p.many([local, named]), 0);
    assert.equal(observer.h.wait_single(remote, 0), 0, 'later named token preserved by wait-any');
    p.h.set_event(named);
    assert.equal(p.many([local, named]), 1);
    assert.equal(observer.h.wait_single(remote, 0), 258);
    p.h.set_event(local); p.h.set_event(named);
  }
  pass('main/nested unsupported and stale mixtures reject before acquisition; supported ordering');
  // A stale local event retains the pre-existing unknown-handle success
  // convention. Qualify preservation explicitly, rather than crediting a fix.
  const localStale = p.create(''); p.h.close_event(localStale);
  const basePath = path.join(root, 'lib/thread-manager.js');
  const baseModule = new Module(basePath, module); baseModule.filename = basePath; baseModule.paths = module.paths;
  baseModule._compile(cp.execFileSync('git', ['show', 'f503b7997f87607e5575b6028342b557f775aae6:lib/thread-manager.js'], { cwd: root, encoding: 'utf8' }), basePath);
  const old = new baseModule.exports.ThreadManager({}, new WebAssembly.Memory({ initial: 2, maximum: 2, shared: true }),
    { exports: { get_sync_table: () => 0 } }, () => ({}));
  const oldStale = old.createEvent(false, false); old.closeEvent(oldStale);
  assert.equal(p.h.wait_single(localStale, 0), old.waitSingle(oldStale, 0));
  assert.equal(p.many([localStale, named]), 0);
  assert.equal(observer.h.wait_single(remote, 0), 0, 'pre-existing local stale convention does not consume later named token');
  p.h.set_event(named);
  pass('stale-local convention matches exact base; named token is preserved');
  const RPC = require('../../lib/guest-rpc');
  const { Worker } = require('node:worker_threads');
  const shared = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const words = new Int32Array(shared.buffer, RPC.SYNC_TABLE, 16);
  words.set([named, 4, 1, 0, local, 1, 1, 0, recycledLocal, 1, 1, 0]);
  const w = new Worker(`
    const { parentPort, workerData: d } = require('node:worker_threads');
    const RPC = require(d.rpc);
    const answers = [];
    for (const handles of [[d.local,d.stale,d.named], [d.named,d.local,d.stale], [d.stale,d.local,d.named]])
      for (const all of [false,true]) for (const timeout of [0,1,0xffffffff])
        answers.push(RPC.waitSharedSyncObjects(d.memory, handles, all, timeout));
    const staleOnly = RPC.waitSharedSyncObjects(d.memory,[d.local,d.stale],false,0);
    parentPort.postMessage({ answers, staleOnly, state: Array.from(new Int32Array(d.memory.buffer,RPC.SYNC_TABLE,12)) });
  `, { eval: true, workerData: { memory: shared, rpc: path.join(root, 'lib/guest-rpc'), named, local, stale } });
  const answer = await new Promise((resolve,reject) => { w.once('message',resolve); w.once('error',reject); });
  await w.terminate();
  assert(answer.answers.every(x => x === 0xffffffff));
  assert.equal(answer.staleOnly, null, 'unresolved stale set falls through to broker, never locally acquires');
  assert.equal(answer.state[2], 1); assert.equal(answer.state[6], 1); assert.equal(answer.state[10], 1);
  pass('actual Worker: 18 mixed stale/named/local waits reject with no partial acquisition; stale-only delegates');
  for (let i = 0; i < 40; i++) {
    const h = p.create('recycle', false, true);
    const generation = p.m._authorityEvents.get(h).generation;
    assert.equal(p.m.openEvent('recycle'), h);
    assert.equal(p.m.closeSyncHandle(h), true);
    assert.equal(p.h.wait_single(h, 0), 0);
    assert.equal(p.h.close_event(h), 1);
    const q = p.create('recycle');
    assert.notEqual(q, h); assert.notEqual(p.m._authorityEvents.get(q).generation, generation);
    assert.equal(p.h.wait_single(h, 0), 0xffffffff);
    assert.equal(p.h.set_event(h), 0); assert.equal(p.h.close_event(h), 0);
    p.h.close_event(q);
  }
  pass('40 slot/name generations, partial CloseHandle and final CloseEvent');
  for (const kind of ['Mutex', 'Semaphore']) {
    const name = 'cross-' + kind;
    const h = kind === 'Mutex' ? p.m.createMutex(false, name) : p.m.createSemaphore(1, 2, name);
    assert.equal(p.create(name), 0x80000000);
    assert.equal(p.m.openEvent(name), 0x80000000);
    p.m.closeSyncHandle(h);
    const e = p.create(name);
    assert.equal(kind === 'Mutex' ? p.m.createMutex(false, name) : p.m.createSemaphore(1, 2, name), 0x80000000);
    p.h.close_event(e);
  }
  pass('mutex/semaphore cross-kind conflicts preserved in both directions');
  const full = make(), slots = [];
  for (let i = 0; i < 4096; i++) slots.push(full.create(''));
  assert(slots.every(Boolean));
  assert.equal(full.create('no-slot'), 0);
  assert.equal(full.m._namedEventClient, undefined, 'local capacity fails before remote allocation');
  observer.m.enableNamedEventAuthority();
  assert.equal(observer.m.openEvent('no-slot'), 0);
  full.h.close_event(slots.pop());
  const recovered = full.create('no-slot'); assert(recovered);
  full.h.close_event(recovered);
  assert.equal(observer.m.openEvent('no-slot'), 0);
  for (const h of slots) full.h.close_event(h);
  pass('4096-slot exhaustion creates no remote reference; freeing slot recovers');
  const quota = make(), q = quota.create('quota');
  for (let i = 1; i < 4096; i++) assert.equal(quota.m.openEvent('quota'), q);
  assert.equal(quota.create('quota'), 0);
  assert.equal(quota.create('quota-overflow'), 0);
  assert.throws(() => quota.m.openEvent('quota'), { code: 'ENOSPC' });
  assert.equal(quota.m._syncRefs[quota.m._getSyncIdx(q)], 4096);
  assert.equal(quota.m._authorityEvents.get(q).refs.length, 4096);
  assert.equal(observer.m.openEvent('quota-overflow'), 0);
  quota.h.close_event(q);
  assert.equal(quota.m.openEvent('quota'), q);
  for (let i = 0; i < 4096; i++) assert.equal(quota.h.close_event(q), 1);
  assert.equal(observer.m.openEvent('quota'), 0);
  pass('4096 remote references: Create returns zero, Open throws, accounting and recovery exact');
  // Independent owner exit removes its namespace, without touching this owner.
  const env = { ...process.env }; delete env.WINE_NAMED_EVENT_ENDPOINT;
  const child = cp.spawnSync(process.execPath, [__filename, '--owner-child'], { env, encoding: 'utf8', timeout: 7000 });
  assert.equal(child.status, 0, child.stderr);
  const endpoint = JSON.parse(child.stdout.trim());
  assert.equal(fs.existsSync(path.dirname(endpoint.path)), false);
  assert.equal(p.h.set_event(named), 1);
  pass('independent CLI owner normal exit removes directory; unrelated namespace survives');
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => {
  for (const m of managers) { try { m._namedEventClient?.shutdown(); } catch {} }
});

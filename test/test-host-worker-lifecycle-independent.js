'use strict';

// Constructor and retirement checks complementary to the unchanged full suite.
// Only the transport and timer boundaries are synthetic; production methods run.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');
const { EventEmitter } = require('events');
const root = path.join(__dirname, '..');
const timers = new Map();
let nextTimer = 0;
let workerConstructions = 0;
const workers = [];
const setTimer = (fn, ms) => {
  const id = ++nextTimer;
  timers.set(id, { fn, ms });
  return id;
};
class Transport extends EventEmitter {
  constructor() {
    super();
    workerConstructions++;
    workers.push(this);
    this.terminations = 0;
  }
  postMessage(message) { this.initialization = message; }
  terminate() { this.terminations++; return Promise.resolve(); }
}
const timerBoundary = {
  setTimeout: setTimer, clearTimeout: id => timers.delete(id),
  setInterval: setTimer, clearInterval: id => timers.delete(id),
};
const moduleFile = path.join(root, 'lib/guest-thread-host.js');
const realRequire = createRequire(moduleFile);
const driver = {
  ...timerBoundary, console, process, Error, module: { exports: {} },
  require: name => name === 'worker_threads' ? { Worker: Transport } : realRequire(name),
};
vm.runInNewContext(fs.readFileSync(moduleFile, 'utf8'), driver, { filename: moduleFile });
const { WorkerLink, GuestThreadHost } = driver.module.exports;
const host = { ...timerBoundary, console, URLSearchParams, location: { search: '' } };
vm.runInNewContext(fs.readFileSync(path.join(root, 'host.js'), 'utf8') +
  '\nglobalThis.WineAssembly = WineAssembly;', host);

(async () => {
  const Wine = host.WineAssembly;
  Wine._wasmModulePromise = { compiled: true };
  const compiled = Wine._wasmModulePromise;
  const first = new Wine();
  const second = new Wine();
  assert.equal(second.processId, first.processId + 1);
  assert.notEqual(first._processObject, second._processObject, 'process identities are instance owned');
  assert.equal(first._processObject.wine, first);
  assert.equal(second._processObject.wine, second);
  assert.equal(first._processObject.exited, false);
  assert.equal(first._processObject.exitCode, 259);
  assert.notEqual(first._processAliases, second._processAliases);
  assert.equal(Wine._threadSnapshotProcessSeen, true);
  assert.equal(Wine._threadSnapshotSystemIncomplete, true);
  assert.equal(Wine._wasmModulePromise, compiled, 'ordinary constructor preserves module cache');

  const a = new WorkerLink({});
  const b = new WorkerLink({});
  assert(Number.isSafeInteger(a.endpointIdentity));
  assert.equal(b.endpointIdentity, a.endpointIdentity + 1);
  assert.notEqual(a._retiringListeners, b._retiringListeners);
  assert.notEqual(a._pending, b._pending);
  const gh = new GuestThreadHost({});
  const sibling = new GuestThreadHost({});
  assert.notEqual(gh._localSendWaits, sibling._localSendWaits);
  assert.notEqual(gh._localSendFrames, sibling._localSendFrames);
  assert.equal(gh._localSendWaits.frames, gh._localSendFrames);
  assert.notEqual(gh._localSendWaits.resumes, sibling._localSendWaits.resumes);
  assert.equal(gh._localLink, null);
  assert.equal(gh.link, null);
  assert.equal(a.worker, null);
  assert.equal(workerConstructions, 0, 'constructors do not start transports');
  assert.equal(timers.size, 0, 'constructors do not start timers');

  let calls = 0;
  const unsubscribe = a.onRetiring(() => { calls += 100; });
  unsubscribe();
  a.onRetiring(() => { calls++; });
  await b.stop();
  assert.equal(calls, 0, 'sibling retirement cannot notify this endpoint');
  const stopA = a.stop();
  assert.equal(a.stop(), stopA, 'retirement is single flight');
  await stopA;
  assert.equal(calls, 1);
  assert.equal(a._retiringListeners.size, 0);
  a.onRetiring(() => { calls++; });
  assert.equal(calls, 2, 'late subscriber observes retirement synchronously');
  await gh.stop();
  assert.equal(sibling._stopped, false);
  await sibling.stop();

  const scoped = new WorkerLink({});
  const transport = new Transport();
  scoped.worker = transport;
  scoped._scopedLoaderUsed = true;
  const identity = scoped.endpointIdentity;
  scoped._ask = async () => ({ retired: true, endpointIdentity: identity + 1 });
  await assert.rejects(scoped.stop(), /retirement identity mismatch/);
  assert.equal(scoped.worker, transport, 'bad receipt retains the exact owner');
  assert.equal(transport.terminations, 0);
  assert.equal(scoped.endpointIdentity, identity);
  assert.equal(scoped._stopPromise, null, 'failed retirement permits explicit retry');
  scoped._ask = async request => {
    assert.equal(request.endpointIdentity, identity);
    return { retired: true, endpointIdentity: identity };
  };
  await scoped.stop();
  assert.equal(transport.terminations, 1);
  assert.equal(scoped._retirementComplete, true);

  const straggler = new WorkerLink({});
  let release;
  const drain = new Promise(resolve => { release = resolve; });
  straggler.worker = { terminate: () => drain };
  const stopping = straggler.stop();
  await Promise.resolve();
  const replacement = { replacement: true };
  straggler.worker = replacement;
  release();
  await stopping;
  assert.equal(straggler.worker, replacement, 'late termination cannot clear another owner');
  straggler.worker = null; // synthetic reference only

  const failed = new WorkerLink({});
  const ready = failed.start();
  assert.equal(failed.worker.initialization.endpointIdentity, failed.endpointIdentity);
  const failure = new Error('independent transport failure');
  failed.worker.emit('error', failure);
  await assert.rejects(ready, /independent transport failure/);
  assert.equal(failed._transportFailure, failure);
  assert.equal(timers.size, 0, 'transport failure clears readiness timer');
  await failed.stop();

  const unready = new WorkerLink({});
  const waiting = unready.start();
  assert.equal(timers.size, 1);
  const deadline = [...timers.values()][0];
  assert.equal(deadline.ms, 20000, 'production readiness deadline unchanged');
  deadline.fn();
  await assert.rejects(waiting, /did not become ready in 20s/);
  await unready.stop();
  assert.equal(timers.size, 0, 'readiness timeout and stop leave no timer');
  assert(workers.every(worker => worker.terminations === 1));
  console.log('PASS independent constructors, listener/retirement identities, readiness failure/deadline and cleanup');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => timers.clear());

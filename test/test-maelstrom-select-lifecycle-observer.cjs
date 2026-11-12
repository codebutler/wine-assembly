'use strict';
const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const o = require('../tools/maelstrom-select-lifecycle-observer.cjs');
const actual = require('./fixtures/maelstrom-select-arrival-20261024.json')[0];
const defaults = { enabled: true, startBatch: 36164, endBatch: 36180, maxInvocations: 16 };
function fixture(factory = o.createObserver, options = {}) {
  const lines = [], obs = factory(line => lines.push(line), { ...defaults, ...options });
  const s = { ...actual.after }, original = { ...actual.after };
  // Rebase only synthetic linear backing, retaining every actual guest value.
  const image = s.esp - 0x1000, memory = { buffer: new ArrayBuffer(0x15000) };
  const stack = [...actual.detail.stack], meta = [...actual.detail.thunkWords];
  let gets = 0, unsafe = 0, runs = 0, receiverErrors = 0, next = null;
  const result = {}, error = Error('guest sentinel'), e = {};
  for (const k of Object.keys(s)) e['get_' + k] = () => { gets++; return s[k]; };
  e.get_image_base = () => { gets++; return image; };
  e.get_thunk_base = () => 0x7500000; e.get_thunk_end = () => 0x7505000;
  e.thunk_word = (_, word) => meta[word];
  for (const name of ['guest_read32', 'guest_read8', 'guest_to_wasm', 'clear_yield', 'vlan_pump', 'set_bp'])
    e[name] = () => { unsafe++; throw Error('observer must not call ' + name); };
  e.run = function (...args) { runs++; if (this !== e) receiverErrors++; if (next) next(args); return result; };
  function put() {
    const view = new DataView(memory.buffer);
    stack.forEach((v, i) => view.setUint32(0x13000 + i * 4, v, true));
  }
  put(); Object.freeze(e);
  const instance = { exports: e }, wrapped = obs.wrapInstance(instance, memory);
  obs.setBatch(36164);
  return { s, original, stack, meta, put, obs, lines, memory, instance, wrapped, error,
    setNext: fn => next = fn, run: () => assert.equal(wrapped.exports.run(1000), result),
    counters: () => ({ gets, unsafe, runs, receiverErrors }),
    finish: () => { obs.finish(); return lines.length ? JSON.parse(lines.at(-1).slice(lines.at(-1).indexOf('{'))) : null; } };
}
function arrivalOracle(factory) {
  const f = fixture(factory);
  Object.assign(f.s, actual.before); f.setNext(() => Object.assign(f.s, actual.after)); f.run();
  const row = f.finish();
  assert.equal(row.arrival.phase, 'after'); assert.equal(row.arrival.batch, actual.batch);
  assert.equal(row.parkedSnapshots, 1); assert.equal(row.observedRetryPairs, 0);
  assert.equal(row.witnessedReturns, 0); assert.equal(row.apiResult, 'unavailable');
  assert.equal(row.apiCompletion, 'unobserved'); assert.equal(row.stop, 'partial-window');
  assert.equal(row.identity.returnAddress, actual.detail.stack[0]);
  assert.equal(f.counters().unsafe, 0); return row;
}
function retryOracle(factory) {
  const f = fixture(factory); f.setNext(() => { f.s.last_run_halt = 4; }); f.run();
  // Runner source clears reason8 before the next run; the observer never does.
  f.s.yield_reason = 0; f.setNext(() => { f.s.yield_reason = 8; f.s.last_run_halt = 3; }); f.run();
  f.s.yield_reason = 0; f.s.tick_count += 20; f.run();
  const row = f.finish();
  assert.equal(row.observedRetryPairs, 2); assert.equal(row.pendingGuardPairs, 1);
  assert(row.tickComparisons.frozen > 0); assert(row.tickComparisons.progressing > 0);
  assert.equal(row.apiCompletion, 'unobserved'); assert.equal(row.apiResult, 'unavailable');
  assert.equal(row.witnessedReturns, 0); assert.equal(f.counters().runs, 3);
  assert.equal(row.hostTickAtSelect, 'unavailable');
  assert.equal(f.counters().unsafe, 0); assert.equal(f.counters().receiverErrors, 0);
}
function returnOracle(factory) {
  const f = fixture(factory); f.run(); f.s.yield_reason = 0;
  f.setNext(() => { f.s.eip = actual.detail.stack[0]; f.s.esp += 24; }); f.run();
  const row = f.finish();
  assert.equal(row.returnCandidates, 1); assert.equal(row.unknownTransitions, 1);
  assert.equal(row.witnessedReturns, 0); assert.equal(row.apiResult, 'unavailable');
  // Deliberately stale EAX is the actual nfds/socket-shaped value, not a result.
  assert.equal(f.s.eax, 0x53000001); assert.equal(row.apiCompletion, 'unobserved');
}
function unrelatedOracle(factory) {
  for (const change of [f => { f.meta[1] = 935; }, f => { f.stack[1]++; f.put(); },
    f => { f.s.eip += 8; }, f => { f.s.esp += 4; }]) {
    const f = fixture(factory); f.run(); change(f); f.run();
    const row = f.finish(); assert.equal(row.observedRetryPairs, 0);
    assert(row.unrelatedNetWaitSnapshots > 0); assert.equal(row.unknownTransitions, 1);
    assert.equal(row.witnessedReturns, 0);
  }
}
function guardOracle(factory) {
  const f = fixture(factory, { maxInvocations: 1 }); f.run();
  const before = f.counters().gets; for (let i = 0; i < 100; i++) f.run();
  assert.equal(f.counters().gets, before); assert.equal(f.counters().runs, 101);
  const row = f.finish(); assert.equal(row.stop, 'observation-cap');
  assert.equal(f.lines.length, 1); assert(Buffer.byteLength(f.lines.join('')) <= 4096);
  f.obs.finish(); assert.equal(f.lines.length, 1); assert.equal(row.calls, 1);
  const disabled = fixture(factory, { enabled: false });
  assert.equal(disabled.wrapped, disabled.instance); disabled.run(); disabled.finish();
  assert.equal(disabled.counters().gets, 0); assert.equal(disabled.lines.length, 0);
}
function boundsOracle(factory) {
  const f = fixture(factory); f.s.esp = f.original.esp - 0x1010;
  let bufferReads = 0;
  Object.defineProperty(f.memory, 'buffer', { get() { bufferReads++; throw Error('out of bounds'); } });
  f.run(); const row = f.finish(); assert.equal(row.arrival, null); assert.equal(bufferReads, 0);
  assert.equal(f.counters().unsafe, 0);
}
function disabledOptionsOracle(factory = o.createObserver, transform = o.transform) {
  const sentinel = Error('unused disabled access');
  const fail = () => { throw sentinel; };
  const opaque = new Proxy({}, { get: fail, ownKeys: fail, getOwnPropertyDescriptor: fail });
  const unusedTransform = ['lifecycle', 'exportsSource', 'schedulerSource', 'unused', Symbol('unused')];
  const unusedObserver = ['startBatch', 'endBatch', 'maxInvocations', 'maxBytes', 'unused', Symbol('unused')];
  // Missing, explicitly undefined and false all select the disabled path.
  for (const enabled of [false, undefined, 'absent']) {
    const options = keys => {
      const value = enabled === 'absent' ? {} : { enabled };
      for (const key of keys) Object.defineProperty(value, key, { enumerable: true, get: fail });
      return value;
    };
    for (const opts of [options(unusedTransform), new Proxy(options([]), {
      get(target, key) { if (key !== 'enabled') fail(); return target[key]; },
      ownKeys: fail, getOwnPropertyDescriptor: fail,
    })]) assert.equal(transform(opaque, opts), opaque);
    for (const opts of [options(unusedObserver), new Proxy(options([]), {
      get(target, key) { if (key !== 'enabled') fail(); return target[key]; },
      ownKeys: fail, getOwnPropertyDescriptor: fail,
    })]) {
      const observer = factory(fail, opts);
      assert.equal(observer.wrapInstance(opaque, opaque), opaque);
      observer.setBatch(36164); observer.finish(); observer.finish();
      assert.equal(observer.stats().calls, 0); assert.equal(observer.stats().records, 0);
    }
  }
  assert.equal(transform(opaque), opaque);
  const observer = factory(fail);
  assert.equal(observer.wrapInstance(opaque, opaque), opaque); observer.finish();
}
disabledOptionsOracle();
// Enabled invalid configuration must reject before touching source, pins or guest.
{
  let guestReads = 0;
  const guest = new Proxy({}, { get() { guestReads++; throw Error('guest access'); } });
  assert.throws(() => o.transform(guest, { enabled: true, lifecycle: { maxInvocations: 0 } }),
    /invalid configuration/);
  assert.throws(() => o.createObserver(() => {}, { enabled: true, maxBytes: 0 }).wrapInstance(guest, guest),
    /invalid configuration/);
  assert.equal(guestReads, 0);
}
const actualSummary = arrivalOracle(o.createObserver);
for (const oracle of [retryOracle, returnOracle, unrelatedOracle, guardOracle, boundsOracle]) oracle(o.createObserver);
for (const change of [f => { f.s.eip = 0x123456; }, f => { f.s.yield_reason = 10; },
  f => { f.s.esp += 40; }]) {
  const f = fixture(); f.run(); change(f); f.run();
  assert.equal(f.finish().apiCompletion, 'unobserved');
}
const nohit = fixture(); nohit.meta[1] = 935; nohit.run(); nohit.obs.setBatch(36181);
assert.equal(nohit.finish().coverage, 'no-qualified-hit; invocation boundaries only');
const outside = fixture(); outside.obs.setBatch(36163); outside.run(); outside.obs.setBatch(36181); outside.run();
assert.equal(outside.counters().gets, 0); assert.equal(outside.finish().stop, 'window-ended');
for (const bad of [{ maxInvocations: 0 }, { maxInvocations: 4097 }, { maxBytes: 0 }, { maxBytes: 8193 },
  { startBatch: -1 }, { endBatch: 999999 }, { enabled: 1 }, { typo: true }])
  assert.throws(() => fixture(o.createObserver, bad), /invalid configuration/);
const thrown = fixture(); thrown.setNext(() => { throw thrown.error; });
assert.throws(() => thrown.wrapped.exports.run(7), err => err === thrown.error);
assert.equal(thrown.finish().unknownTransitions, 1);
const receipts = [];
for (const [name, from, to, oracle] of [
  ['dedup-as-stall', 'apiCompletion: \'unobserved\'', 'apiCompletion: \'stalled\'', arrivalOracle],
  ['stale-EAX-as-result', 'apiResult: unavailable', 'apiResult: last.eax || 0x53000001', returnOracle],
  ['unrelated-call-conflation', 'key(s) === identity.key', 'true', unrelatedOracle],
  ['observation-cap-bypass', 'finished || capped || failure', 'finished || failure', guardOracle],
  ['disabled-path-wrapper', 'if (!enabled) return instance;', 'if (false) return instance;', guardOracle],
  ['direct-window-guard', 'start < 0x12000', 'false', boundsOracle],
  ['extra-clear', 'calls++;', 'e.clear_yield(); calls++;', retryOracle],
  ['disabled-eager-option-read', 'enabled ? options : {}', 'options', disabledOptionsOracle],
]) {
  const source = o.createObserver.toString(); assert(source.includes(from), name);
  const factory = vm.runInNewContext('(' + source.replace(from, to) + ')', { Buffer });
  assert.throws(() => oracle(factory), undefined, name);
  receipts.push({ name, rejected: true });
}
{
  const source = o.transform.toString();
  const from = '  if (!enabled) return source;';
  assert(source.includes(from));
  const transform = vm.runInNewContext('(' + source.replace(from,
    '  void options.lifecycle; void options.exportsSource;\n' + from) + ')',
    { base: require('../tools/maelstrom-event-boundary-observer.cjs'), createObserver: o.createObserver });
  assert.throws(() => disabledOptionsOracle(o.createObserver, transform));
  receipts.push({ name: 'disabled-eager-transform-read', rejected: true });
}
if (process.argv.length > 2) {
  const [runner, exportsPath, scheduler] = process.argv.slice(2);
  const source = fs.readFileSync(runner, 'utf8');
  assert.equal(o.transform(source), source);
  const enabled = o.transform(source, { enabled: true,
    exportsSource: fs.readFileSync(exportsPath, 'utf8'), schedulerSource: fs.readFileSync(scheduler, 'utf8') });
  new vm.Script(enabled);
  assert(enabled.includes('maelstromSelect.setBatch(batch)'));
  assert(enabled.includes('maelstromSelect.finish()'));
  assert.throws(() => o.transform(source, { enabled: true, lifecycle: { maxBytes: -1 } }), /invalid configuration/);
  // Execute the actual transformed setup with an instantiate SENTINEL only.
  // No WebAssembly compilation, module, memory or instance is created.
  const start = enabled.indexOf('  const maelstromSelect =');
  const end = enabled.indexOf('  ctx.exports = instance.exports;', start);
  assert(start > 0 && end > start);
  const f = fixture(o.createObserver, { enabled: false }), lines = [];
  let instantiateCalls = 0;
  const setup = vm.runInNewContext('(async () => {' + enabled.slice(start, end) +
    '\nreturn {instance, maelstromEvents, maelstromSelect};})()', {
    Buffer, wasmModule: 17, imports: 23, memory: f.memory,
    process: { stderr: { write: line => lines.push(line) } },
    WebAssembly: { instantiate: async (module, imports) => {
      assert.equal(module, 17); assert.equal(imports, 23); instantiateCalls++; return f.instance;
    } },
  });
  setup.then(({ instance, maelstromEvents, maelstromSelect }) => {
    maelstromEvents.setBatch(36164); maelstromSelect.setBatch(36164);
    instance.exports.run(1000); f.s.yield_reason = 0;
    f.setNext(() => { f.s.yield_reason = 8; f.s.last_run_halt = 3; });
    instance.exports.run(1000);
    maelstromEvents.finish(); maelstromSelect.finish();
    assert.equal(instantiateCalls, 1); assert.equal(f.counters().runs, 2);
    assert.equal(f.counters().unsafe, 0); assert.equal(f.counters().receiverErrors, 0);
    const row = JSON.parse(lines.find(s => s.startsWith('[MAELSTROM-SELECT]')).split('] ')[1]);
    assert.equal(row.observedRetryPairs, 1); assert.equal(row.apiResult, 'unavailable');
    assert(lines.some(s => s.startsWith('[MAELSTROM-EVENT]')));
    console.log(JSON.stringify({ status: 'PASS', injectedSetup: 'nested accepted/lifecycle facades; fake instantiate only', runs: 2 }));
  }).catch(e => { console.error(e); process.exitCode = 1; });
}
console.log(JSON.stringify({ status: 'PASS', scope: 'offline only; no native acceptance', actualSummary, mutations: receipts }));

'use strict';
const assert = require('assert/strict'), fs = require('fs'), vm = require('vm');
const o = require('../tools/maelstrom-event-boundary-observer.cjs');
const [runnerPath, exportsPath, schedulerPath] = process.argv.slice(2);
const input = fs.readFileSync(runnerPath, 'utf8'), exportsSource = fs.readFileSync(exportsPath, 'utf8');
const schedulerSource = fs.readFileSync(schedulerPath, 'utf8');
const enabled = o.transform(input, { enabled: true, exportsSource, schedulerSource });
assert.equal(o.transform(input), input);
assert.equal(o.transform(input, { enabled: false }), input);
new vm.Script(enabled);
for (const [source, ex, sched, message] of [[input + '\n', exportsSource, schedulerSource, /runner pin/],
  [input, exportsSource + '\n', schedulerSource, /exports pin/], [input, exportsSource, schedulerSource + '\n', /scheduler pin/]])
  assert.throws(() => o.transform(source, { enabled: true, exportsSource: ex, schedulerSource: sched }), message);
const ordinary = 'if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);\n      else if (instance.exports.get_yield_reason() === 16) renderParkStats.skippedBatches++;';
const parallel = 'try { instance.exports.run(BATCH_SIZE); } catch (e) { /* reported below */ }';
const cooperative = 'try { instance.exports.run(BATCH_SIZE); } catch (e) { break; }';
for (const site of [ordinary, parallel, cooperative]) {
  assert(input.includes(site)); assert(enabled.includes(site));
}
assert.equal(enabled.match(/instance\.exports\.run\(BATCH_SIZE\)/g).length, 3);
// Execute the ACTUAL pinned scheduler method, not a replacement scheduler.
const methodStart = schedulerSource.indexOf('  _dispatchCooperativeSend(target, request, depth) {');
const methodEnd = schedulerSource.indexOf('\n  // Win32 delivers a SendMessage', methodStart);
assert(methodStart > 0 && methodEnd > methodStart);
const schedulerMethod = schedulerSource.slice(methodStart, methodEnd);
const Scheduler = vm.runInNewContext('(class {\n' + schedulerMethod + '\n})');
function fixture(overrides = {}) {
  const memory = { buffer: new ArrayBuffer(0x18000) }, view = new DataView(memory.buffer);
  const s = { eip: 0x75040f8, edi: 0x52e430, eax: 0x53000001, ebp: 5, esp: 0x401000,
    yield_reason: 8, yield_flag: 0, last_run_halt: 4, bp_addr: 0x7a3362,
    cache_stores: 5451, cache_clears: 2, cache_invals: 4552, tick_count: 1234,
    entries: [0, 0], apiId: 934, dispatches: 0, clearCalls: 0, receiverErrors: 0,
    beginCalls: 0, endCalls: 0, postCalls: 0, ...overrides };
  const put = (addr, values) => values.forEach((v, i) => view.setUint32(addr - 0x400000 + 0x12000 + i * 4, v, true));
  put(0x401000, [0x7a3366, 0, 0x402000, 0, 0x402020, 0x403000]);
  put(0x402000, [3, 11, 22, 33]); put(0x402020, [1, 44]); put(0x403000, [1, 500]);
  const calls = [], result = { preserved: 'return identity' }, error = { preserved: 'throw identity' };
  const e = {};
  for (const k of Object.keys(s)) e['get_' + k] = () => s[k];
  e.get_count = i => s.entries[i]; e.get_image_base = () => 0x400000;
  e.get_thunk_base = () => 0x7500000; e.get_thunk_end = () => 0x7505000;
  e.thunk_word = (addr, word) => { assert.equal(addr, 0x75040f8); return word ? s.apiId : 0x123456; };
  // Any accidental translation or guest-read call is a semantic violation.
  e.guest_to_wasm = e.guest_read32 = e.guest_read8 = () => { s.unsafeCalls = (s.unsafeCalls || 0) + 1; throw error; };
  e.clear_yield = () => { s.clearCalls++; s.yield_reason = 0; };
  e.thread_send_begin = () => { s.beginCalls++; return 1; };
  e.thread_send_end = () => { s.endCalls++; return 0; };
  e.thread_send_post = (hwnd, msg, w, l, kind, result) => { s.postCalls++; return result; };
  e.run = function (...args) {
    if (this !== e) s.receiverErrors++;
    calls.push(args);
    if (s.yield_reason) { s.entries[0]++; s.last_run_halt = 4; }
    else { s.dispatches++; if (s.next) Object.assign(s, s.next); }
    if (s.throwRun) throw error;
    return result;
  };
  Object.freeze(e); // WebAssembly exports have immutable data properties.
  return { s, e, memory, calls, result, error, put, instance: { exports: e } };
}
const parse = line => JSON.parse(line.slice(line.indexOf('{')));
function observed(f, options, factory = o.createObserver) {
  const lines = [], observer = factory(line => lines.push(line), options);
  return { lines, observer, instance: observer.wrapInstance(f.instance, f.memory), rows: () => lines.map(parse) };
}
async function productionSetup(source, f, lines) {
  const start = source.indexOf(source === input ? o.anchors.instance : '  const maelstromEvents =');
  const end = source.indexOf('  ctx.exports = instance.exports;', start);
  assert(start >= 0 && end > start);
  const script = '(async () => {\n' + source.slice(start, end) + '\nreturn { instance, observer: typeof maelstromEvents === "undefined" ? null : maelstromEvents }; })()';
  return vm.runInNewContext(script, { WebAssembly: { instantiate: async (module, imports) => {
    assert.equal(module, 17); assert.equal(imports, 23); return f.instance;
  } }, wasmModule: 17, imports: 23, memory: f.memory, Buffer, process: { stderr: { write: s => lines.push(s) } } });
}
function schedulerFor(instance) {
  const scheduler = new Scheduler(); scheduler.mainInstance = instance;
  scheduler._renderSendTargets = new Set(); scheduler.snapshots = 0; scheduler.restores = 0;
  scheduler._snapshotCooperativeSend = target => { assert.equal(target, instance.exports); scheduler.snapshots++; return {}; };
  scheduler._restoreCooperativeSend = () => scheduler.restores++;
  return scheduler;
}
async function invocationOracle(source) {
  const f = fixture(), lines = [], setup = await productionSetup(source, f, lines);
  const context = { instance: setup.instance, BATCH_SIZE: 1000, mainExecutionSuspended: () => false,
    renderParkStats: { skippedBatches: 0 } };
  vm.runInNewContext(ordinary, context);
  vm.runInNewContext(parallel, context);
  vm.runInNewContext('for (let s = 0; s < 1; s++) { ' + cooperative + ' }', context);
  // A main invocation hidden inside cooperative SendMessage dispatch.
  const scheduler = schedulerFor(setup.instance);
  assert.equal(scheduler._dispatchCooperativeSend(setup.instance.exports, {}, 0), 0);
  assert.equal(scheduler.snapshots, 1); assert.equal(scheduler.restores, 1);
  assert.equal(f.s.beginCalls, 1); assert.equal(f.s.endCalls, 1); assert.equal(f.s.postCalls, 0);
  assert.deepEqual(f.calls, [[1000], [1000], [1000], [1000000]]);
  assert.equal(f.s.clearCalls, 0); assert.equal(f.s.dispatches, 0);
  assert.equal(f.s.receiverErrors, 0);
  assert.equal(setup.instance.exports.run(9, 10), f.result);
  f.s.throwRun = true;
  assert.throws(() => setup.instance.exports.run(11), err => err === f.error);
  // Existing production catches retain their own behavior for the same throw.
  vm.runInNewContext(parallel, context);
  vm.runInNewContext('for (let s = 0; s < 2; s++) { ' + cooperative + ' }', context);
  context.mainExecutionSuspended = () => true; f.s.yield_reason = 16;
  const count = f.calls.length; vm.runInNewContext(ordinary, context);
  assert.equal(f.calls.length, count); assert.equal(context.renderParkStats.skippedBatches, 1);
  return { calls: f.calls, dispatches: f.s.dispatches, clearCalls: f.s.clearCalls, receiverErrors: f.s.receiverErrors };
}
function schedulerCoverageOracle(source) {
  return productionSetup(source, fixture(), []).then(setup => {
    const f = fixture(), lines = [], probe = o.createObserver(s => lines.push(s));
    // Injected setup must pass the wrapped exports to scheduler ownership.
    const instance = setup.instance;
    const scheduler = schedulerFor(instance);
    scheduler._dispatchCooperativeSend(instance.exports, {}, 0);
    // A fresh fixture is used below to assert event data from ONLY that method.
    const obs = probe.wrapInstance(f.instance, f.memory);
    schedulerFor(obs)._dispatchCooperativeSend(obs.exports, {}, 0);
    assert(lines.map(parse).some(r => r.runArgs[0] === 1000000));
    // The production setup observer exposes a nonzero event count only if its
    // actual instance is the one handed to the scheduler.
    assert(setup.observer && setup.observer.stats().records >= 2);
  });
}
function triggerOracle(factory = o.createObserver) {
  const f = fixture(), a = observed(f, undefined, factory);
  a.observer.setBatch(41234); // Deliberately unrelated to historical 36163.
  a.instance.exports.run(1000);
  const [pre, post] = a.rows();
  assert(pre.events.includes('select-net-wait')); assert.equal(pre.batch, 41234);
  assert.deepEqual(pre.detail.thunkWords, [0x123456, 934]);
  assert.deepEqual(pre.detail.stack, [0x7a3366, 0, 0x402000, 0, 0x402020, 0x403000]);
  assert.deepEqual(pre.detail.fdSets, [{ count: 3, prefix: [11, 22], truncated: true }, 'NULL', { count: 1, prefix: [44], truncated: false }]);
  assert.deepEqual(pre.detail.timeval, [1, 500]);
  assert.equal(pre.before.tick_count, 1234); assert.equal(pre.before.selectDeadline, 'unavailable');
  assert.equal(post.observation, 'pending-reason-guard-before-dispatch');
  assert.equal(post.movCallExecuted, false); assert.equal(post.apiCompletion, 'unobserved');
  assert.equal(post.apiResult, 'unattributed'); assert.equal(f.s.dispatches, 0);
  assert.equal(f.s.unsafeCalls || 0, 0);
  // Entries can change arbitrarily without proving execution.
  f.s.entries = [972, 972]; f.s.eip = 0x7a3362; f.s.yield_reason = 1;
  a.observer.setBatch(50000); a.instance.exports.run(1000);
  const h = a.rows().at(-1);
  assert.equal(h.batch, 50000); assert.equal(h.movCallExecuted, false);
  assert.equal(h.before.yield_reason, 1); assert.deepEqual(h.before.entries, [972, 972]);
  f.s.eip = 0x7a3366; f.s.yield_reason = 0; f.s.next = { eip: 0x400005 };
  a.instance.exports.run(1000);
  assert(a.rows().some(r => r.events.includes('head')));
  assert(a.rows().some(r => r.events.includes('interior')));
  assert.equal(a.rows().at(-1).movCallExecuted, 'UNKNOWN');
  a.observer.finish(); const once = a.lines.length; a.observer.finish(); assert.equal(a.lines.length, once);
  assert(a.lines.length <= 16); assert(Buffer.byteLength(a.lines.join('')) <= 8192);
  return a;
}
function boundsOracle(factory = o.createObserver) {
  for (const [esp, expected] of [[0, 'NULL'], [0xfffffffc, 'out-of-range'],
    [0x50000000, 'out-of-range'], [0x3ee0f0, 'out-of-range'], [0x405ffc, 'out-of-range']]) {
    const f = fixture({ esp }), a = observed(f, undefined, factory);
    a.instance.exports.run(1000);
    assert.equal(a.rows()[0].detail.stack, expected, 'invalid span must not decode');
    assert.equal(f.s.unsafeCalls || 0, 0);
  }
  const f = fixture(), a = observed(f, undefined, factory);
  f.put(0x402000, [65]); f.put(0x401000, [0, 0, 0x402000, 0x50000000, 0, 0xfffffffc]);
  a.instance.exports.run(1000);
  assert.deepEqual(a.rows()[0].detail.fdSets, ['out-of-range', 'out-of-range', 'NULL']);
  assert.equal(a.rows()[0].detail.timeval, 'out-of-range');
}
async function main() {
  assert.deepEqual(await invocationOracle(input), await invocationOracle(enabled));
  await schedulerCoverageOracle(enabled);
  const primary = triggerOracle(); boundsOracle();
  // First select park discovered AFTER a real call, and head reached by the
  // scheduler at another batch. No preexisting reason is required for arrival.
  const f = fixture({ eip: 0x400100, yield_reason: 0, next: { eip: 0x75040f8, yield_reason: 8, last_run_halt: 3 } });
  const a = observed(f); a.observer.setBatch(77); a.instance.exports.run(1000);
  assert.equal(a.rows().length, 1); assert.equal(a.rows()[0].kind, 'after');
  assert(a.rows()[0].events.includes('select-net-wait'));
  f.s.eip = 0x400200; f.s.yield_reason = 0; f.s.next = { eip: 0x7a3362, last_run_halt: 5 };
  a.observer.setBatch(99); schedulerFor(a.instance)._dispatchCooperativeSend(a.instance.exports, {}, 0);
  assert(a.rows().some(r => r.batch === 99 && r.after.eip === 0x7a3362));
  assert(a.rows().some(r => r.runArgs[0] === 1000000));
  // A completed scheduler callback is delivered once, including its post hook.
  const completed = fixture({ eip: 0x400100, yield_reason: 0, next: { eip: 0 } }), co = observed(completed);
  schedulerFor(co.instance)._dispatchCooperativeSend(co.instance.exports, {}, 0);
  assert.equal(completed.calls.length, 1); assert.equal(completed.s.beginCalls, 1);
  assert.equal(completed.s.endCalls, 1); assert.equal(completed.s.postCalls, 1);
  // Wrong reasons, neighboring API ids and non-target addresses must not fire.
  for (const overrides of [{ yield_reason: 1 }, { apiId: 933 }, { eip: 0x7504100, apiId: 933 }]) {
    const f = fixture(overrides), a = observed(f); a.instance.exports.run(1000);
    assert.equal(a.rows().length, 0);
  }
  // Missing exports are explicit, and no invented getter is called.
  const missing = fixture(); missing.instance.exports = Object.freeze({ run: missing.e.run,
    get_eip: missing.e.get_eip, get_yield_reason: missing.e.get_yield_reason });
  const m = observed(missing); m.instance.exports.run(1000);
  assert(m.rows()[0].events.includes('select-address-net-wait-unverified'));
  assert.equal(m.rows()[0].detail.thunkWords, 'unavailable'); assert.equal(m.rows()[0].detail.stack, 'unavailable');
  assert.equal(m.rows()[0].before.edi, 'unavailable');
  for (const options of [{ maxRecords: 1 }, { maxBytes: 100 }, { maxRecords: 0 }, { maxBytes: 0 }]) {
    const f = fixture(), a = observed(f, options);
    for (let i = 0; i < 30; i++) { f.s.eip = i % 2 ? 0x7a3362 : 0x7a3366; a.instance.exports.run(i); }
    a.observer.finish(); assert.equal(f.calls.length, 30);
    assert(a.lines.length <= (options.maxRecords ?? 16));
    assert(Buffer.byteLength(a.lines.join('')) <= (options.maxBytes ?? 8192));
    assert(a.observer.stats().stopped);
  }
  assert.throws(() => o.createObserver(() => {}, { maxBytes: 8193 }), /limits/);
  assert.throws(() => o.createObserver(() => {}, { maxRecords: 17 }), /limits/);
  // Observation failures cannot replace a run return/throw or suppress it.
  const failure = fixture(), failObs = o.createObserver(() => { throw Error('sink'); });
  const failInstance = failObs.wrapInstance(failure.instance, failure.memory);
  assert.equal(failInstance.exports.run(1), failure.result); failure.s.throwRun = true;
  assert.throws(() => failInstance.exports.run(2), err => err === failure.error);
  assert.equal(failure.calls.length, 2);
  o.validateConfig({ counts: [0x7a3362, 0x7a3366], noBuild: true, wasmPinned: true });
  for (const c of [{ counts: [] }, { counts: [0x7a3366, 0x7a3362] },
    { counts: [0x7a3362, 0x7a3366], workerThreads: true }, { counts: [0x7a3362, 0x7a3366], watch: 'x' }])
    assert.throws(() => o.validateConfig({ noBuild: true, wasmPinned: true, ...c }), /event observer/);
  for (const c of [{ noBuild: false, wasmPinned: true }, { noBuild: true, wasmPinned: false }])
    assert.throws(() => o.validateConfig({ counts: [0x7a3362, 0x7a3366], ...c }), /explicit prebuilt/);
  // Execute actual injected preflight, before an allocation/run sentinel.
  const preflight = enabled.slice(enabled.indexOf('\n(' + o.validateConfig.toString()) + 1,
    enabled.indexOf("  throw Error('event observer: installed scheduler pin');") + "  throw Error('event observer: installed scheduler pin');".length);
  let sentinel = 0;
  const preContext = { NO_BUILD: true, WASM_PINNED: true, WORKER_THREADS: false, WATCH_SPEC: '', WATCH_BYTE: '', WATCH_WORD: '',
    countAddrs: [0x7a3362, 0x7a3366], __dirname: '/test',
    require: name => name === 'fs' ? { readFileSync: () => schedulerSource } : require(name), touch: () => sentinel++ };
  vm.runInNewContext(preflight + '\ntouch();', preContext); assert.equal(sentinel, 1);
  assert.throws(() => vm.runInNewContext(preflight + '\ntouch();', { ...preContext, WORKER_THREADS: true }), /unsupported/);
  assert.throws(() => vm.runInNewContext(preflight + '\ntouch();', { ...preContext,
    require: name => name === 'fs' ? { readFileSync: () => schedulerSource + '\n' } : require(name) }), /installed scheduler pin/);
  assert.equal(sentinel, 1);
  const moduleGuardStart = enabled.indexOf("    if (require('crypto').createHash('sha256').update(wasmBytes)");
  const moduleGuardEnd = enabled.indexOf("      throw Error('event observer: module pin');", moduleGuardStart) + "      throw Error('event observer: module pin');".length;
  assert(moduleGuardStart > 0 && moduleGuardEnd > moduleGuardStart);
  assert.throws(() => vm.runInNewContext(enabled.slice(moduleGuardStart, moduleGuardEnd) + '\ntouch();',
    { require, wasmBytes: Buffer.from('not a module; never compiled'), touch: () => sentinel++ }), /module pin/);
  assert.equal(sentinel, 1);
  const trapped = fixture({ throwRun: true }), tr = observed(trapped);
  assert.throws(() => tr.instance.exports.run(1000), err => err === trapped.error);
  assert.equal(tr.rows().at(-1).threw, true);
  assert.equal(tr.rows().at(-1).movCallExecuted, 'UNKNOWN');
  // Rejecting mutations exercise the same executable oracles above.
  let rejected = 0;
  const mutate = (from, to) => {
    const source = o.createObserver.toString(); assert(source.includes(from));
    return vm.runInNewContext('(' + source.replace(from, to) + ')', { Buffer });
  };
  for (const [from, to, oracle] of [
    ["if (s.yield_reason === 8)", "if (s.yield_reason === 1)", triggerOracle],
    ["pending ? false : 'UNKNOWN'", "true", triggerOracle],
    ["start < 0x12000", "false", boundsOracle],
  ]) { assert.throws(() => oracle(mutate(from, to))); rejected++; }
  for (const change of ["Reflect.apply(original, this === facade ? e : this, args);\n        Reflect.apply(original, this === facade ? e : this, args)",
    "(e.clear_yield(), Reflect.apply(original, this === facade ? e : this, args))"]) {
    // Alter the production-injected wrapper, retaining exact call-site harness.
    const mutant = enabled.replace('const result = Reflect.apply(original, this === facade ? e : this, args)', 'const result = ' + change);
    await assert.rejects(async () => assert.deepEqual(await invocationOracle(input), await invocationOracle(mutant)));
    rejected++;
  }
  const dropped = enabled.replace('return key === \'exports\' ? facade : Reflect.get(t, key, t)', 'return Reflect.get(t, key, t)');
  await assert.rejects(() => schedulerCoverageOracle(dropped)); rejected++;
  console.log(JSON.stringify({ status: 'PASS', qualification: 'offline controlled production call sites; no native/runtime qualification',
    productionSites: ['ordinary', 'parallel interleave', 'cooperative interleave', '_dispatchCooperativeSend target.run'],
    controls: ['disabled identity and invocation equivalence', 'shifted-batch head', 'preexisting and arriving net_wait',
      'thunk/stack/fd_sets/timeval', 'reason1 and neighbor id rejection', 'unavailable exports', 'complete read bounds',
      'record and byte caps', 'return/exception identity', 'no extra run/clear', 'preflight before allocation'],
    rejectingMutants: rejected, exampleRecords: primary.lines.length, exampleBytes: Buffer.byteLength(primary.lines.join('')) }));
}
main().catch(e => { console.error(e); process.exitCode = 1; });

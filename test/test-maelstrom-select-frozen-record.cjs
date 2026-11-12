'use strict';
// Source evaluator and host control-flow tests ONLY. No Wasm/native/guest run.
const assert = require('node:assert/strict'), fs = require('node:fs');
const path = require('node:path'), vm = require('node:vm'), Module = require('node:module');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const hook = require('../tools/maelstrom-select-completion-hook.cjs');
const runnerTool = require('../tools/maelstrom-select-frozen-runner.cjs');
const { Model, func, walk, parse } = require('./maelstrom-select-hook-model.cjs');
const [root, runnerPath, mode] = process.argv.slice(2);
assert(root && runnerPath, 'usage: HISTORICAL_SOURCE_ROOT PINNED_RUNNER [--baseline-live-result]');
const sha = s => createHash('sha256').update(s).digest('hex');
const adapterPath = path.resolve(__dirname, '../tools/maelstrom-select-frozen-record.cjs');
let adapter = require(adapterPath);
if (mode === '--baseline-live-result' || mode === '--baseline-live-fence') {
  // Reproduce the actual error class: substituting later EAX for latched EAX.
  // The SAME positive regression below must fail on this baseline.
  const s = fs.readFileSync(adapterPath, 'utf8');
  const from = mode === '--baseline-live-result' ? 'result: accepted.result, identity: accepted.identity' :
    'closed = true; // Persist once, even when the sink fails; never replay.';
  const to = mode === '--baseline-live-result' ? 'result: readLive().eax, identity: accepted.identity' :
    "if (readLive().eax !== accepted.result) throw Error('completion-time live fence required');\n" + from;
  assert.equal(s.split(from).length, 2);
  const m = new Module(adapterPath, module); m.filename = adapterPath;
  m.paths = Module._nodeModulePaths(path.dirname(adapterPath));
  m._compile(s.replace(from, to), adapterPath);
  adapter = m.exports;
}
const sources = Object.fromEntries(Object.keys(hook.PINS).map(p => [p, fs.readFileSync(path.join(root, p), 'utf8')]));
assert.equal(sha(fs.readFileSync(path.resolve(__dirname, '../tools/maelstrom-select-completion-hook.cjs'))),
  'b7c77c20b12cd582d6fcfbe246e1f0abdcb644266fc3f161bf5d683d93b13930');
const w = hook.transform(sources, { enabled: true })['src/09d-winsock.wat'];
let groups = 0;
function test(name, f) { f(); groups++; console.log('PASS ' + name); }
function fixture(ready = 7) {
  const m = new Model(w, ready, 100, false), events = [];
  const live = { eax: 0x53000001, esp: 4096, eip: 55, fdsets: [1, 2, 3] };
  const a = adapter.createAdapter(m, { enabled: true, persist: e => events.push(e), readLive: () => live, now: () => 12345 });
  return { m, a, events, live };
}
test('recorded positive completion survives later EAX/ESP/EIP/fdset changes', () => {
  const { m, a, live, events } = fixture(); a.start();
  assert.equal(a.observe(0), null); // Ordinary returns before any select.
  m.arm(); m.select();
  const latched = Object.fromEntries(hook.FIELDS.map(k => [k, m.g['$msc_' + k]]));
  m.mem.set(100, 0x9999); m.mem.set(116, 0x8888); m.g.$eip = 0x7777;
  Object.assign(live, { eax: m.mem.get(100), esp: m.mem.get(116), eip: m.g.$eip, fdsets: [9, 8, 7] });
  const e = a.observe(42);
  assert.equal(e.historicalCompletion.result, 7);
  assert.equal(e.historicalCompletion.attempt, 1);
  assert.deepEqual(e.historicalCompletion.identity, latched);
  assert.match(e.historicalCompletion.observation, /historical in-handler/);
  assert.equal(e.historicalCompletion.identity.post, 4120);
  assert(!('fdsets' in e.historicalCompletion));
  assert.equal(e.liveHostObservation.batch, 42); assert.equal(e.liveHostObservation.timeMs, 12345);
  assert.match(e.liveHostObservation.observation, /not completion-time/);
  assert.deepEqual(e.liveHostObservation.state, live);
  console.log(JSON.stringify({ modelOnly: true, sample: e }));
  live.fdsets[0] = 123; live.eax = 0;
  assert.equal(e.liveHostObservation.state.fdsets[0], 9);
  assert.throws(() => { e.historicalCompletion.result = 0; }, TypeError);
  assert(Object.isFrozen(e.historicalCompletion.identity));
  assert.equal(a.observe(43), null); assert.equal(events.length, 1);
  // Source-evaluated in-handler freeze: even a later call with new ownership
  // and live registers cannot overwrite the first recorded completion.
  m.g.$current_thread_id = 8; m.g.$reg_base = 200; m.g.$current_thunk_eip = 900;
  m.mem.set(200, 88); m.mem.set(216, 6000); m.arm(); m.select();
  assert.deepEqual(hook.snapshot(m.exports), latched);
});
test('disabled adapter/transform never inspect opaque owner/source or unused options', () => {
  const p = Proxy.revocable({}, {}); p.revoke();
  const options = { enabled: false, get persist() { throw Error('unused sink'); } };
  const a = adapter.createAdapter(p.proxy, options); a.start(p.proxy); assert.equal(a.observe(p.proxy), null);
  assert.equal(runnerTool.transform(p.proxy, options), p.proxy);
});
test('duplicate starts and duplicate instance/export ownership reject', () => {
  const { m, a } = fixture(); a.start();
  assert.throws(() => a.start(), /already used/);
  assert.throws(() => adapter.createAdapter(m, { enabled: true }), /owner/);
  assert.throws(() => adapter.createAdapter({ exports: m.exports }, { enabled: true }), /owner/);
  const f = fixture(); f.m.exports.msc_start(); assert.throws(() => f.a.start(), /pristine/);
  const g = fixture(); assert.throws(() => g.a.observe(0), /start required/);
});
test('stale EAX on park never becomes completion; repeated parks are harmless polls', () => {
  const { m, a, events } = fixture(0); a.start(); m.arm(); m.select();
  assert.equal(m.mem.get(100), 0x53000001);
  assert.equal(a.observe(1), null); assert.equal(a.observe(2), null); assert.equal(events.length, 0);
  m.g.$yield_reason = 0; m.mem.set(116, 4096); m.ready = 9; m.arm(); m.select();
  const e = a.observe(3); assert.equal(e.historicalCompletion.attempt, 2); assert.equal(e.historicalCompletion.result, 9);
});
test('missing attempts and counter gaps reject at ordinary return', () => {
  const { m, a, events } = fixture(0); a.start(); m.arm(); m.select();
  m.g.$yield_reason = 0; m.mem.set(116, 4096); m.ready = 9; m.arm(); m.select();
  assert.throws(() => a.observe(1), /counter gap/); assert.equal(events.length, 0);
  assert.equal(a.observe(2), null);
});
test('authentic oracle still rejects forged/replayed/mutated captures and wrong source/owner', () => {
  const terminal = () => { const m = new Model(w, 4, 100); m.arm(); m.select(); return m; };
  for (const change of [s => ({ ...s }), s => { s.result++; return s; }, s => new Proxy(s, {})]) {
    const m = terminal(), s = change(hook.snapshot(m.exports));
    assert.equal(hook.createOracle(m, m.exports).accept(m, s).kind, 'rejected');
  }
  const m = terminal(), other = terminal(), s = hook.snapshot(m.exports), o = hook.createOracle(m, m.exports);
  assert.equal(o.accept(m, s).kind, 'completion'); assert.equal(o.accept(m, s).kind, 'rejected');
  const n = terminal(); assert.equal(hook.createOracle(n, n.exports).accept({}, hook.snapshot(n.exports)).kind, 'rejected');
  assert.equal(hook.createOracle(other, other.exports).accept(other, hook.snapshot(terminal().exports)).kind, 'rejected');
});
test('exact pinned native source has freeze-before-write guards; model/source evidence only', () => {
  function guards(source) {
    for (const name of ['msc_arm', 'msc_enter']) {
      const f = func(source, name);
      const completionGuard = f.findIndex(n => Array.isArray(n) && n[0] === 'if' &&
        walk(n, x => x[0] === 'global.get' && x[1] === '$msc_completions').length);
      assert(completionGuard > 0);
      assert(walk(f[completionGuard], x => x[0] === 'return').length);
      for (const n of f.slice(0, completionGuard + 1))
        assert.equal(walk(n, x => x[0] === 'global.set').length, 0);
    }
    const end = func(source, 'msc_end');
    assert.equal(walk(end, n => n[0] === 'global.set' && !n[1].startsWith('$msc_')).length, 0);
    assert.equal(walk(end, n => n[0] === 'i32.store').length, 0);
    const handler = func(source, 'handle_select');
    assert.deepEqual(handler.at(-2), parse('(i32.store offset=0 (global.get $reg_base) (local.get $total))')[0]);
    assert.deepEqual(handler.at(-1), parse('(call $msc_end (local.get $msc_token) (i32.const 3))')[0]);
  }
  guards(w);
  const mutant = w.replace('(i32.or (global.get $msc_fault) (global.get $msc_completions))', '(i32.or (global.get $msc_fault) (i32.const 0))');
  assert.notEqual(mutant, w); assert.throws(() => guards(mutant));
});
const runner = fs.readFileSync(runnerPath, 'utf8');
const output = runnerTool.transform(runner, { enabled: true });
test('exact real runner round-trip preserves all untouched startup/input/clock/budget/catch bytes', () => {
  assert.equal(sha(runner), runnerTool.PIN); assert.equal(runnerTool.restore(output), runner);
  assert.equal((output.match(/instance\.exports\.run\(BATCH_SIZE\)/g) || []).length, 3);
  new vm.Script(output); // Parse only: no imports, instantiation or guest execution.
  for (const change of [s => s.replace('if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);', ''),
    s => s + '\n      if (!mainExecutionSuspended()) instance.exports.run(BATCH_SIZE);', s => s + '\n'])
    assert.throws(() => runnerTool.transform(change(runner), { enabled: true }), /anchor|pin/);
  assert.throws(() => runnerTool.transform(output, { enabled: true }), /anchor|pin/);
});
test('actual transformed ordinary boundary: run throws/suspended preserve behavior; success observes afterward', () => {
  const begin = output.indexOf('      if (!mainExecutionSuspended()) {\n        instance.exports.run(BATCH_SIZE);');
  const end = output.indexOf('\n    } catch (e)', begin);
  const fragment = output.slice(begin, end);
  for (const suspended of [true, false]) for (const throws of [true, false]) {
    const events = [], failure = {};
    const context = { mainExecutionSuspended: () => suspended, BATCH_SIZE: 1000, batch: 42,
      instance: { exports: { get_yield_reason: () => 0, run: size => { events.push(['run', size]); if (throws) throw failure; } } },
      mscFrozenObserve: batch => events.push(['observe', batch]), renderParkStats: { skippedBatches: 0 } };
    if (!suspended && throws) assert.throws(() => vm.runInNewContext(fragment, context), e => e === failure);
    else vm.runInNewContext(fragment, context);
    assert.deepEqual(events, suspended ? [] : throws ? [['run', 1000]] : [['run', 1000], ['observe', 42]]);
  }
});
test('actual transformed interleaved catches retain swallow versus break and skip observation on trap', () => {
  const re = /          let mscFrozenReturned = false;\n[^\n]+\n          if \(mscFrozenReturned\) mscFrozenObserve\(batch\);/g;
  const fragments = output.match(re); assert.equal(fragments.length, 2);
  for (let i = 0; i < 2; i++) for (const traps of [false, true]) {
    const events = [], context = { BATCH_SIZE: 1000, batch: 5,
      instance: { exports: { run: n => { events.push(['run', n]); if (traps) throw 17; } } },
      mscFrozenObserve: b => events.push(['observe', b]), continued: () => events.push(['continue']) };
    vm.runInNewContext('for (let s=0;s<1;s++) {\n' + fragments[i] + '\ncontinued();\n}', context);
    assert.deepEqual(events, !traps ? [['run', 1000], ['observe', 5], ['continue']] :
      i === 0 ? [['run', 1000], ['continue']] : [['run', 1000]]);
  }
});
test('actual transformed setup starts before startup; disabled option has no export/require/sink access', () => {
  const setup = output.slice(output.indexOf('  // Historical completion is latched'), output.indexOf('  ctx.exports = instance.exports;'));
  const dead = Proxy.revocable({}, {}); dead.revoke();
  vm.runInNewContext(setup, { instance: dead.proxy, getArg: () => null });
  const m = new Model(w, 7, 100, false), writes = [], errors = [];
  Object.assign(m.exports, { get_eax: () => 99, get_esp: () => 88, get_eip: () => 77 });
  const context = {
    instance: m, getArg: () => 'evidence.jsonl', require: () => adapter,
    fs: { appendFileSync: (...v) => writes.push(v) }, console: { error: (...v) => errors.push(v) },
  };
  vm.runInNewContext(setup + '\nthis.observe=mscFrozenObserve;', context);
  assert.equal(m.g.$msc_started, 1); assert.equal(writes.length, 0); assert.equal(errors.length, 0);
  m.arm(); m.select(); context.observe(9);
  assert.equal(writes.length, 1); assert.equal(writes[0][0], 'evidence.jsonl');
  const event = JSON.parse(writes[0][1]); assert.equal(event.historicalCompletion.result, 7);
  assert.equal(event.liveHostObservation.state.eax, 99); assert.equal(event.liveHostObservation.batch, 9);
  context.observe(10); assert.equal(writes.length, 1);
  // A stale source in a fresh setup fails diagnostically, without throwing.
  const bad = new Model(w, 1, 100), diagnosticErrors = [];
  vm.runInNewContext(setup, { instance: bad, getArg: () => 'unused.jsonl', require: () => adapter,
    console: { error: (...args) => diagnosticErrors.push(args) } });
  assert.equal(diagnosticErrors.length, 1);
});
if (!mode) test('same positive regression rejects live-result and overstrong live-fence baselines', () => {
  for (const [baseline, error] of [['--baseline-live-result', /39321 !== 7/],
    ['--baseline-live-fence', /completion-time live fence required/]]) {
    const p = spawnSync(process.execPath, ['--max-old-space-size=256', __filename, root, runnerPath, baseline],
      { timeout: 10000, maxBuffer: 16384 });
    assert.equal(p.status, 1); assert.match(p.stderr.toString(), error);
  }
});
console.log(JSON.stringify({ groups, modelSourceOnly: true, nativeRuns: 0, guestRuns: 0, hookSHAUnchanged: true }));

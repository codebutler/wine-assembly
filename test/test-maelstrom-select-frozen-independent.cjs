'use strict';
// Independent offline controls. Never instantiate Wasm or run a guest.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const hook = require('../tools/maelstrom-select-completion-hook.cjs');
const { createAdapter } = require('../tools/maelstrom-select-frozen-record.cjs');
const rt = require('../tools/maelstrom-select-frozen-runner.cjs');
const { Model } = require('./maelstrom-select-hook-model.cjs');
const [root, runnerPath, evidenceDirectory] = process.argv.slice(2);
assert(root && runnerPath && evidenceDirectory);
const sources = Object.fromEntries(Object.keys(hook.PINS).map(p => [p, fs.readFileSync(path.join(root, p), 'utf8')]));
const wat = hook.transform(sources, { enabled: true })['src/09d-winsock.wat'];
const runner = fs.readFileSync(runnerPath, 'utf8'), transformed = rt.transform(runner, { enabled: true });
const setup = transformed.slice(transformed.indexOf('  // Historical completion is latched'), transformed.indexOf('  ctx.exports = instance.exports;'));
const ordinaryStart = transformed.indexOf('      if (!mainExecutionSuspended()) {\n        instance.exports.run(BATCH_SIZE);');
const ordinary = transformed.slice(ordinaryStart, transformed.indexOf('\n    } catch (e)', ordinaryStart));
const extra = transformed.match(/          let mscFrozenReturned = false;\n[^\n]+\n          if \(mscFrozenReturned\) mscFrozenObserve\(batch\);/g);
assert.equal(extra.length, 2);
let groups = 0;
function test(name, fn) { fn(); groups++; console.log('PASS ' + name); }
function fixture(ready = 5, opts = {}) {
  const m = new Model(wat, ready, 100, false), events = [];
  const a = createAdapter(m, { enabled: true, persist: e => events.push(e), ...opts });
  a.start(); return { m, a, events };
}
function attempt(m, ready = m.ready) {
  m.ready = ready; m.g.$yield_reason = 0; m.mem.set(116, 4096); m.arm(); m.select();
}
test('idle polls and unchanged parks preserve next legitimate attempt', () => {
  const { m, a, events } = fixture(0);
  for (let i = 0; i < 4; i++) assert.equal(a.observe(i), null);
  attempt(m); assert.equal(a.observe(4), null);
  for (let i = 5; i < 9; i++) assert.equal(a.observe(i), null);
  attempt(m, 6); const e = a.observe(9);
  assert.equal(e.historicalCompletion.attempt, 2); assert.equal(e.historicalCompletion.result, 6);
  assert.equal(a.observe(10), null); assert.equal(events.length, 1);
});
test('unseen initial or intermediate park rejects and closes permanently', () => {
  for (const seenFirst of [false, true]) {
    const { m, a, events } = fixture(0);
    attempt(m); if (seenFirst) a.observe(1);
    attempt(m); attempt(m, 4);
    assert.throws(() => a.observe(3), /counter gap/);
    assert.equal(a.observe(4), null); assert.equal(events.length, 0);
  }
});
test('fault cap counters wrong API and wrong pending identity cannot emit', () => {
  for (const [field, value] of [['fault', 1], ['capped', 1], ['api', 935], ['entries', 2], ['token', 2], ['post', 4124]]) {
    const { m, a, events } = fixture(); attempt(m); m.g['$msc_' + field] = value;
    assert.throws(() => a.observe(1), /rejected/); assert.equal(a.observe(2), null); assert.equal(events.length, 0);
  }
  const { m, a, events } = fixture(); m.arm(); const token = m.run('$msc_enter');
  assert.equal(a.observe(1), null);
  m.mem.set(100, 5); m.mem.set(116, 4120); m.run('$msc_end', [token, 3]);
  m.g.$msc_thread = 99;
  assert.throws(() => a.observe(2), /rejected/); assert.equal(events.length, 0);
});
test('invalid batch failed start duplicate start and closed adapter cannot replay', () => {
  for (const batch of [-1, NaN, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
    const { m, a, events } = fixture(); attempt(m);
    assert.throws(() => a.observe(batch), /batch/); assert.equal(a.observe(1), null); assert.equal(events.length, 0);
  }
  const m = new Model(wat, 1, 100, false), boom = {};
  m.exports.msc_start = () => { throw boom; };
  const a = createAdapter(m, { enabled: true, persist() { assert.fail('unexpected write'); } });
  assert.throws(() => a.start(), e => e === boom); assert.throws(() => a.start(), /already used/);
  assert.equal(a.observe(0), null);
  const f = fixture(); assert.throws(() => f.a.start(), /already used/); attempt(f.m);
  assert.equal(f.a.observe(1), null); assert.equal(f.events.length, 0);
});
function context(m, io = fs, option = path.join(evidenceDirectory, 'independent-sink.jsonl')) {
  Object.assign(m.exports, { get_eax: () => 901, get_esp: () => 902, get_eip: () => 903 });
  const errors = [];
  const c = { instance: m, getArg: () => option, require: () => ({ createAdapter }), fs: io,
    console: { error: (...args) => errors.push(args) }, errors };
  vm.runInNewContext(setup + '\nthis.observe = mscFrozenObserve;', c); return c;
}
test('actual generated sink persists newline framed independently parseable records', () => {
  const file = path.join(evidenceDirectory, 'independent-sink.jsonl');
  assert(!fs.existsSync(file), 'use a fresh evidence directory');
  for (const ready of [5, 8]) {
    const m = new Model(wat, ready, 100, false), c = context(m);
    attempt(m); c.observe(21); c.observe(22); assert.equal(c.errors.length, 0);
  }
  const bytes = fs.readFileSync(file); assert.equal(bytes.at(-1), 10);
  const lines = bytes.toString().split('\n'); assert.equal(lines.pop(), ''); assert.equal(lines.length, 2);
  assert.deepEqual(lines.map(s => JSON.parse(s).historicalCompletion.result), [5, 8]);
  for (const line of lines) {
    const e = JSON.parse(line); assert.equal(e.schema, 'maelstrom-select-frozen-record/v1');
    assert.deepEqual(e.liveHostObservation.state, { eax: 901, esp: 902, eip: 903 });
    assert.equal(e.liveHostObservation.batch, 21); assert(Number.isFinite(e.liveHostObservation.timeMs));
    assert(!('eip' in e.historicalCompletion)); assert(!('fdsets' in e.historicalCompletion));
  }
  assert.throws(() => JSON.parse(lines[0] + '\\n'), SyntaxError, 'reject literal slash-n framing mutant');
});
test('all three actual run boundaries isolate sink/readLive failure and preserve guest catches', () => {
  for (const [site, fragment] of [ordinary, ...extra].entries()) for (const failure of ['persist', 'readLive']) {
    const m = new Model(wat, 5, 100, false), boom = {}, calls = [];
    const c = context(m, { appendFileSync() { calls.push('persist'); if (failure === 'persist') throw boom; } });
    if (failure === 'readLive') m.exports.get_eax = () => { calls.push('readLive'); throw boom; };
    m.exports.run = () => { calls.push('run'); attempt(m); };
    Object.assign(c, { mainExecutionSuspended: () => false, BATCH_SIZE: 1000, batch: 12,
      renderParkStats: { skippedBatches: 0 }, continued: () => calls.push('continued') });
    vm.runInNewContext('for (let i=0;i<1;i++) {\n' + fragment + '\ncontinued();\n}', c);
    assert.equal(c.errors.length, 1); assert.equal(c.errors[0].at(-1), boom);
    assert.deepEqual(calls, ['run', failure, 'continued']);
    c.observe(13); assert.equal(c.errors.length, 1);
    m.exports.run = () => { calls.push('trap'); throw boom; };
    if (site === 0) assert.throws(() => vm.runInNewContext(fragment, c), e => e === boom);
    else vm.runInNewContext('for (let i=0;i<1;i++) {\n' + fragment + '\ncontinued();\n}', c);
    assert.equal(c.errors.length, 1);
    if (site === 2) assert.equal(calls.at(-1), 'trap');
  }
});
test('disabled setup remains inert and main suspension omits both run and observation', () => {
  const p = Proxy.revocable({}, {}); p.revoke();
  const disabled = createAdapter(p.proxy); disabled.start(); assert.equal(disabled.observe(-1), null);
  const c = { instance: p.proxy, getArg: () => null };
  vm.runInNewContext(setup, c);
  vm.runInNewContext(ordinary, { mainExecutionSuspended: () => true,
    instance: { exports: { get_yield_reason: () => 16 } }, renderParkStats: { skippedBatches: 0 } });
});
test('exact transform restores original and rejects altered source and duplicate anchors', () => {
  assert.equal(rt.restore(transformed), runner);
  for (const s of [runner + '\n', runner.replace('run(BATCH_SIZE)', 'run(1)'),
    runner + '\n  const instance = await WebAssembly.instantiate(wasmModule, imports);'])
    assert.throws(() => rt.transform(s, { enabled: true }), /pin|anchor/);
  new vm.Script(transformed);
});
console.log(JSON.stringify({ groups, modelSourceHostOnly: true, nativeRuns: 0, guestRuns: 0 }));

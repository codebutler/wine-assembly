'use strict';
// Offline source-model controls. No compiler or real Wasm is involved.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), Module = require('node:module');
const hook = require('../tools/maelstrom-select-completion-hook.cjs');
const { Model } = require('./maelstrom-select-hook-model.cjs');
const root = process.argv[2]; assert(root);
const input = Object.fromEntries(Object.keys(hook.PINS).map(p => [p, fs.readFileSync(path.join(root, p), 'utf8')]));
const original = input['src/09d-winsock.wat'];
const transformed = hook.transform(input, { enabled: true })['src/09d-winsock.wat'];
let groups = 0;
function test(name, f) { f(); groups++; console.log('PASS ' + name); }
function terminal(ready = 3) {
  const m = new Model(transformed, ready, 100); m.arm(); m.select(); return m;
}
function oracle(m) { return hook.createOracle(m, m.exports); }
const take = m => hook.snapshot(m.exports);
const rejected = r => assert.equal(r.kind, 'rejected');

test('explicit export-source pin rejects cross-instance before first capture', () => {
  const a = terminal(), b = terminal(); const o = oracle(a);
  rejected(o.accept(a, take(b))); rejected(o.accept(a, take(a)));
});
test('first authentic source binds legacy routing identity; later source swap closes', () => {
  const a = terminal(0), b = terminal(); const owner = {}, o = hook.createOracle(owner);
  assert.equal(o.accept(owner, take(a)).kind, 'park');
  rejected(o.accept(owner, take(b))); rejected(o.accept(owner, take(a)));
});
test('unpaired legitimate terminal capture preserves positive/park observations', () => {
  for (const value of [0, 9]) {
    const m = terminal(value); const r = oracle(m).accept(m, take(m));
    assert.equal(r.kind, value ? 'completion' : 'park');
    if (value) assert.equal(r.result, value);
  }
});
test('forgery, JSON copy, spread, inherited record, proxy and revoked proxy close without reads', () => {
  for (const wrap of [s => ({ ...s }), s => JSON.parse(JSON.stringify(s)), s => Object.create(s),
    s => new Proxy(s, { get() { throw Error('must not read'); }, getOwnPropertyDescriptor() { throw Error('must not reflect'); } }),
    s => { const p = Proxy.revocable(s, {}); p.revoke(); return p.proxy; }]) {
    const m = terminal(), o = oracle(m), s = take(m);
    rejected(o.accept(m, wrap(s))); rejected(o.accept(m, s));
  }
  const m = terminal(0), s = take(m);
  rejected(oracle(m).accept(m, { ...s, phase: 3, post: s.pre + 24, parks: 0, completions: 1, result: 9 }));
});
test('changed snapshot fields and getters reject; reentrant getters never execute', () => {
  for (const change of [s => { s.result++; }, s => { delete s.phase; },
    (s, o, m) => { Object.defineProperty(s, 'phase', { get() { o.accept(m, take(m)); throw Error('getter executed'); } }); },
    s => { delete s.result; Object.setPrototypeOf(s, { get result() { throw Error('inherited getter executed'); } }); }]) {
    const m = terminal(), o = oracle(m), s = take(m); change(s, o, m);
    rejected(o.accept(m, s)); rejected(o.accept(m, take(m)));
  }
});
test('stale capture, duplicate terminal, duplicate entry and missed attempts close', () => {
  const m = terminal(), old = take(m), current = take(m), o = oracle(m);
  rejected(o.accept(m, old)); rejected(o.accept(m, current));
  const n = terminal(), p = oracle(n), s = take(n);
  assert.equal(p.accept(n, s).kind, 'completion'); rejected(p.accept(n, s));
  const a = new Model(transformed, 1); a.arm(); a.run('$msc_enter'); const q = oracle(a), e = take(a);
  assert.equal(q.accept(a, e).kind, 'entry'); rejected(q.accept(a, e));
  const b = terminal(0); b.g.$yield_reason = 0; b.arm(); b.select(); rejected(oracle(b).accept(b, take(b)));
});
test('returned completion identity cannot mutate retained capture or reopen oracle', () => {
  const m = terminal(), s = take(m), o = oracle(m), r = o.accept(m, s);
  r.identity.result = 99; r.result = 99;
  assert.equal(s.result, 3); rejected(o.accept(m, s));
  rejected(oracle(m).accept(m, s)); rejected(oracle(m).accept(m, take(m)));
});
test('own/inherited export accessors and proxy sources reject without getter execution', () => {
  for (const inherited of [false, true]) {
    const m = terminal(), prior = take(m), o = oracle(m), source = m.exports;
    delete source.msc_phase;
    // A dedicated prototype avoids modifying Object.prototype.
    const proto = {};
    Object.defineProperty(inherited ? proto : source, 'msc_phase', { get() { throw Error('must not invoke accessor'); } });
    if (inherited) Object.setPrototypeOf(source, proto);
    assert.throws(() => take(m), /own diagnostic function/);
    rejected(o.accept(m, prior));
  }
  assert.throws(() => hook.snapshot(new Proxy({}, { get() { throw Error('proxy read'); } })), /trusted diagnostic/);
});

const hostile = new Proxy({}, { get() { throw Error('exception property read'); } });
const revoked = Proxy.revocable({}, {}); revoked.revoke();
const exceptions = [null, undefined, 0, false, 123, 'failure', Symbol('failure'),
  { modelReturn: true, value: 123 }, hostile, revoked.proxy,
  Object.defineProperty({}, 'modelReturn', { get() { throw Error('exception getter read'); } })];
function throwsSame(f, value) {
  let caught = false;
  try { f(); } catch (e) { assert.equal(e, value); caught = true; }
  assert(caught, 'original exception must escape');
}
test('export exceptions retain arbitrary identity and invalidate all prior captures', () => {
  for (const exception of exceptions) {
    const m = terminal(), real = m.exports.msc_result;
    let fail = false;
    m.exports.msc_result = () => { if (fail) throw exception; return real(); };
    const s = take(m), o = oracle(m); fail = true;
    throwsSame(() => take(m), exception); rejected(o.accept(m, s));
    fail = false; assert.throws(() => take(m), /capture closed/);
  }
});
test('reentrant export reads cannot accept prior captures or recover after nested capture', () => {
  for (const nested of [false, true]) {
    const m = terminal(), real = m.exports.msc_result; let reenter = false, s, o;
    m.exports.msc_result = () => {
      if (reenter) {
        if (nested) { try { take(m); } catch {} }
        else rejected(o.accept(m, s));
      }
      return real();
    };
    s = take(m); o = oracle(m); reenter = true;
    if (nested) assert.throws(() => take(m), /capture closed/); else take(m);
    rejected(o.accept(m, s));
  }
});
test('changed export function and noninteger export values poison the source', () => {
  for (const value of [NaN, Infinity, 1.5, 0x100000000, -0x80000001, hostile]) {
    const m = terminal(), real = m.exports.msc_result; let bad = false;
    m.exports.msc_result = () => bad ? value : real();
    const s = take(m), o = oracle(m); bad = true;
    assert.throws(() => take(m), /invalid diagnostic i32/); rejected(o.accept(m, s));
  }
  const m = terminal(), s = take(m), o = oracle(m); m.exports.msc_phase = () => 3;
  assert.throws(() => take(m), /export identity changed/); rejected(o.accept(m, s));
});
test('authentic invalid cap/counters/phase states close; full supported cap sequence remains bounded', () => {
  for (const [k, v] of [['capped', 1], ['fault', 1], ['token', 4097], ['entries', 4097],
    ['completions', 2], ['phase', 2], ['pre', 0xfffffff0], ['api', 935], ['thread', 0], ['active', 1]]) {
    const m = terminal(); m.g['$msc_' + k] = v; rejected(oracle(m).accept(m, take(m)));
  }
  const m = new Model(transformed, 0, 100), o = oracle(m);
  for (let i = 1; i <= hook.CAP; i++) {
    m.g.$yield_reason = 0; m.arm(); m.select();
    const r = o.accept(m, take(m)); assert.equal(r.kind, 'park'); assert.equal(r.attempt, i);
  }
  m.g.$yield_reason = 0; m.arm(); m.select(); rejected(o.accept(m, take(m)));
});
function exceptionEquivalence(Constructor) {
  for (const name of ['$vsock_pump', '$vsock_filter_set', '$host_get_ticks', '$vsock_timeval_ms', '$vsock_block']) {
    for (const exception of exceptions) {
      const a = new Constructor(original, 0, 100), b = new Constructor(transformed, 0, 100); b.arm();
      for (const m of [a, b]) { m.throwOn = name; m.exception = exception; throwsSame(() => m.select(), exception); }
      assert.deepEqual(a.trace, b.trace); assert.deepEqual(a.mem, b.mem);
      for (const [k, v] of Object.entries(a.g)) assert.equal(b.g[k], v, k);
    }
  }
}
test('original/transformed models preserve every imported exception by identity with equal trace/state', () => exceptionEquivalence(Model));
test('private nested return identities preserve normal return values and parks', () => {
  const m = new Model(transformed, 5); m.arm(); assert.equal(m.run('$msc_enter'), 1);
  m.mem.set(116, 4120); m.mem.set(100, 5); m.run('$msc_end', [1, 3]); assert.equal(take(m).result, 5);
  for (const ready of [0, 5]) {
    const a = new Model(original, ready, 100), b = new Model(transformed, ready, 100); b.arm();
    assert.equal(a.select(), b.select()); assert.deepEqual(a.trace, b.trace); assert.deepEqual(a.mem, b.mem);
  }
});
test('rejecting evaluator mutation restores broad modelReturn catch and fails equivalence controls', () => {
  const file = require.resolve('./maelstrom-select-hook-model.cjs'); const code = fs.readFileSync(file, 'utf8');
  const before = 'if (e === frame.signal) return frame.value;';
  assert.equal(code.split(before).length, 2);
  const mutated = code.replace(before, 'if (e && e.modelReturn) return e.value; if (e === frame.signal) return frame.value;');
  const m = new Module(file, module); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(mutated, file); assert.throws(() => exceptionEquivalence(m.exports.Model));
  const bad = new m.exports.Model(original, 1); bad.throwOn = '$vsock_pump';
  bad.exception = { modelReturn: true, value: 123 }; assert.equal(bad.select(), 123);
});
test('rejecting oracle mutations detect missing source pin, mutation check and fail-closed source check', () => {
  const file = require.resolve('../tools/maelstrom-select-completion-hook.cjs'); const code = fs.readFileSync(file, 'utf8');
  const cases = [
    ['(boundSource !== undefined && boundSource !== capture.exports)', 'false', h => {
      const a = terminal(), b = terminal(); rejected(h.createOracle(a, a.exports).accept(a, h.snapshot(b.exports)));
    }],
    ["!d || !Object.hasOwn(d, 'value') || d.value !== s[k]", 'false', h => {
      const m = terminal(), s = h.snapshot(m.exports); s.result++; rejected(h.createOracle(m, m.exports).accept(m, s));
    }],
    ['capture.source.failed || ', '', h => {
      const m = terminal(), real = m.exports.msc_result; let fail = false;
      m.exports.msc_result = () => { if (fail) throw 123; return real(); };
      const s = h.snapshot(m.exports), o = h.createOracle(m, m.exports); fail = true;
      throwsSame(() => h.snapshot(m.exports), 123); rejected(o.accept(m, s));
    }],
  ];
  for (const [before, after, control] of cases) {
    assert.equal(code.split(before).length, 2); const m = new Module(file, module);
    m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
    m._compile(code.replace(before, after), file); assert.throws(() => control(m.exports));
  }
});
console.log(JSON.stringify({ groups, evaluatorRejectingMutations: 1, oracleRejectingMutations: 3,
  realWasm: false, runtimeGate: 'UNRESOLVED' }));

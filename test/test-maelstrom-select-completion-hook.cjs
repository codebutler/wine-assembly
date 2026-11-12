'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawnSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const hook = require('../tools/maelstrom-select-completion-hook.cjs');
const { parse, func, walk, Model } = require('./maelstrom-select-hook-model.cjs');
const fixture = require('./fixtures/maelstrom-select-hook-pins.json');
const root = process.argv[2]; assert(root, 'historical readonly source root required');
const sources = Object.fromEntries(Object.keys(hook.PINS).map(p => [p, fs.readFileSync(path.join(root, p), 'utf8')]));
for (const [p, s] of Object.entries(sources)) {
  assert.equal(createHash('sha256').update(s).digest('hex'), fixture.files[p].sha256);
  assert.equal(hook.PINS[p], fixture.files[p].sha256);
}
let tests = 0, mutations = 0;
const test = (name, f) => { f(); tests++; console.log('PASS ' + name); };
const out = hook.transform(sources, { enabled: true });
const w = out['src/09d-winsock.wat'], d = out['src/09b-dispatch.wat'];
const originalW = sources['src/09d-winsock.wat'];
const isCall = (n, name) => n[0] === 'call' && n[1] === '$' + name;
const calls = (n, name) => walk(n, x => isCall(x, name));
const completion = '(call $msc_end (local.get $msc_token) (i32.const 3))';
const park = '(call $msc_end (local.get $msc_token) (i32.const 2))';
const eax = '(i32.store offset=0 (global.get $reg_base) (local.get $total))';
function placement(source) {
  const f = func(source, 'handle_select');
  const instructions = f.slice(2).filter(x => !['param', 'local'].includes(x[0]));
  assert.deepEqual(instructions[0], parse('(local.set $msc_token (call $msc_enter))')[0]);
  assert.deepEqual(instructions.at(-2), parse(eax)[0]);
  assert.deepEqual(instructions.at(-1), parse(completion)[0]);
  assert.equal(calls(f, 'msc_end').length, 3);
  let parks = 0;
  for (const n of walk(f, x => x[0] === 'then')) {
    if (n.some(x => Array.isArray(x) && isCall(x, 'vsock_block'))) {
      assert.deepEqual(n, parse('(then (call $vsock_block (i32.const 24)) ' + park + ' (return))')[0]);
      parks++;
    }
  }
  assert.equal(parks, 2);
  // Erasing diagnostics must recover the complete historical handler AST.
  function erase(n) {
    if (!Array.isArray(n)) return n;
    if ((['local', 'local.set'].includes(n[0]) && n[1] === '$msc_token') || isCall(n, 'msc_end')) return null;
    return n.map(erase).filter(x => x !== null);
  }
  assert.deepEqual(erase(f), func(originalW, 'handle_select'));
  const diag = parse(source.split(';; Opt-in exact select diagnostic storage.')[1]);
  for (const n of walk(diag, x => ['call', 'global.set', 'i32.store', 'import'].includes(x[0]))) {
    assert(['call', 'global.set'].includes(n[0]), 'no guest writes/imports');
    assert(n[1].startsWith('$msc_'), 'only private diagnostic calls/writes');
  }
}
function model(source = w, ready = 0, ms = 0) { return new Model(source, ready, ms); }
const snap = m => hook.snapshot(m.exports);
const point = (m, phase) => { const s = snap(m); assert.equal(s.phase, phase); return s; };

test('disabled exact opaque identity; unused source/pins/options never accessed', () => {
  const opaque = Proxy.revocable({}, {}); opaque.revoke();
  const opts = Object.create({ enabled: false });
  Object.defineProperty(opts, 'pins', { get() { throw Error('unused'); } });
  assert.equal(hook.transform(opaque.proxy, opts), opaque.proxy);
  assert.equal(hook.transform('unchanged'), 'unchanged');
  const o = { enabled: undefined, get source() { throw Error('unused'); } };
  assert.equal(hook.transform(null, o), null);
});
test('enabled source pins reject missing, changed, missing-anchor and duplicate-anchor inputs', () => {
  for (const p of Object.keys(hook.PINS)) {
    for (const change of [undefined, sources[p] + '\n', sources[p].slice(0, -1)]) {
      assert.throws(() => hook.transform({ ...sources, [p]: change }, { enabled: true }), /source pin/);
    }
  }
  const h = '(func $handle_select';
  for (const source of [originalW.replace(h, '(func $moved_select'), originalW + originalW]) {
    assert.throws(() => hook.transform({ ...sources, 'src/09d-winsock.wat': source }, { enabled: true }), /source pin/);
  }
});
test('exact AST entry, two parks, completion AFTER EAX and no diagnostic side effects', () => placement(w));
test('diagnostic module stays inactive until explicit one-way start; start cannot reset identity', () => {
  const m = new Model(w, 3, 0, false); m.arm(); m.select();
  assert.equal(snap(m).started, 0); assert.equal(snap(m).entries, 0); assert.equal(snap(m).fault, 0);
  m.exports.msc_start(); m.arm(); m.select(); const s = point(m, 3);
  m.exports.msc_start(); assert.deepEqual(snap(m), s);
});
test('both proven routes funnel through historical dispatcher and actual API934 handler', () => {
  const runSource = sources['src/13-exports.wat'];
  const zone = runSource.slice(runSource.indexOf(';; If EIP landed in thunk zone'), runSource.indexOf(';; If EIP landed in thunk zone') + 900);
  assert(zone.includes('(call $win32_dispatch (i32.div_u'));
  for (const [file, names] of [
    ['src/05-alu.wat', ['th_call_ind']],
    ['src/06b-core-handlers.wat', ['th_thunk_call', 'th_call_r', 'th_jmp_r', 'th_jmp_ind',
      'th_call_ind_ro', 'th_jmp_ind_ro', 'th_jmp_ind_sib_eax4_abs', 'th_jmp_tbl']],
  ]) {
    for (const name of names) assert.equal(calls(func(sources[file], name), 'win32_dispatch').length, 1, name);
  }
  const outer = func(d, 'win32_dispatch'), inner = func(d, 'win32_dispatch_inner');
  const call = calls(outer, 'win32_dispatch_inner');
  assert.deepEqual(call, parse('(call $win32_dispatch_inner (local.get $thunk_idx) (local.get $return_eip) (local.get $msc_pre) (local.get $msc_thread) (local.get $msc_regs))'));
  // The original single guest return read captures ESP through tee; no reread.
  assert.deepEqual(walk(outer, x => x[0] === 'local.set' && x[1] === '$return_eip'),
    parse('(local.set $return_eip (call $gl32 (local.tee $msc_pre (i32.load offset=16 (global.get $reg_base)))))'));
  const tableAt = inner.findIndex(x => Array.isArray(x) && isCall(x, 'dispatch_api_table'));
  assert.deepEqual(inner[tableAt - 1], parse('(if (i32.eq (local.get $api_id) (i32.const 934)) (then (call $msc_arm (local.get $msc_ret) (local.get $msc_pre) (local.get $msc_thread) (local.get $msc_regs) (i32.add (global.get $thunk_guest_base) (i32.mul (local.get $thunk_idx) (i32.const 8))))))')[0]);
  const table = sources['src/09b2-dispatch-table.generated.wat'];
  assert(table.includes(') ;; 934: select\n      (call $handle_select (local.get $arg0) (local.get $arg1) (local.get $arg2) (local.get $arg3) (local.get $arg4) (local.get $name_ptr))\n      (return)'));
  assert.equal((table.match(/\(call \$handle_select\b/g) || []).length, 2, 'dispatcher + explicit test export');
  const pages = func(table, 'dispatch_api_table');
  assert.deepEqual(calls(pages, 'dispatch_api_table_page_3')[0][2], parse('(i32.sub (local.get $api_id) (i32.const 768))')[0]);
  const page = func(table, 'dispatch_api_table_page_3');
  const branches = walk(page, x => x[0] === 'br_table');
  assert.equal(branches.length, 1); assert.equal(branches[0][1 + 934 - 768], '$api_166');
  const parents = walk(page, x => x.some(y => Array.isArray(y) && y[0] === 'block' && y[1] === '$api_166'));
  assert.equal(parents.length, 1);
  const at = parents[0].findIndex(y => Array.isArray(y) && y[0] === 'block' && y[1] === '$api_166');
  assert(isCall(parents[0][at + 1], 'handle_select'), 'actual br_table target, not comment inference');
  // Removing only diagnostic adapters recovers both complete dispatcher ASTs.
  function erase(n) {
    if (!Array.isArray(n)) return n;
    if (['param', 'local', 'local.set'].includes(n[0]) && n[1].startsWith('$msc_')) return null;
    if (n[0] === 'local.tee' && n[1] === '$msc_pre') return erase(n[2]);
    if (n[0] === 'if' && calls(n, 'msc_arm').length) return null;
    if (isCall(n, 'win32_dispatch_inner')) return n.slice(0, 3).map(erase);
    return n.map(erase).filter(x => x !== null);
  }
  for (const name of ['win32_dispatch', 'win32_dispatch_inner']) {
    assert.deepEqual(erase(func(d, name)), func(sources['src/09b-dispatch.wat'], name));
  }
  // No other file is modified, including the test-only direct handler caller.
  for (const p of Object.keys(sources)) if (!['src/09d-winsock.wat', 'src/09b-dispatch.wat'].includes(p)) assert.equal(out[p], sources[p]);
});
test('source model positive result, timeout zero, both parks preserve original traces and exception identity', () => {
  for (const [ready, ms, timeval, ticks] of [[3, 0, 1, [10]], [0, 0, 1, [10]],
    [0, 100, 1, [10, 200]], [0, 0, 0, [10]], [0, 100, 1, [10, 10]]]) {
    const a = new Model(originalW, ready, ms), b = model(w, ready, ms);
    a.ticks = ticks.slice(); b.ticks = ticks.slice(); b.arm();
    const owner = {}, oracle = hook.createOracle(owner);
    assert.equal(a.select(timeval), b.select(timeval));
    assert.deepEqual(b.trace, a.trace); assert.deepEqual(b.mem, a.mem);
    for (const [k, v] of Object.entries(a.g)) assert.equal(b.g[k], v, k);
    const s = snap(b), parked = a.g.$yield_reason === 8;
    assert.equal(s.phase, parked ? 2 : 3);
    assert.equal(oracle.accept(owner, s).kind, parked ? 'park' : 'completion');
    assert.equal(s.result, parked ? 0 : ready); assert.equal(s.ret, 777);
  }
  for (const name of ['$vsock_pump', '$vsock_filter_set', '$host_get_ticks', '$vsock_timeval_ms']) {
    for (const error of [null, 0, 'failure', { marker: 1 }]) {
      const a = new Model(originalW, 0, 100), b = model(w, 0, 100); b.arm();
      for (const m of [a, b]) { m.throwOn = name; m.exception = error; }
      let seen = 0;
      for (const m of [a, b]) { try { m.select(); } catch (e) { assert.equal(e, error); seen++; } }
      assert.equal(seen, 2); assert.deepEqual(a.trace, b.trace); assert.deepEqual(a.mem, b.mem);
      assert.equal(snap(b).completions, 0); b.arm(); assert.equal(snap(b).fault, 1);
    }
  }
});
test('park retries get fresh attempt tokens; stale EAX never becomes completion; first result sticky', () => {
  const m = model(w, 0, 100), owner = {}, oracle = hook.createOracle(owner);
  for (let i = 1; i <= 3; i++) {
    m.g.$yield_reason = 0; m.arm(); m.select();
    assert.equal(oracle.accept(owner, point(m, 2)).kind, 'park');
    assert.equal(snap(m).token, i); assert.equal(snap(m).completions, 0); assert.equal(snap(m).result, 0);
  }
  m.g.$yield_reason = 0; m.ready = 2; m.arm(); m.select();
  const s = point(m, 3), result = oracle.accept(owner, s);
  assert.equal(result.kind, 'completion'); assert.equal(result.attempt, 4); assert.equal(result.result, 2);
  m.g.$yield_reason = 0; m.mem.set(116, 9000); m.g.$current_thread_id = 7; m.ready = 9;
  m.arm(); m.select(); assert.deepEqual(snap(m), s, 'retain first completion despite later guest work');
  assert.equal(oracle.accept(owner, s).kind, 'rejected', 'duplicate completion');
});
test('explicit entry pairing rejects wrong API/thunk/thread/instance/call, stale value and unrelated callback', () => {
  for (const key of ['api', 'thunk', 'thread', 'regs', 'pre', 'ret', 'token']) {
    const m = model(w, 1), owner = {}, oracle = hook.createOracle(owner); m.arm();
    const token = m.run('$msc_enter'); assert.equal(oracle.accept(owner, point(m, 1)).kind, 'entry');
    m.mem.set(116, 4120); m.mem.set(100, 1); m.run('$msc_end', [token, 3]);
    const s = snap(m); s[key]++;
    assert.equal(oracle.accept(owner, s).kind, 'rejected', key);
  }
  const owner = {}, m = model(w, 1); m.arm(); m.select();
  assert.equal(hook.createOracle(owner).accept({}, snap(m)).kind, 'rejected');
  const q = model(w, 0, 100); q.arm(); q.select();
  const forged = { ...snap(q), phase: 3, post: 4120, result: 0x53000001 };
  assert.equal(hook.createOracle(owner).accept(owner, forged).kind, 'rejected');
  assert.equal(hook.createOracle(owner).accept(owner, { callback: true }).kind, 'rejected');
});
test('lost/duplicate entry, no arm, cap/overflow, unexpected ESP and changed execution identity fail closed', () => {
  const owner = {}, m = model(w, 1); m.arm(); m.select();
  for (const change of [{ token: 2, entries: 2 }, { entries: 0 }, { token: 0xffffffff, entries: 0xffffffff },
    { post: 4124 }, { completions: 0 }, { active: 1 }, { fault: 1 }, { capped: 1 }]) {
    assert.equal(hook.createOracle(owner).accept(owner, { ...snap(m), ...change }).kind, 'rejected');
  }
  const pending = model(w, 1); pending.arm(); pending.run('$msc_enter');
  const o = hook.createOracle(owner); assert.equal(o.accept(owner, snap(pending)).kind, 'entry');
  assert.equal(o.accept(owner, snap(pending)).kind, 'rejected');
  pending.arm(); assert.equal(snap(pending).fault, 1);
  const direct = model(w, 1); direct.select(); assert.equal(snap(direct).fault, 1); assert.equal(snap(direct).completions, 0);
  const noEntry = model(w, 1); noEntry.run('$msc_end', [1, 3]); assert.equal(snap(noEntry).fault, 1);
  for (const key of ['$current_thread_id', '$current_thunk_eip']) {
    const seed = model(w, 1); seed.arm(); seed.g[key]++; seed.select();
    assert.equal(snap(seed).fault, 1); assert.equal(snap(seed).completions, 0);
  }
  const wrongSeed = model(w, 1); wrongSeed.run('$msc_arm', [777, 4096, 1, 200, 1232]); wrongSeed.select();
  assert.equal(snap(wrongSeed).fault, 1); assert.equal(snap(wrongSeed).completions, 0);
  const dup = model(w, 1); dup.arm(); dup.select(); dup.run('$msc_end', [1, 3]); assert.equal(snap(dup).fault, 1);
  const wrongToken = model(w, 1); wrongToken.arm(); wrongToken.run('$msc_enter'); wrongToken.run('$msc_end', [2, 3]);
  assert.equal(snap(wrongToken).fault, 1); assert.equal(snap(wrongToken).completions, 0);
  for (const [key, value] of [['$current_thread_id', 8], ['$reg_base', 200], ['$current_thunk_eip', 500]]) {
    const n = model(w, 1); n.arm(); const t = n.run('$msc_enter'); n.g[key] = value;
    n.run('$msc_end', [t, 3]); assert.equal(snap(n).fault, 1); assert.equal(snap(n).completions, 0);
  }
  const n = model(w, 1); n.arm(); const t = n.run('$msc_enter'); n.mem.set(116, 4124); n.run('$msc_end', [t, 3]); assert.equal(snap(n).fault, 1);
  const overflow = model(w, 1); overflow.mem.set(116, 0xfffffff0); overflow.arm(); overflow.select(); assert.equal(snap(overflow).fault, 1);
  const cap = model(w, 0, 100);
  for (let i = 0; i < hook.CAP; i++) { cap.g.$yield_reason = 0; cap.arm(); cap.select(); }
  assert.equal(snap(cap).token, hook.CAP); cap.g.$yield_reason = 0; cap.ready = 1; cap.arm(); cap.select();
  assert.equal(snap(cap).token, hook.CAP); assert.equal(snap(cap).capped, 1); assert.equal(snap(cap).completions, 0);
});
test('independent output mutations reject misplaced completion, park result and forbidden diagnostic effects', () => {
  const entry = '(local.set $msc_token (call $msc_enter))';
  const variants = [
    w.replace(eax + '\n    ' + completion, completion + '\n    ' + eax),
    w.replace(park, completion),
    w.replace(eax, '(drop (local.get $total))'),
    w.replace(entry, '').replace('(call $vsock_pump)', entry + '\n (call $vsock_pump)'),
    w.replace(completion, ''),
    w.replace(completion, completion + '\n' + completion),
    w.replace('(func $msc_fail\n', '(func $msc_fail\n (call $host_get_ticks)\n'),
    w.replace('(func $msc_fail\n', '(func $msc_fail\n (global.set $yield_reason (i32.const 0))\n'),
    w.replace('(func $msc_fail\n', '(func $msc_fail\n (i32.store (i32.const 0) (i32.const 0))\n'),
  ];
  for (const v of variants) { assert.notEqual(v, w); assert.throws(() => placement(v)); mutations++; }
  const stale = w.replace('(global.set $msc_result (i32.load offset=0 (global.get $reg_base)))', '(global.set $msc_result (i32.const 1392508929))');
  assert.notEqual(stale, w); const m = model(stale, 7); m.arm(); m.select(); assert.notEqual(snap(m).result, 7); mutations++;
});
test('CLI disabled byte identity and enabled fail-before-output; only new source fragments emitted', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'msc-hook-test-'));
  try {
    const tool = path.resolve(__dirname, '../tools/maelstrom-select-completion-hook.cjs');
    const input = path.join(dir, 'input'), output = path.join(dir, 'output'); fs.writeFileSync(input, Buffer.from([0, 255, 10]));
    const cli = args => spawnSync(process.execPath, ['--max-old-space-size=256', tool, ...args], { timeout: 10000, maxBuffer: 8192 });
    assert.equal(cli(['--disabled', input, output, '/nonexistent-unused-pin']).status, 0);
    assert.deepEqual(fs.readFileSync(input), fs.readFileSync(output));
    const bad = path.join(dir, 'bad-output'); assert.notEqual(cli(['--enable-exact-hook', dir, bad]).status, 0); assert(!fs.existsSync(bad));
    const good = path.join(dir, 'fragments'); assert.equal(cli(['--enable-exact-hook', root, good]).status, 0);
    assert.deepEqual(fs.readdirSync(good).sort(), ['09b-dispatch.wat', '09d-winsock.wat']);
    assert.equal(fs.readFileSync(path.join(good, '09d-winsock.wat'), 'utf8'), w);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
console.log(JSON.stringify({ tests, independentOutputMutations: mutations, realWasm: false, nativeQualified: false }));

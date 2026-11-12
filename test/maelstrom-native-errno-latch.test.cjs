'use strict';
// Source AST/model and byte controls ONLY. No WebAssembly API/compiler/guest.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const hook = require('../tools/maelstrom-native-errno-latch.cjs');
const selectHook = require('../tools/maelstrom-select-completion-hook.cjs');
const { Model, func, walk, parse } = require('./maelstrom-select-hook-model.cjs');
const sourceRoot = process.env.MNE_SOURCE_ROOT;
const originalRoot = process.env.MNE_ORIGINAL_ROOT;
assert(sourceRoot && originalRoot && process.env.MNE_CRT, 'explicit installed readonly inputs required');
const sources = Object.fromEntries(Object.keys(hook.PINS).map(p => [p, fs.readFileSync(path.join(sourceRoot, p), 'utf8')]));
const binaries = { net: fs.readFileSync(path.join(originalRoot, 'SDL_net.dll')),
  exe: fs.readFileSync(path.join(originalRoot, 'Maelstrom.exe')), crt: fs.readFileSync(process.env.MNE_CRT) };
// This is a synthetic fixture base, not a loader observation or native evidence.
const crtBase = 0x522000, entry = crtBase + 0xc430, tail = crtBase + 0xc435;
const options = { enabled: true, binaries, crtLoadedBase: crtBase };
const out = hook.transform(sources, options), w = out['src/09d-winsock.wat'];
const pre = 0x074ffb18, post = pre + 24, errnoPtr = 0x04102000;
const successor = 0x7a3366, selectRet = 0x7a3362;
let groups = 0;
function test(name, f) { f(); groups++; console.log('PASS source/model: ' + name); }

class NativeModel extends Model {
  constructor(enabled = true) {
    super(w, 0, 1000, false);
    Object.assign(this.g, { $image_base: 0x400000, $GUEST_BASE: 0x12000, $code16: 0,
      $block_exec_enabled: 0, $uop_enabled: 0 });
    for (let i = 0; i < 8; i++) if (!this.mem.has(100 + 4 * i)) this.mem.set(100 + 4 * i, 0);
    this.mem.set(116, pre); this.mem.set(120, 0); this.mem.set(128, entry);
    this.word = 7; this.pages = 8192; this.reads = [];
    for (const [p, n] of [['src/05-alu.wat', 'th_ret'], ['src/06b-core-handlers.wat', 'th_call_r']])
      this.functions.set('$' + n, func(out[p], n));
    const start = parse(w.split(';; Opt-in native errno successor latch.')[1])
      .find(n => n[0] === 'func' && Array.isArray(n[1]) && n[1][0] === 'export' && n[1][1] === '"mne_start"');
    this.functions.set('$mne_test_start', ['func', '$mne_test_start', ...start.slice(2)]);
    this.exports.mne_start = () => this.run('$mne_test_start');
    if (enabled) this.exports.mne_start();
  }
  wa(ga) { return (ga - this.g.$image_base + this.g.$GUEST_BASE) >>> 0; }
  put(ga, value) { this.mem.set(this.wa(ga), value >>> 0); }
  eval(n, l) {
    const op = n[0], e = x => this.eval(x, l);
    if (op === 'export') return;
    if (op === 'region.end') { assert.equal(n[1], '$DIRECT_WINDOW'); return 0x8000000; }
    if (op === 'memory.size') return this.pages;
    if (op === 'i32.lt_u') return +((e(n[1]) >>> 0) < (e(n[2]) >>> 0));
    if (op === 'i32.shr_u') return e(n[1]) >>> e(n[2]);
    if (op === 'i32.shl') return (e(n[1]) << e(n[2])) >>> 0;
    if (op === 'thunk-contains') return 0;
    if (op === 'read-thread-word') return this.word;
    if (op === 'return_call') {
      assert.equal(n[1], '$branch_end'); this.trace.push(['branch_end']); return;
    }
    if (op === 'i32.load') {
      const offset = typeof n[1] === 'string' ? Number(n[1].split('=')[1]) : 0;
      this.reads.push((e(n[offset ? 2 : (typeof n[1] === 'string' ? 2 : 1)]) + offset) >>> 0);
    }
    if (op === 'call' && n[1].startsWith('$mne_')) return this.run(n[1], n.slice(2).map(e));
    if (op === 'call' && ['$th_ret_guard16', '$cs_pop'].includes(n[1])) {
      this.trace.push(['call', n[1]]); return;
    }
    if (op === 'call' && n[1] === '$gl32') {
      const a = this.wa(e(n[2])); assert(this.mem.has(a));
      this.trace.push(['gl32', a]); return this.mem.get(a);
    }
    if (op === 'call' && n[1] === '$gs32') {
      const a = this.wa(e(n[2])), v = e(n[3]); this.mem.set(a, v);
      this.trace.push(['gs32', a, v]); return;
    }
    return super.eval(n, l);
  }
  arm() { return this.run('$msc_arm', [selectRet, this.mem.get(116), this.g.$current_thread_id, this.g.$reg_base, this.g.$current_thunk_eip]); }
  complete(parks = 6) {
    for (let i = 0; i < parks; i++) {
      this.g.$yield_reason = 0; this.arm(); this.select();
      assert.equal(this.g.$msc_phase, 2);
      assert.notEqual(this.g.$mne_status, 4);
    }
    this.g.$yield_reason = 0; this.ms = 0; this.arm(); this.select();
    assert.equal(this.g.$msc_phase, 3);
    this.g.$eip = selectRet;
    this.mem.set(120, this.mem.get(100)); // fixture: native MOV EBP,EAX
  }
  callNative(ret = successor) { this.run('$th_call_r', [ret]); }
  returnNative(error = 4, caller = 0x40e12a) {
    this.mem.set(100, errnoPtr); this.put(errnoPtr, error);
    this.put(post + 0x124, caller); this.put(post + 0x128, 0x04103000); this.put(post + 0x12c, 1000);
    this.g.$eip = tail; this.run('$th_ret', [0]);
  }
  state() { return Object.fromEntries(hook.FIELDS.map(n => [n, this.g['$mne_' + n]])); }
  passiveState() {
    return { g: Object.fromEntries(Object.entries(this.g).filter(([n]) => !n.startsWith('$msc_') && !n.startsWith('$mne_'))),
      mem: [...this.mem], trace: this.trace.filter(x => !(x[0] === 'global.set' && x[1].startsWith('$mne_'))) };
  }
}

test('byte-bound authentic native errno successor and caller frame', () => {
  const a = hook.verifyBinaries(binaries);
  assert.deepEqual(a, { successor, selectRet, frame: 0x124, crtEntryRva: 0xc430, crtTailRva: 0xc435, crtRetRva: 0xc438 });
  for (const error of [0, 4, 10004, 0xffffffff]) {
    const model = new NativeModel(); model.complete(); model.callNative(); model.returnNative(error);
    const s = model.state();
    assert.equal(s.status, 4); assert.equal(s.event, 3); assert.equal(s.errno, error);
    assert.equal(s.pc, successor); assert.equal(s.sourceBlock, tail); assert.equal(s.nativeEntry, entry);
    assert.equal(s.eax, errnoPtr); assert.equal(s.esp, post); assert.equal(s.ebp, 0);
    assert.equal(s.caller, 0x40e12a); assert.equal(s.socketSet, 0x04103000); assert.equal(s.timeout, 1000);
    assert.equal(s.token, 7); assert.equal(s.parks, 6); assert.equal(s.pre, pre); assert.equal(s.post, post);
    assert.equal(s.thread, 1); assert.equal(s.regs, 100);
  }
});
test('actual th_ret hook precedes branch dispatch; call uses actual decoder operands', () => {
  const r = func(out['src/05-alu.wat'], 'th_ret');
  const idx = s => r.findIndex(n => Array.isArray(n) && n[0] === s[0] && n[1] === s[1]);
  assert(idx(['call', '$mne_return']) < idx(['return_call', '$branch_end']));
  assert.equal(walk(r, n => n[0] === 'call' && n[1] === '$mne_return').length, 1);
  const call = func(out['src/06b-core-handlers.wat'], 'th_call_r');
  assert.deepEqual(walk(call, n => n[0] === 'call' && n[1] === '$mne_call')[0],
    ['call', '$mne_call', ['local.get', '$op'], ['local.get', '$target'], ['local.get', '$reg']]);
  assert(sources['src/07-decoder.wat'].includes('(then (call $te (i32.const 119) (global.get $d_pc))'));
  assert(sources['src/02-thread-table.wat'].includes('$th_call_r             ;; 119:'));
  assert(sources['src/02-thread-table.wat'].includes('$th_ret                ;; 41'));
  const accepted = selectHook.transform(sources, { enabled: true });
  assert.equal(out['src/09b-dispatch.wat'], accepted['src/09b-dispatch.wat']);
  assert.equal(out['src/09d-winsock.wat'].split('\n;; Opt-in native errno successor latch.')[0]
    .replace('(func $msc_begin_for_mne (export "msc_start")', '(func (export "msc_start")')
    .replace('(global.set $msc_phase (local.get $phase))\n  (if (i32.eq (local.get $phase) (i32.const 3)) (then (call $mne_complete))))',
      '(global.set $msc_phase (local.get $phase)))'), accepted['src/09d-winsock.wat']);
  assert.equal(out['src/05-alu.wat']
    .replace('(local $mne_source i32)\n    (local.set $mne_source (global.get $eip))\n    ', '')
    .replace('(call $mne_return (local.get $mne_source))\n    ', ''), sources['src/05-alu.wat']);
  assert.equal(out['src/06b-core-handlers.wat']
    .replace('\n    (call $mne_call (local.get $op) (local.get $target) (local.get $reg))', ''), sources['src/06b-core-handlers.wat']);
  for (const p of Object.keys(hook.PINS))
    if (!['src/09b-dispatch.wat', 'src/09d-winsock.wat', 'src/05-alu.wat', 'src/06b-core-handlers.wat'].includes(p))
      assert.equal(out[p], sources[p]);
});
test('parked select/stale EAX cannot capture; six parks remain pending', () => {
  const model = new NativeModel();
  for (let i = 0; i < 6; i++) {
    model.g.$yield_reason = 0; model.arm(); model.select();
    model.g.$eip = successor; model.run('$mne_return', [tail]);
    assert.equal(model.g.$mne_status, 1); assert.equal(model.g.$mne_event, 0);
    assert.equal(model.mem.get(100), 0x53000001);
  }
});
test('completed result without actual CALL/RET is insufficient', () => {
  const model = new NativeModel(); model.complete();
  assert.equal(model.g.$mne_status, 2); assert.equal(model.g.$mne_errno, 0);
  model.g.$eip = successor; model.run('$mne_return', [tail]);
  assert.equal(model.g.$mne_status, 5);
});
test('unrelated PC, target, register, source block and frame reject', () => {
  for (const mutate of [m => m.g.$eip++, m => m.mem.set(128, entry + 1), m => m.word = 6,
    m => m.mem.set(116, post + 4), m => m.mem.set(120, 1)]) {
    const model = new NativeModel(); model.complete(); mutate(model); model.callNative();
    assert.equal(model.g.$mne_status, 5);
  }
  for (const [source, mutate] of [[tail + 1, () => {}], [tail, m => m.mem.set(116, post + 4)],
    [tail, m => m.mem.set(120, 9)], [tail, m => m.mem.set(128, entry + 1)], [tail, m => m.g.$msc_token++]]) {
    const model = new NativeModel(); model.complete(); model.callNative();
    model.mem.set(116, post); model.g.$eip = successor;
    mutate(model);
    model.run('$mne_return', [source]); assert.equal(model.g.$mne_status, 5);
  }
  const wrong = new NativeModel(); wrong.complete(); wrong.callNative();
  wrong.put(post - 4, successor + 1); wrong.returnNative(); assert.equal(wrong.g.$mne_status, 5);
});
test('other thread/register bank cannot consume owner event', () => {
  for (const key of ['$current_thread_id', '$reg_base']) {
    const model = new NativeModel(); model.complete(); const owner = model.g[key];
    model.g[key]++; model.callNative = () => model.run('$mne_call', [successor, entry, 7]);
    model.callNative(); assert.equal(model.g.$mne_status, 2);
    model.g[key] = owner; model.run('$mne_call', [successor, entry, 7]); assert.equal(model.g.$mne_status, 3);
    model.g[key]++; model.run('$mne_return', [tail]); assert.equal(model.g.$mne_status, 3);
  }
});
test('stale completion identity is rejected even with coincident PC/ESP/result', () => {
  for (const [key, value] of [['$msc_phase', 2], ['$msc_active', 1], ['$msc_thread', 2],
    ['$msc_pre', pre + 4], ['$msc_post', post + 4], ['$msc_ret', selectRet + 1],
    ['$msc_result', 1], ['$msc_completions', 0], ['$msc_fault', 1], ['$msc_capped', 1]]) {
    const model = new NativeModel(); model.complete(); model.g[key] = value;
    model.callNative(); assert.equal(model.g.$mne_status, 5, key);
  }
});
test('invalid errno/caller spans reject without a memory read or sentinel fallback', () => {
  for (const ptr of [0, 0xf0, 0xffffffff, 0x50000000, 0x10000000]) {
    const model = new NativeModel(); model.complete(); model.callNative();
    model.mem.set(116, post); model.mem.set(100, ptr); model.g.$eip = successor;
    model.reads = []; model.run('$mne_return', [tail]);
    assert.equal(model.g.$mne_status, 5); assert(!model.reads.includes(model.wa(ptr)));
  }
  const model = new NativeModel(); model.complete(); model.callNative();
  model.mem.set(116, post); model.mem.set(100, errnoPtr); model.g.$eip = successor;
  model.pages = model.wa(post + 0x124) >>> 16; model.run('$mne_return', [tail]);
  assert.equal(model.g.$mne_status, 5);
  for (const [ga, len] of [[0xffffffff, 4], [0xffffff00, 12], [0, 4], [0x83edfff, 12]])
    assert.equal(model.run('$mne_wa', [ga, len]), 0xffffffff);
});
test('one-shot immutable record and no reset after capture/rejection', () => {
  const model = new NativeModel(); model.complete(); model.callNative(); model.returnNative();
  const first = model.state();
  model.put(errnoPtr, 0); model.put(post + 0x124, 0x40ed98);
  for (let i = 0; i < 20; i++) { model.run('$mne_complete'); model.run('$mne_call', [successor, entry, 7]); model.run('$mne_return', [tail]); model.exports.mne_start(); }
  assert.deepEqual(model.state(), first);
  const rejected = new NativeModel(); rejected.complete(); rejected.callNative(successor + 1);
  rejected.exports.mne_start(); assert.equal(rejected.g.$mne_status, 5);
});
test('disabled transform is identity and runtime latch is inert', () => {
  const unused = new Proxy({}, { get() { throw Error('unused option read'); } });
  assert.equal(hook.transform(unused), unused);
  assert.equal(hook.transform(unused, { enabled: false, get binaries() { throw Error('unused'); } }), unused);
  const off = new NativeModel(false); off.complete = () => {};
  const before = off.state(); off.run('$mne_complete'); off.run('$mne_call', [successor, entry, 7]); off.run('$mne_return', [tail]);
  assert.deepEqual(off.state(), before); assert.equal(off.reads.length, 0);
});
test('enabled hooks preserve model guest state, flags, budgets and ordinary dispatch', () => {
  const on = new NativeModel(), off = new NativeModel(false);
  // msc_start is the established control; start it without enabling mne.
  off.run('$msc_begin_for_mne');
  for (const model of [on, off]) {
    Object.assign(model.g, { $flag_op: 12, $flag_a: 19, $flag_b: 22, $flag_res: 88, $block_budget: 80 });
    model.complete(); model.callNative(); model.returnNative();
  }
  assert.deepEqual(on.passiveState(), off.passiveState());
  const latch = w.split(';; Opt-in native errno successor latch.')[1];
  for (const name of ['mne_complete', 'mne_call', 'mne_return', 'mne_wa']) {
    const ast = func(latch, name);
    assert.equal(walk(ast, n => ['i32.store', 'return_call', 'dispatch-next'].includes(n[0])).length, 0);
    assert.equal(walk(ast, n => n[0] === 'global.set' && !n[1].startsWith('$mne_')).length, 0);
    assert.equal(walk(ast, n => n[0] === 'call' && !n[1].startsWith('$mne_')).length, 0);
  }
});
test('unsupported native executors and late start reject without changing settings', () => {
  for (const mode of ['$code16', '$block_exec_enabled', '$uop_enabled']) {
    const model = new NativeModel(false); model.g[mode] = 1; model.exports.mne_start();
    assert.equal(model.g.$mne_status, 5); assert.equal(model.g[mode], 1);
  }
  const model = new NativeModel(false); model.run('$msc_begin_for_mne'); model.exports.mne_start();
  assert.equal(model.g.$mne_status, 5);
});
test('all exact source and binary pins plus missing/ambiguous anchors reject', () => {
  for (const p of Object.keys(hook.PINS)) assert.throws(() => hook.transform({ ...sources, [p]: sources[p] + '\n' }, options), /source pin/);
  for (const name of Object.keys(binaries)) {
    const b = Buffer.from(binaries[name]); b[0] ^= 1;
    assert.throws(() => hook.transform(sources, { ...options, binaries: { ...binaries, [name]: b } }), /binary pin/);
  }
  assert.throws(() => hook.transform(sources, { ...options, crtLoadedBase: undefined }), /explicit future/);
  assert.throws(() => hook.once('anchor anchor', 'anchor', 'replacement'), /ambiguous/);
  assert.throws(() => hook.once('missing', 'anchor', 'replacement'), /anchor/);
  const net = hook.pe(binaries.net);
  for (const [va, hex] of Object.entries(hook.NET_ANCHORS)) {
    const b = Buffer.from(binaries.net); b[net.offset(Number(va), 1)] ^= 1;
    assert.throws(() => hook.pe(b).check(Number(va), hex), /native byte anchor/);
  }
});
console.log(JSON.stringify({ pass: true, groups, qualification: 'source AST/model and static byte controls only; compiled/native/original unexecuted' }));

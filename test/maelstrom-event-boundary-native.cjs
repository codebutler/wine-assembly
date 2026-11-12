'use strict';
// Retained-module SYNTHETIC qualification. Never executes an original game.
// --preflight uses isolated diagnostic fixtures, never native exports or arenas.
const fs = require('fs'), vm = require('vm'), assert = require('assert/strict'), crypto = require('crypto');
const o = require('../tools/maelstrom-event-boundary-observer.cjs');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const HEAD = 0x7a3362, CONTROL = 0x7a3c62, IMAGE = 0x400000;
const ESP = 0x7402000, FD = 0x430000, TV = 0x430200, SELECT = 0x75040f8, OTHER = SELECT - 8;
const direct = a => a - IMAGE + 0x12000;
const paths = process.argv.slice(2).filter(x => x !== '--preflight');
const [runnerPath, exportsPath, schedulerPath, modulePath] = paths;
const sources = paths.map(p => fs.readFileSync(p));
const expected = [o.RUNNER, o.EXPORTS, o.SCHEDULER, o.MODULE];
sources.forEach((b, i) => assert.equal(sha(b), expected[i], 'input identity ' + paths[i]));
assert.equal(sha(fs.readFileSync(require.resolve('../tools/maelstrom-event-boundary-observer.cjs'))),
  '52909f8dc9e39c9c294602c952d9bbbf4e91c52d5c56ddbba45fb3cb30d9e226');
assert.equal(sources[3].length, 1879746);
const exportsSource = sources[1].toString(), schedulerSource = sources[2].toString();
const required = ['run', 'init_thread', 'get_eip', 'set_eip', 'set_eax', 'set_edi', 'set_ebp', 'set_esp',
  'get_count', 'set_count', 'set_yield_state', 'get_yield_reason', 'get_yield_flag', 'get_last_run_halt',
  'get_thunk_base', 'get_thunk_end', 'thunk_word', 'get_image_base'];
// Parse binary export names without compiling or instantiating the retained module.
function exportNames(b) {
  let at = 8; const names = [];
  const u = () => { let n = 0, s = 0, c; do { c = b[at++]; n |= (c & 127) << s; s += 7; } while (c & 128); return n >>> 0; };
  while (at < b.length) { const id = b[at++], len = u(), end = at + len;
    if (id === 7) { const n = u(); for (let i = 0; i < n; i++) { const l = u(); names.push(b.toString('utf8', at, at + l)); at += l; at++; u(); } }
    at = end;
  } return names;
}
const names = exportNames(sources[3]); required.forEach(n => assert(names.includes(n), 'native export contract: ' + n));
function importContract(b) {
  let at = 8; const entries = [];
  const u = () => { let n = 0, s = 0, c; do { c = b[at++]; n |= (c & 127) << s; s += 7; } while (c & 128); return n >>> 0; };
  const str = () => { const l = u(), s = b.toString('utf8', at, at + l); at += l; return s; };
  while (at < b.length) { const id = b[at++], len = u(), end = at + len;
    if (id === 2) { const n = u(); for (let i = 0; i < n; i++) {
      const module = str(), name = str(), kind = b[at++];
      if (kind === 0) entries.push({ module, name, kind: 'function', type: u() });
      else { assert.equal(kind, 2, 'only function and memory imports supported');
        const flags = u(), min = u(), max = flags & 1 ? u() : null;
        entries.push({ module, name, kind: 'memory', flags, min, max });
      }
    } } at = end;
  }
  const memories = entries.filter(x => x.kind === 'memory');
  assert.deepEqual(memories, [{ module: 'host', name: 'memory', kind: 'memory', flags: 3, min: 8192, max: 32768 }]);
  return { functions: entries.filter(x => x.kind === 'function').length, memories };
}
const nativeImports = importContract(sources[3]);
for (const [a, n] of [[ESP, 6], [FD, 4], [TV, 2], [SELECT, 2]]) {
  assert(direct(a) >= 0x12000 && direct(a) + n * 4 <= 0x08000000, 'direct-span recipe');
}
const fixtures = [HEAD, HEAD + 4, CONTROL, CONTROL + 4];
assert.equal(new Set(fixtures).size, fixtures.length);
// Source-backed counter semantics: rearming the same address preserves count.
assert(exportsSource.includes('Arming the same address twice must not throw the count away.'));
const slots = new Map(); const arm = (i, a) => { if (slots.get(i)?.addr !== a) slots.set(i, { addr: a, count: 0 }); };
arm(0, CONTROL); arm(1, CONTROL + 4); slots.get(0).count = 3;
arm(0, CONTROL); assert.equal(slots.get(0).count, 3);
arm(0, HEAD); arm(1, HEAD + 4); assert.deepEqual([...slots.values()].map(x => x.count), [0, 0]);
assert.throws(() => assert.deepEqual([3, 0], [0, 0]), 'reject contamination');

function fixture(factory) {
  const lines = [], calls = [], marker = {}, s = { ip: OTHER, reason: 8, flag: 0, halt: 4 };
  const e = Object.freeze(Object.assign(Object.create(null), {
    run(...args) { calls.push({ receiver: this, args }); if (args[0] === marker) throw marker; return args[0]; },
    get_eip: () => s.ip, get_yield_reason: () => s.reason, get_yield_flag: () => s.flag,
    get_last_run_halt: () => s.halt, get_count: () => 0,
    get_thunk_base: () => 0x7500000, get_thunk_end: () => 0x7540000,
    thunk_word: (ip, w) => w ? (ip === SELECT ? 934 : 935) : 0x1000,
    get_image_base: () => IMAGE, get_esp: () => ESP,
  }));
  const obs = factory(l => lines.push(l)); const wrapped = obs.wrapInstance({ exports: e }, null).exports;
  const receiver = {}; assert.equal(wrapped.run.call(receiver, 7, 11), 7);
  assert.equal(calls.length, 1); assert.equal(calls[0].receiver, receiver); assert.deepEqual(calls[0].args, [7, 11]);
  assert.equal(lines.length, 0, 'unrelated metadata must not be select');
  s.ip = SELECT; assert.equal(wrapped.run(9), 9); assert(lines.some(l => l.includes('select-net-wait')));
  assert.equal(calls[1].receiver, e, 'facade receiver maps to real exports');
  s.ip = HEAD; wrapped.run(1); s.ip = HEAD + 4; wrapped.run(1);
  assert.throws(() => wrapped.run(marker), err => err === marker, 'exception object preserved');
  obs.finish(); const rows = lines.map(l => JSON.parse(l.slice(l.indexOf('{'))));
  assert(rows.some(r => r.events?.includes('head')) && rows.some(r => r.events?.includes('interior')));
  assert(rows.filter(r => r.kind !== 'summary').every(r => r.apiResult === 'unattributed'));
  assert.equal(calls.length, 5, 'one original run per invocation');
  const capLines = [], cap = factory(l => capLines.push(l), { maxRecords: 0 });
  const ce = cap.wrapInstance({ exports: e }, null).exports;
  const before = calls.length; ce.run(17); ce.run(19); cap.finish();
  assert.equal(calls.length - before, 2); assert.equal(capLines.length, 0, 'cap stops logging only');
}
function preflight() {
  fixture(o.createObserver);
  const source = o.createObserver.toString();
  const mutations = [
    ['reason-only select attribution', 'Array.isArray(meta) && meta[1] === 934', 'true'],
    ['extra original run', 'const result = Reflect.apply(original, this === facade ? e : this, args);',
      'Reflect.apply(original, this === facade ? e : this, args); const result = Reflect.apply(original, this === facade ? e : this, args);'],
    ['drop arguments', 'const result = Reflect.apply(original, this === facade ? e : this, args);',
      'const result = Reflect.apply(original, this === facade ? e : this, []);'],
    ['lose exception', 'threw = false; return result;', 'threw = false; return result; } catch (_) { return 0;'],
    ['ignore record cap', 'records >= maxRecords', 'records >= 16'],
    ['drop head event', "out.push('head')", "out.push('wrong-head')"],
  ];
  const controls = [];
  for (const [name, from, to] of mutations) {
    assert(source.includes(from), 'mutant binds production code');
    const changed = source.replace(from, to);
    const factory = vm.runInNewContext('(' + changed + ')', { Buffer, Set, Reflect, Object, Number });
    assert.throws(() => fixture(factory), undefined, 'mutant must reject: ' + name); controls.push(name);
  }
  return { pass: true, inputSHA256: sources.map(sha), fixtures, targetStartingCounts: [0, 0],
    syntheticCounterPreflight: true, nativeCountsCheckedAgainBeforeRun: true,
    spans: { ESP, FD, TV, SELECT, image: IMAGE, thunkBacking: direct(SELECT) },
    controlsRejected: controls, nativeExportCount: names.length, nativeImports,
    missingObserverGetters: ['bp_addr', 'tick_count'].filter(n => !names.includes('get_' + n)) };
}
const cheap = preflight();
if (process.argv.includes('--preflight')) console.log(JSON.stringify(cheap));
else main().catch(err => { console.error(err.stack); process.exitCode = 1; });

async function main() {
  const module = await WebAssembly.compile(sources[3]);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = {}, lifecycle = [], unexpected = [];
  for (const i of WebAssembly.Module.imports(module)) {
    const ns = imports[i.module] ||= {};
    if (i.kind === 'memory') { assert.equal(i.module + '.' + i.name, 'host.memory'); ns[i.name] = memory; }
    else { assert.equal(i.kind, 'function'); ns[i.name] = (...args) => {
      if (i.module === 'host' && ['beep_process_begin', 'beep_thread_begin'].includes(i.name)) {
        lifecycle.push({ name: i.name, args }); return 0;
      } unexpected.push(i.module + '.' + i.name); throw Error('unexpected behavioral import');
    }; }
  }
  const instance = await WebAssembly.instantiate(module, imports), e = instance.exports;
  e.init_thread(0, IMAGE, HEAD, CONTROL + 0x1000, 0x7500000, 0x7540000, 0, 1);
  required.forEach(n => assert.equal(typeof e[n], 'function', 'actual contract: ' + n));
  assert.equal(e.get_image_base(), IMAGE); assert.equal(e.get_thunk_base(), 0x7500000);
  assert.equal(Object.getOwnPropertyDescriptor(e, 'run').configurable, false);
  const put = (a, b) => new Uint8Array(memory.buffer, direct(a), b.length).set(b);
  const words = (a, ws) => ws.forEach((w, i) => new DataView(memory.buffer).setUint32(direct(a) + i * 4, w, true));
  // Source 09a0e-process-memory.wat: unpatched metadata = THUNK_BASE + index*8.
  // This is diagnostic metadata/stack, never original-game evidence.
  words(SELECT, [0x1000, 934]); words(OTHER, [0x1000, 935]);
  words(ESP, [0x401234, 0, FD, 0, 0, TV]); words(FD, [3, 0x101, 0x102, 0x103]); words(TV, [0, 5000]);
  assert.deepEqual([e.thunk_word(SELECT, 0), e.thunk_word(SELECT, 1)], [0x1000, 934]);
  assert.equal(e.thunk_word(OTHER, 1), 935);
  const raw = [], observer = o.createObserver(l => raw.push(l));
  const wrapped = observer.wrapInstance(instance, memory), f = wrapped.exports;
  assert.notEqual(f, e); assert.equal(f.set_eip, e.set_eip);
  const schedulerContext = vm.createContext({ workerImports: {}, DllLoader: {}, memUtils: {}, console });
  vm.runInContext(schedulerSource + '\nthis.NativeThreadManager = ThreadManager;', schedulerContext, { timeout: 1000 });
  const tm = Object.create(schedulerContext.NativeThreadManager.prototype);
  Object.assign(tm, { mainInstance: wrapped, _renderSendTargets: new Set(), _waitNow: () => 0, _mainSleepUntil: 0 });
  const snapshots = [], isolation = [];
  function lane(pc, enabled) {
    const x = enabled ? f : e, startStores = e.get_cache_stores(), startClears = e.get_cache_clears(), startInvals = e.get_cache_invals();
    // MOV EBP,EAX; CALL EDI; CMP [EAX],4; JMP head. CALL creates the
    // source-backed basic-block boundary at pc+4; NOP interior is insufficient.
    put(pc, [0x8b, 0xe8, 0xff, 0xd7, 0x83, 0x38, 4, 0xeb, 0xf7]);
    put(pc + 0x100, [0xc3]);
    e.set_count(0, pc); e.set_count(1, pc + 4);
    const counts = [e.get_count(0), e.get_count(1)]; isolation.push({ enabled, addresses: [pc, pc + 4], counts });
    assert.deepEqual(counts, [0, 0], 'reject actual contaminated counters before any lane run');
    e.set_eax(FD); e.set_edi(pc + 0x100); e.set_ebp(0x7401000); e.set_esp(ESP); e.set_bp(0);
    const rows = [];
    for (let step = 0; step < 6; step++) {
      observer.setBatch(50000 + step); // deliberately outside historical fixed window
      e.set_eip(step === 0 ? pc + 0x200 : step === 1 ? OTHER : step === 2 ? SELECT : step === 3 ? pc : pc + (step === 5 ? 4 : 0));
      e.set_yield_state(step === 4 ? 0 : 8, 0);
      if (step === 4) e.set_bp(pc + 4);
      if (step === 2) { const before = e.get_yield_reason(); assert.equal(tm.checkMainYield(), false); assert.equal(e.get_yield_reason(), before); }
      const result = step === 0 ? Reflect.apply(x.run, { diagnosticReceiver: true }, [100, 7]) : x.run(100);
      assert.equal(result, undefined, 'native void run return preserved');
      const row = { step, eip: e.get_eip(), eax: e.get_eax(), edi: e.get_edi(), ebp: e.get_ebp(), esp: e.get_esp(),
        reason: e.get_yield_reason(), flag: e.get_yield_flag(), halt: e.get_last_run_halt(), counts: [e.get_count(0), e.get_count(1)],
        stores: e.get_cache_stores() - startStores, clears: e.get_cache_clears() - startClears, invals: e.get_cache_invals() - startInvals,
        memorySHA256: sha(Buffer.from(memory.buffer, direct(ESP), 24)),
        fdTimevalSHA256: sha(Buffer.from(memory.buffer, direct(FD), 520)) };
      assert.equal(row.halt, step === 4 ? 5 : 4); assert.equal(row.reason, step === 4 ? 0 : 8);
      if (step !== 4 && step < 4) assert.equal(row.stores, 0, 'pending guard prevents decode');
      assert.equal(row.eax, FD); assert.equal(row.esp, ESP);
      assert.equal(row.ebp, step >= 4 ? FD : 0x7401000);
      if (step === 4) assert.equal(row.eip, pc + 4);
      rows.push({ ...row, edi: row.edi - pc, eip: row.eip >= pc && row.eip <= pc + 0x200 ? row.eip - pc : row.eip });
    }
    snapshots.push({ enabled, rows }); return rows;
  }
  const off = lane(CONTROL, false), on = lane(HEAD, true);
  assert.deepEqual(on, off, 'native OFF/ON guest registers/memory/cache/yield equivalence');
  // Wasm argument coercion throws before execution. Preserve exact thrown object.
  const sentinel = {}; const badArg = { valueOf() { throw sentinel; } };
  for (const x of [e, f]) assert.throws(() => x.run(badArg), err => err === sentinel);
  observer.finish();
  const records = raw.map(l => JSON.parse(l.slice(l.indexOf('{'))));
  const select = records.find(r => r.events?.includes('select-net-wait'));
  assert(select); assert.deepEqual(select.detail.thunkWords, [0x1000, 934]);
  assert.deepEqual(select.detail.stack, [0x401234, 0, FD, 0, 0, TV]);
  assert.deepEqual(select.detail.fdSets, [{ count: 3, prefix: [0x101, 0x102], truncated: true }, 'NULL', 'NULL']);
  assert.deepEqual(select.detail.timeval, [0, 5000]);
  assert.equal(select.before.selectDeadline, 'unavailable');
  assert(records.some(r => r.events?.includes('head') && r.invocation === 4));
  assert(records.some(r => r.events?.includes('interior') && r.invocation === 5));
  assert(!records.some(r => r.events?.includes('select-net-wait') && r.before?.eip === OTHER));
  assert(records.some(r => r.observation === 'pending-reason-guard-before-dispatch' && r.movCallExecuted === false));
  assert(records.filter(r => r.kind !== 'summary').every(r => r.apiCompletion === 'unobserved' && r.apiResult === 'unattributed'));
  assert(raw.length <= 16 && Buffer.byteLength(raw.join('')) <= 8192);
  assert.deepEqual(unexpected, []);
  console.log(JSON.stringify({ status: 'PASS', qualification: 'native synthetic; no original-game execution', instantiations: 1,
    moduleSHA256: sha(sources[3]), observerSHA256: sha(fs.readFileSync(require.resolve('../tools/maelstrom-event-boundary-observer.cjs'))),
    schedulerSHA256: sha(sources[2]), cheap, isolation, snapshots, lifecycle,
    schedulerScope: 'actual checkMainYield and noteMainSleep methods, controlled owner; no scheduler-internal run qualification',
    missingObserverGetters: ['eip','edi','eax','ebp','esp','yield_reason','yield_flag','last_run_halt','bp_addr','cache_stores','cache_clears','cache_invals','tick_count'].filter(k => typeof e['get_' + k] !== 'function'),
    recordsBytes: Buffer.byteLength(raw.join('')), rawRecords: raw,
    limits: 'all invocation boundaries only; intra-invocation visits unobserved; deadline unavailable; API return unattributed; counters not execution; overhead unmeasured' }));
}

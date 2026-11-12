#!/usr/bin/env node
'use strict';
// Actual x86 import -> comparator RET -> CACA002D, including nested qsort and
// budget slices. Controlled continuation rejection probes supplement the
// guest path; they do not claim complete nonlocal-jump ownership coverage.
const assert = require('assert');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { BASE: REGION, SIZE } = require('../lib/region-map.generated');
const { pe, BASE } = require('./test-dll-lifecycle-real-pe');
const u32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24];
const address = rva => BASE + rva;
const push = v => [0x68, ...u32(v)];
const callSort = (array, count, comparator) => [
  ...push(address(comparator)), ...push(4), ...push(count), ...push(address(array)),
  0xff, 0x15, ...u32(address(0x1900)), 0x83, 0xc4, 16,
];
const compare = [0x8b, 0x44, 0x24, 4, 0x8b, 0,
  0x8b, 0x54, 0x24, 8, 0x2b, 2, 0xc3];
const loop = [0xb9, ...u32(200), 0x49, 0x75, 0xfd];
const nestedCall = [0xc7, 5, ...u32(address(0x1420)), ...u32(1),
  ...callSort(0x1410, 2, 0x2200)];
function image({ nested = true, count = 3, trap = false } = {}) {
  const noOp = [...loop, ...callSort(0x1410, 0, 0x2200),
    0xc7, 5, ...u32(address(0x1430)), ...u32(1), ...loop];
  const comparator = trap ? [0x0f, 0x0b] : nested ? [...noOp,
    0x83, 0x3d, ...u32(address(0x1420)), 0,
    0x75, nestedCall.length, ...nestedCall, ...loop, ...compare] : [...loop, ...compare];
  const b = pe([[0x2000, [...callSort(0x1400, count, 0x2100), 0xc3]],
    [0x2100, comparator], [0x2200, [...loop, ...compare]],
    [0x1400, [...u32(3), ...u32(1), ...u32(2)]],
    [0x1410, [...u32(9), ...u32(4)]], [0x1420, u32(0)], [0x1430, u32(0)]]);
  const raw = rva => rva - 0x1000 + 0x200;
  b.fill(0, raw(0x1880), raw(0x1880) + 16); b.write('crtdll.dll\0', raw(0x1880));
  b.write('qsort\0', raw(0x1a02)); b.writeUInt32LE(0, raw(0x1904));
  return b;
}
async function main() {
  const wasm = compileSrcWasm((file, text) => file !== '13-exports.wat' ? text : text + `
    (export "test_qsort_continue_owned" (func $qsort_continue))
    (export "test_qsort_begin_owned" (func $handle_qsort))
    (export "test_reload_code" (func $clear_cache))
    (export "test_qsort_token" (func $invocation_current))
    (func (export "test_qsort_depth") (result i32) (global.get $qsort_depth))
    (func (export "test_invocation_depth") (result i32) (global.get $invocation_depth))`,
  { tailCalls: !process.argv.includes('--no-tail-calls') });
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit() {} };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  imports.host.log_i32 = () => {};
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const x = instance.exports; ctx.exports = x;
  // Instantiate before any live comparator: active data segments reapply to
  // imported shared memory. Thread attachment itself still occurs below.
  const workerCtx = { ...ctx };
  const workerImports = createHostImports(workerCtx); workerImports.host.memory = memory;
  workerImports.host.log_i32 = () => {};
  const { instance: workerInstance } = await WebAssembly.instantiate(wasm, workerImports);
  const w = workerInstance.exports; workerCtx.exports = w;
  const dv = new DataView(memory.buffer), translate = p => x.guest_to_wasm(p);
  const readArray = (rva, n) => Array.from({ length: n }, (_, i) => dv.getInt32(translate(address(rva) + i * 4), true));
  let initialSP;
  const begin = options => {
    const b = image(options);
    new Uint8Array(memory.buffer, x.get_staging(), b.length).set(b);
    assert.strictEqual(x.load_pe(b.length), address(0x2000));
    // The fixture rewrites code at the same addresses in a retained instance.
    // load_pe establishes ownership, but is not a decoded-code cache reset.
    x.test_reload_code();
    initialSP = x.guest_alloc(0x10000) + 0xfff0;
    dv.setUint32(translate(initialSP), 0, true);
    x.set_esp(initialSP); x.set_eip(address(0x2000)); x.clear_yield();
    return x.test_qsort_token();
  };
  const root = begin({ nested: true });
  let nestedSeen = false, repeated = false, last = null, childCount = new Set();
  let outer = null, parentRestored = false, noOpPreserved = false;
  for (let round = 0; round < 5000 && (x.get_eip() >>> 0) > 2; round++) {
    x.run(1);
    const token = x.test_qsort_token(), depth = x.test_invocation_depth();
    if (depth) { childCount.add(token); if (last === token) repeated = true; }
    if (depth === 1 && outer === null) outer = token;
    if (depth === 1 && token === outer && readArray(0x1430, 1)[0] === 1 &&
        readArray(0x1420, 1)[0] === 0) noOpPreserved = true;
    if (depth === 2) nestedSeen = true;
    if (nestedSeen && depth === 1 && token === outer) parentRestored = true;
    last = token;
  }
  assert((x.get_eip() >>> 0) <= 2, 'guest returned through both real qsort continuations');
  assert.deepStrictEqual(readArray(0x1400, 3), [1, 2, 3]);
  assert.deepStrictEqual(readArray(0x1410, 2), [4, 9]);
  assert(nestedSeen && parentRestored, 'nested qsort preserves outer comparator identity');
  assert(noOpPreserved, 'empty qsort inside comparator preserves its parent token');
  assert(repeated && childCount.size >= 4, 'budget slices retain token; sibling comparators get fresh tokens');
  assert.strictEqual(x.test_qsort_token(), root);
  assert.strictEqual(x.test_qsort_depth(), 0);
  assert.strictEqual(x.get_esp() >>> 0, (initialSP + 4) >>> 0);

  const active = () => {
    begin({ nested: false });
    for (let i = 0; i < 50 && !x.test_invocation_depth(); i++) x.run(1);
    assert.strictEqual(x.test_invocation_depth(), 1);
  };
  const snapshot = () => ({ token: x.test_qsort_token(), depth: x.test_qsort_depth(),
    eip: x.get_eip(), esp: x.get_esp(), eax: x.get_eax(), data: readArray(0x1400, 3),
    ownership: Buffer.from(new Uint8Array(memory.buffer, REGION.CALLBACK_OWNERSHIP, SIZE.CALLBACK_OWNERSHIP)),
    frames: Buffer.from(new Uint8Array(memory.buffer, REGION.QSORT_CONTEXTS, SIZE.QSORT_CONTEXTS)) });
  const reject = () => {
    const before = snapshot();
    assert.throws(() => x.test_qsort_continue_owned(), WebAssembly.RuntimeError);
    assert.deepStrictEqual(snapshot(), before);
  };
  active(); // A continuation before RET has the wrong ESP.
  reject();
  const frame = REGION.QSORT_CONTEXTS;
  x.set_esp(dv.getUint32(frame + 28, true));
  dv.setBigUint64(frame + 40, root, true); // retained expected child is stale
  reject();
  assert.strictEqual(x.test_qsort_depth(), 1, 'rejected callback remains retained until explicit reset');
  active();
  const abandonedThreadToken = x.test_qsort_token();
  x.init_thread(0, x.get_image_base(), x.get_code_start(), x.get_code_end(),
    x.get_thunk_base(), x.get_thunk_end(), x.get_num_thunks(), x.get_rsrc_rva());
  assert.notStrictEqual(x.test_qsort_token(), abandonedThreadToken);
  assert.strictEqual(x.test_qsort_depth(), 1, 'slot reset invalidates rather than silently completing frames');
  assert.throws(() => x.test_qsort_continue_owned(), WebAssembly.RuntimeError);
  begin({ trap: true });
  assert.throws(() => { for (let i = 0; i < 50; i++) x.run(1); }, WebAssembly.RuntimeError);
  assert.strictEqual(x.test_invocation_depth(), 1, 'guest comparator trap does not pop its token');
  assert.strictEqual(x.test_qsort_depth(), 1, 'trapped comparator frame remains until explicit reset');
  // Explicit process reset retires the abandoned child/frame; no implicit pop.
  const nextRoot = begin({ count: 0 });
  assert.strictEqual(x.test_qsort_depth(), 1, 'process reset rejects a retained nonzero-depth frame');
  for (let i = 0; i < 20 && (x.get_eip() >>> 0) > 2; i++) x.run(1);
  assert.strictEqual(x.test_qsort_token(), nextRoot, 'empty qsort creates no callback identity');
  assert.throws(() => x.test_qsort_continue_owned(), WebAssembly.RuntimeError);

  // Two actual WASM instances and production init_thread share the memory but
  // retain independent qsort frames. This is interleaved execution, not a
  // simultaneous OS Worker race or allocator-concurrency proof.
  active();
  const mainToken = x.test_qsort_token();
  const mainFrames = Buffer.from(new Uint8Array(memory.buffer, REGION.QSORT_CONTEXTS, 4096));
  w.init_thread(1, x.get_image_base(), x.get_code_start(), x.get_code_end(),
    x.get_thunk_base(), x.get_thunk_end(), x.get_num_thunks(), x.get_rsrc_rva());
  const workerRoot = w.test_qsort_token();
  const workerSP = x.guest_alloc(0x10000) + 0xfff0;
  dv.setUint32(translate(workerSP), 0, true); w.set_esp(workerSP);
  w.test_qsort_begin_owned(address(0x1410), 2, 4, address(0x2200), 0, 0);
  assert.strictEqual(w.test_qsort_depth(), 1);
  assert.notStrictEqual(w.test_qsort_token(), mainToken);
  assert.strictEqual(dv.getBigUint64(REGION.QSORT_CONTEXTS + 4096 + 40, true),
    BigInt.asUintN(64, w.test_qsort_token()), 'worker child occupies its own partition');
  for (let i = 0; i < 5000 && (w.get_eip() >>> 0) > 2; i++) w.run(1);
  assert((w.get_eip() >>> 0) <= 2);
  assert.deepStrictEqual(readArray(0x1410, 2), [4, 9]);
  assert.strictEqual(w.test_qsort_token(), workerRoot);
  assert.strictEqual(w.get_esp() >>> 0, (workerSP + 4) >>> 0);
  assert.strictEqual(x.test_qsort_token(), mainToken);
  assert.deepStrictEqual(Buffer.from(new Uint8Array(memory.buffer, REGION.QSORT_CONTEXTS, 4096)), mainFrames);
  for (let i = 0; i < 5000 && (x.get_eip() >>> 0) > 2; i++) x.run(1);
  assert((x.get_eip() >>> 0) <= 2);
  assert.deepStrictEqual(readArray(0x1400, 3), [1, 2, 3]);
  assert.strictEqual(w.test_qsort_token(), workerRoot);

  // Controlled real-handler boundary probes: every successful entry publishes
  // a retained frame; capacity or allocator exhaustion must publish nothing.
  const directBegin = () => x.test_qsort_begin_owned(address(0x1400), 3, 4, address(0x2100), 0, 0);
  const rejectBegin = () => {
    const before = snapshot();
    assert.throws(directBegin, WebAssembly.RuntimeError);
    assert.deepStrictEqual(snapshot(), before);
  };
  begin({ nested: false });
  for (let i = 0; i < 63; i++) directBegin();
  assert.strictEqual(x.test_qsort_depth(), 63);
  assert.strictEqual(x.test_invocation_depth(), 63);
  rejectBegin();
  begin({ nested: false });
  dv.setBigUint64(REGION.CALLBACK_OWNERSHIP, (1n << 64n) - 2n, true);
  directBegin();
  assert.strictEqual(BigInt.asUintN(64, x.test_qsort_token()), (1n << 64n) - 1n);
  rejectBegin();
  console.log('qsort invocation ownership PASS: real guest nested/CACA/yield path and unchanged rejection probes');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

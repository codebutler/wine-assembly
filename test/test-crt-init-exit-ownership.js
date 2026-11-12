#!/usr/bin/env node
'use strict';
// Actual x86 imports/RET/CRT continuation paths. Direct probes are labeled below.
const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { BASE: REGION, SIZE } = require('../lib/region-map.generated');
const { pe, BASE } = require('./test-dll-lifecycle-real-pe');
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
const addr = r => BASE + r;
const push = n => [0x68, ...u32(n)];
const api = n => [0xff, 0x15, ...u32(addr(0x1900 + n * 4))];
const init = (start, end) => [...push(addr(end)), ...push(addr(start)), ...api(0), 0x83, 0xc4, 8];
const reg = fn => [...push(addr(fn)), ...api(1), 0x83, 0xc4, 4];
const loop = [0xb9, ...u32(200), 0x49, 0x75, 0xfd];
const mark = r => [0xff, 5, ...u32(addr(0x1450)), 0xa1, ...u32(addr(0x1450)), 0xa3, ...u32(addr(r))];
function image({ mode = 0, trap = false, empty = false } = {}) {
  const main = mode === 0 ? [...reg(0x2400), ...reg(0x2300), ...init(0x1400, empty ? 0x1400 : 0x140c), 0xc3]
    : [...(empty ? [] : reg(trap ? 0x2600 : 0x2400)), ...(mode === 1 ? [...push(73), ...api(3), 0xcc] : [...api(2), 0xc3])];
  const b = pe([[0x2000, main],
    [0x2100, trap ? [0x0f, 0x0b] : [...loop, ...init(0x1410, 0x1410), ...mark(0x1454),
      ...init(0x1410, 0x1414), ...api(2), ...loop, 0xc3]],
    [0x2200, [...loop, ...mark(0x1458), 0xc3]],
    [0x2300, [...loop, ...reg(0x2500), ...api(2), ...mark(0x145c), 0xc3]],
    [0x2400, [...loop, ...mark(0x1460), 0xc3]],
    [0x2500, [...loop, ...init(0x1410, 0x1414), ...mark(0x1464), 0xc3]],
    [0x2600, [0x0f, 0x0b]],
    [0x2700, [...loop, ...mark(0x1468), 0xc3]],
    [0x1400, [0, addr(0x2100), addr(0x2200), 0, addr(0x2700)].flatMap(u32)],
    [0x1450, Array(32).fill(0)]]);
  const raw = r => r - 0x1000 + 0x200;
  b.fill(0, raw(0x1880), raw(0x1880) + 16); b.write('crtdll.dll\0', raw(0x1880));
  let cursor = 0x1a00;
  for (const [i, name] of ['_initterm', 'atexit', '_cexit', 'exit'].entries()) {
    b.writeUInt32LE(cursor, raw(0x1900 + i * 4)); b.write(name + '\0', raw(cursor + 2)); cursor += name.length + 3;
  }
  b.writeUInt32LE(0, raw(0x1910)); return b;
}
async function main() {
  const wasm = compileSrcWasm((file, text) => file !== '13-exports.wat' ? text : text + `
    (export "t_continue" (func $crt_callback_continue))
    (export "t_begin" (func $crt_callback_begin))
    (export "t_token" (func $invocation_current))
    (export "t_clear" (func $clear_cache))
    (func (export "t_depth") (result i32) (global.get $crt_callback_depth))
    (func (export "t_inv_depth") (result i32) (global.get $invocation_depth))
    (func (export "t_registry") (result i32) (global.get $atexit_table))
    (func (export "t_clear_registry") (global.set $atexit_count (i32.const 0))
      (global.set $atexit_table (i32.const 0)) (global.set $atexit_capacity (i32.const 0)))`,
  { tailCalls: !process.argv.includes('--no-tail-calls') });
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const exits = [];
  const make = async () => {
    const ctx = { getMemory: () => memory.buffer, renderer: null,
      resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit(code) { exits.push(code); } };
    const imports = createHostImports(ctx); imports.host.memory = memory; imports.host.log_i32 = () => {};
    const { instance } = await WebAssembly.instantiate(wasm, imports); ctx.exports = instance.exports; return instance.exports;
  };
  const x = await make(), w = await make(), dv = new DataView(memory.buffer);
  const get = r => dv.getUint32(x.guest_to_wasm(addr(r)), true);
  let sp;
  function begin(options = {}) {
    const b = image(options); new Uint8Array(memory.buffer, x.get_staging(), b.length).set(b);
    assert.equal(x.load_pe(b.length), addr(0x2000)); x.t_clear();
    // Existing registry process reset semantics are outside this ownership slice.
    x.t_clear_registry(); exits.length = 0;
    sp = x.guest_alloc(0x10000) + 0xfff0; dv.setUint32(x.guest_to_wasm(sp), 0, true);
    x.set_esp(sp); x.set_eip(addr(0x2000)); x.clear_yield(); return x.t_token();
  }
  function finish(who = x, observe = () => {}) {
    for (let i = 0; i < 10000 && (who.get_eip() >>> 0) > 2; i++) { who.run(1); observe(); }
    assert((who.get_eip() >>> 0) <= 2, 'guest finishes through real CRT continuations');
  }
  const root = begin(); const children = new Set();
  let outer, nested = false, restored = false, retained = false, last;
  finish(x, () => {
    const token = x.t_token(), depth = x.t_depth();
    if (depth) { children.add(token); if (token === last) retained = true; }
    if (depth === 1 && outer === undefined) outer = token;
    if (depth >= 3) nested = true;
    if (nested && depth === 1 && token === outer) restored = true;
    last = token;
  });
  assert(nested && restored && retained && children.size >= 7);
  assert.deepEqual([0x1454, 0x1468, 0x1464, 0x1460, 0x145c, 0x1458].map(get), [1, 3, 4, 5, 6, 7]);
  assert.equal(x.t_token(), root); assert.equal(x.t_depth(), 0); assert.equal(x.get_esp() >>> 0, sp + 4);
  for (const mode of [0, 1, 2]) for (const empty of [false, true]) {
    const r = begin({ mode, empty }); finish(); assert.equal(x.t_token(), r); assert.equal(x.t_depth(), 0);
    if (mode === 1) assert.deepEqual(exits, [73]); else assert.equal(x.get_esp() >>> 0, sp + 4);
  }
  const active = (mode = 0) => {
    begin({ mode }); for (let i = 0; i < 50 && !x.t_inv_depth(); i++) x.run(1); assert.equal(x.t_depth(), 1);
  };
  const snapshot = () => ({ token: x.t_token(), depth: x.t_depth(), esp: x.get_esp(), eip: x.get_eip(),
    count: x.test_crt_atexit_count(), registry: Buffer.from(new Uint8Array(memory.buffer,
      x.guest_to_wasm(x.t_registry()), x.test_crt_atexit_count() * 4)),
    ownership: Buffer.from(new Uint8Array(memory.buffer, REGION.CALLBACK_OWNERSHIP, SIZE.CALLBACK_OWNERSHIP)),
    frames: Buffer.from(new Uint8Array(memory.buffer, REGION.CRT_CALLBACK_CONTEXTS, SIZE.CRT_CALLBACK_CONTEXTS)) });
  const reject = fn => { const before = snapshot(); assert.throws(fn, WebAssembly.RuntimeError); assert.deepEqual(snapshot(), before); };
  for (const mode of [0, 1, 2]) {
    active(mode); reject(() => x.t_continue(mode)); // callback has not RET: wrong ESP
    x.set_esp(dv.getUint32(REGION.CRT_CALLBACK_CONTEXTS + 20, true));
    reject(() => x.t_continue((mode + 1) % 3));
    dv.setBigUint64(REGION.CRT_CALLBACK_CONTEXTS + 40, root, true); reject(() => x.t_continue(mode));
    active(mode); const stale = x.t_token();
    x.init_thread(0, x.get_image_base(), x.get_code_start(), x.get_code_end(), x.get_thunk_base(), x.get_thunk_end(), x.get_num_thunks(), x.get_rsrc_rva());
    assert.notEqual(x.t_token(), stale); reject(() => x.t_continue(mode));
    begin({ mode, trap: true }); assert.throws(() => { for (let i = 0; i < 100; i++) x.run(1); }, WebAssembly.RuntimeError);
    assert.equal(x.t_depth(), 1); assert.equal(x.t_inv_depth(), 1);
    const r = begin({ mode: 2, empty: true }); finish(); assert.equal(x.t_token(), r); reject(() => x.t_continue(mode));
  }
  // Interleaved instances, preinstantiated before live guest state; no OS Worker race claim.
  active(); const mainToken = x.t_token(), frame = Buffer.from(new Uint8Array(memory.buffer, REGION.CRT_CALLBACK_CONTEXTS, 4096));
  w.init_thread(1, x.get_image_base(), x.get_code_start(), x.get_code_end(), x.get_thunk_base(), x.get_thunk_end(), x.get_num_thunks(), x.get_rsrc_rva());
  const wr = w.t_token(), wsp = x.guest_alloc(0x10000) + 0xfff0;
  dv.setUint32(x.guest_to_wasm(wsp), 0, true); w.set_esp(wsp); w.t_begin(0, addr(0x1410), addr(0x1414), 0); finish(w);
  assert.equal(w.t_token(), wr); assert.equal(w.get_esp() >>> 0, wsp + 4); assert.equal(x.t_token(), mainToken);
  assert.deepEqual(Buffer.from(new Uint8Array(memory.buffer, REGION.CRT_CALLBACK_CONTEXTS, 4096)), frame); finish();
  // Controlled entry probes: capacity and ID exhaustion must not consume a registry slot or overwrite frames.
  begin(); const direct = () => x.t_begin(0, addr(0x1410), addr(0x1414), 0);
  for (let i = 0; i < 63; i++) direct(); reject(direct);
  for (const mode of [1, 2]) {
    begin();
    assert.equal(x.test_crt_atexit_register(addr(0x2400)), 0);
    assert.equal(x.test_crt_atexit_register(addr(0x2500)), 0);
    for (let i = 0; i < 63; i++) direct();
    reject(() => x.t_begin(mode, 0, 0, 73));
    begin();
    assert.equal(x.test_crt_atexit_register(addr(0x2400)), 0);
    assert.equal(x.test_crt_atexit_register(addr(0x2500)), 0);
    const counter = dv.getBigUint64(REGION.CALLBACK_OWNERSHIP, true);
    dv.setBigUint64(REGION.CALLBACK_OWNERSHIP, (1n << 64n) - 1n, true);
    reject(() => x.t_begin(mode, 0, 0, 73));
    // No identity was allocated by the failed entry; remove only the injected limit.
    dv.setBigUint64(REGION.CALLBACK_OWNERSHIP, counter, true);
  }
  begin(); dv.setBigUint64(REGION.CALLBACK_OWNERSHIP, (1n << 64n) - 2n, true); direct(); reject(direct);
  console.log('CRT init/exit ownership PASS: actual guest nesting/registry/yield/partition and controlled stale/mode/ESP/capacity rejection');
}
main().catch(error => { console.error(error); process.exitCode = 1; });


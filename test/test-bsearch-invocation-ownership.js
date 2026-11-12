#!/usr/bin/env node
'use strict';
// Real x86 imported bsearch and CACA000C continuation, plus explicitly
// controlled rejection/capacity probes. Not complete nonlocal-jump coverage.
const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { BASE: REGION, SIZE } = require('../lib/region-map.generated');
const { pe, BASE } = require('./test-dll-lifecycle-real-pe');
const u32 = v => [v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24];
const addr = rva => BASE + rva;
const push = v => [0x68, ...u32(v)];
const callSearch = (key, base, count, comparator) => [
  ...push(comparator ? addr(comparator) : 0), ...push(4), ...push(count),
  ...push(addr(base)), ...push(addr(key)), 0xff, 0x15, ...u32(addr(0x1900)), 0x83, 0xc4, 20];
const saveEax = rva => [0xa3, ...u32(addr(rva))];
const store = (rva, value) => [0xc7, 5, ...u32(addr(rva)), ...u32(value)];
const loop = [0xb9, ...u32(200), 0x49, 0x75, 0xfd];
const compare = [0x8b, 0x44, 0x24, 4, 0x8b, 0,
  0x8b, 0x54, 0x24, 8, 0x2b, 2, 0xc3];
function image({ key = 1, count = 7, nested = false, trap = false, comparator = 0x2100 } = {}) {
  const inner = [...store(0x1450, 1), ...callSearch(0x1444, 0x141c, 3, 0x2200), ...saveEax(0x1464)];
  const outer = nested ? [...loop, ...callSearch(0x1444, 0x141c, 0, 0x2200),
    ...store(0x1454, 1), ...loop, 0x83, 0x3d, ...u32(addr(0x1450)), 0,
    0x75, inner.length, ...inner, ...loop, ...compare] : [...loop, ...compare];
  const b = pe([[0x2000, [...callSearch(0x1440, 0x1400, count, comparator), ...saveEax(0x1460), 0xc3]],
    [0x2100, trap ? [0x0f, 0x0b] : outer], [0x2200, [...loop, ...compare]],
    [0x1400, [1, 3, 5, 7, 9, 11, 13, 2, 4, 6].flatMap(u32)],
    [0x1440, [...u32(key), ...u32(6)]], [0x1450, Array(24).fill(0)]]);
  const raw = rva => rva - 0x1000 + 0x200;
  b.fill(0, raw(0x1880), raw(0x1880) + 16); b.write('crtdll.dll\0', raw(0x1880));
  b.write('bsearch\0', raw(0x1a02)); b.writeUInt32LE(0, raw(0x1904));
  return b;
}
async function main() {
  const wasm = compileSrcWasm((file, text) => file !== '13-exports.wat' ? text : text + `
    (export "t_continue" (func $bsearch_continue))
    (export "t_begin" (func $handle_bsearch))
    (export "t_token" (func $invocation_current))
    (export "t_clear" (func $clear_cache))
    (func (export "t_depth") (result i32) (global.get $bsearch_depth))
    (func (export "t_inv_depth") (result i32) (global.get $invocation_depth))`,
  { tailCalls: !process.argv.includes('--no-tail-calls') });
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const context = { getMemory: () => memory.buffer, renderer: null,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit() {} };
  const make = async () => {
    const ctx = { ...context }, imports = createHostImports(ctx);
    imports.host.memory = memory; imports.host.log_i32 = () => {};
    const { instance } = await WebAssembly.instantiate(wasm, imports);
    ctx.exports = instance.exports; return instance.exports;
  };
  // Instantiate all modules before loading/running guest state: active data
  // segments are reapplied at instantiation even with imported shared memory.
  const x = await make(), w = await make(), dv = new DataView(memory.buffer);
  const get = rva => dv.getUint32(x.guest_to_wasm(addr(rva)), true);
  let sp;
  const begin = options => {
    const b = image(options); new Uint8Array(memory.buffer, x.get_staging(), b.length).set(b);
    assert.equal(x.load_pe(b.length), addr(0x2000));
    x.t_clear(); // Fixture replaces code at identical addresses in one instance.
    sp = x.guest_alloc(0x10000) + 0xfff0;
    dv.setUint32(x.guest_to_wasm(sp), 0, true);
    x.set_esp(sp); x.set_eip(addr(0x2000)); x.clear_yield(); return x.t_token();
  };
  const finish = (who = x, observe = () => {}) => {
    for (let i = 0; i < 5000 && (who.get_eip() >>> 0) > 2; i++) { who.run(1); observe(); }
    assert((who.get_eip() >>> 0) <= 2, 'guest returns through actual bsearch continuation');
  };
  const root = begin({ nested: true });
  let outer, last, nestedSeen = false, restored = false, noOp = false, repeated = false;
  const children = new Set();
  finish(x, () => {
    const token = x.t_token(), depth = x.t_inv_depth();
    if (depth) { children.add(token); if (last === token) repeated = true; }
    if (depth === 1 && outer === undefined) outer = token;
    if (depth === 2) nestedSeen = true;
    if (nestedSeen && depth === 1 && token === outer) restored = true;
    if (depth === 1 && token === outer && get(0x1454) && !get(0x1450)) noOp = true;
    last = token;
  });
  assert.equal(get(0x1460), addr(0x1400)); assert.equal(get(0x1464), addr(0x1424));
  assert(nestedSeen && restored && noOp && repeated && children.size >= 5);
  assert.equal(x.t_token(), root); assert.equal(x.t_depth(), 0); assert.equal(x.get_esp() >>> 0, sp + 4);
  for (const [key, expected] of [[1, 0x1400], [7, 0x140c], [13, 0x1418], [0, 0], [8, 0], [14, 0]]) {
    const r = begin({ key }); finish(); assert.equal(get(0x1460), expected ? addr(expected) : 0);
    assert.equal(x.t_token(), r); assert.equal(x.t_depth(), 0); assert.equal(x.get_esp() >>> 0, sp + 4);
  }
  for (const options of [{ count: 0 }, { comparator: 0 }, { count: 1 }]) {
    const r = begin(options); finish(); assert.equal(x.t_token(), r);
    assert.equal(get(0x1460), options.count === 1 ? addr(0x1400) : 0);
  }
  const active = () => {
    begin({}); for (let i = 0; i < 50 && !x.t_inv_depth(); i++) x.run(1);
    assert.equal(x.t_inv_depth(), 1);
  };
  const snapshot = () => ({ token: x.t_token(), depth: x.t_depth(), eip: x.get_eip(), esp: x.get_esp(), eax: x.get_eax(),
    ownership: Buffer.from(new Uint8Array(memory.buffer, REGION.CALLBACK_OWNERSHIP, SIZE.CALLBACK_OWNERSHIP)),
    frames: Buffer.from(new Uint8Array(memory.buffer, REGION.BSEARCH_CONTEXTS, SIZE.BSEARCH_CONTEXTS)) });
  const reject = fn => { const before = snapshot(); assert.throws(fn, WebAssembly.RuntimeError); assert.deepEqual(snapshot(), before); };
  active(); reject(() => x.t_continue()); // before comparator RET: wrong ESP
  x.set_esp(dv.getUint32(REGION.BSEARCH_CONTEXTS + 56, true));
  dv.setBigUint64(REGION.BSEARCH_CONTEXTS + 40, root, true);
  reject(() => x.t_continue());
  active(); const stale = x.t_token();
  x.init_thread(0, x.get_image_base(), x.get_code_start(), x.get_code_end(),
    x.get_thunk_base(), x.get_thunk_end(), x.get_num_thunks(), x.get_rsrc_rva());
  assert.notEqual(x.t_token(), stale); assert.equal(x.t_depth(), 1);
  reject(() => x.t_continue());
  begin({ trap: true });
  assert.throws(() => { for (let i = 0; i < 50; i++) x.run(1); }, WebAssembly.RuntimeError);
  assert.equal(x.t_inv_depth(), 1); assert.equal(x.t_depth(), 1);
  const resetRoot = begin({ count: 0 }); finish();
  assert.equal(x.t_token(), resetRoot); assert.equal(x.t_depth(), 1);
  reject(() => x.t_continue());

  // Shared-memory, interleaved actual instances; not concurrent OS Workers.
  active(); const mainToken = x.t_token();
  const mainFrames = Buffer.from(new Uint8Array(memory.buffer, REGION.BSEARCH_CONTEXTS, 4096));
  w.init_thread(1, x.get_image_base(), x.get_code_start(), x.get_code_end(),
    x.get_thunk_base(), x.get_thunk_end(), x.get_num_thunks(), x.get_rsrc_rva());
  const wr = w.t_token(), wsp = x.guest_alloc(0x10000) + 0xfff0;
  dv.setUint32(x.guest_to_wasm(wsp), 0, true); w.set_esp(wsp);
  w.t_begin(addr(0x1444), addr(0x141c), 3, 4, addr(0x2200), 0);
  assert.notEqual(w.t_token(), mainToken); finish(w);
  assert.equal(w.get_eax() >>> 0, addr(0x1424)); assert.equal(w.t_token(), wr);
  assert.equal(w.get_esp() >>> 0, wsp + 4); assert.equal(x.t_token(), mainToken);
  assert.deepEqual(Buffer.from(new Uint8Array(memory.buffer, REGION.BSEARCH_CONTEXTS, 4096)), mainFrames);
  finish(); assert.equal(get(0x1460), addr(0x1400)); assert.equal(w.t_token(), wr);

  // Controlled handler probes supplement the guest path above.
  const direct = () => x.t_begin(addr(0x1440), addr(0x1400), 7, 4, addr(0x2100), 0);
  begin({}); for (let i = 0; i < 63; i++) direct();
  assert.equal(x.t_depth(), 63); reject(direct);
  begin({});
  x.t_begin(addr(0x1440), addr(0x1400), -1, 0, addr(0x2100), 0);
  assert.equal(dv.getUint32(REGION.BSEARCH_CONTEXTS + 28, true), 0x7fffffff, 'unsigned midpoint cannot wrap');
  begin({}); dv.setBigUint64(REGION.CALLBACK_OWNERSHIP, (1n << 64n) - 2n, true);
  direct(); assert.equal(BigInt.asUintN(64, x.t_token()), (1n << 64n) - 1n); reject(direct);
  console.log('bsearch ownership PASS: real guest hit/miss/nested/noop/yield/partition and controlled rejection bounds');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

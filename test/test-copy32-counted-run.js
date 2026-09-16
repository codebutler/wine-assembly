#!/usr/bin/env node
'use strict';

// Diablo's counted dword-copy loop, compared against the ordinary decoder.
// The lowerer is generic in registers/addresses but independently opt-in.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');
const { applyExeCompatibilityPatches } = require('../lib/app-profiles');

const profileCalls = [];
const profileExports = { set_loop_copy32_counted_emit: flag => profileCalls.push(flag) };
applyExeCompatibilityPatches('DIABLO_S.EXE', profileExports, null);
assert.deepStrictEqual(profileCalls, [1], 'Diablo enables the counted-copy fold by default');
applyExeCompatibilityPatches('diablo_s.exe', profileExports, null,
  { disableCopy32Counted: true });
applyExeCompatibilityPatches('notepad.exe', profileExports, null);
assert.deepStrictEqual(profileCalls, [1], 'opt-out and other EXEs do not enable it');

const EXTRA_WAT = `
  (func (export "test_counted_g2w") (param i32) (result i32)
    (call $g2w (local.get 0)))
  (func (export "test_counted_cf") (result i32) (call $get_cf))
  (func (export "test_counted_zf") (result i32) (call $get_zf))
  (func (export "test_counted_sf") (result i32) (call $get_sf))
  (func (export "test_counted_of") (result i32) (call $get_of))
`;

const LOOP = Uint8Array.from([
  0x8b, 0x06,             // mov eax,[esi]
  0x83, 0xc6, 0x04,       // add esi,4
  0x89, 0x07,             // mov [edi],eax
  0x83, 0xc7, 0x04,       // add edi,4
  0x49,                   // dec ecx
  0x75, 0xf3,             // jnz loop
  0xc3,
]);
const ALT_LOOP = Uint8Array.from([
  0x8b, 0x02, 0x83, 0xc2, 0x04, // mov eax,[edx]; add edx,4
  0x89, 0x07, 0x83, 0xc7, 0x04, // mov [edi],eax; add edi,4
  0x49, 0x75, 0xf3, 0xc3,       // dec ecx; jnz loop; ret
]);

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none' });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  let bytes = new Uint8Array(memory.buffer);
  let dv = new DataView(memory.buffer);
  bytes.set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE loads');
  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const imageWa = ga => (ga - imageBase + guestBase) >>> 0;
  const wa = ga => e.test_counted_g2w(ga) >>> 0;
  const codeBase = (imageBase + 0x2400) >>> 0;
  const stack = (imageBase + 0xd00000) >>> 0;
  const arena = e.guest_alloc(0x10000) >>> 0;
  bytes = new Uint8Array(memory.buffer);
  dv = new DataView(memory.buffer);
  let slot = 0;

  function install(code = LOOP) {
    const ga = (codeBase + slot++ * 0x100) >>> 0;
    bytes.set(code, imageWa(ga));
    return ga;
  }
  function state() {
    return {
      eax: e.get_eax() >>> 0, ecx: e.get_ecx() >>> 0, edx: e.get_edx() >>> 0,
      esi: e.get_esi() >>> 0, edi: e.get_edi() >>> 0,
      cf: e.test_counted_cf(), zf: e.test_counted_zf(),
      sf: e.test_counted_sf(), of: e.test_counted_of(),
    };
  }
  function run(code, src, dst, count, slice = 100000, sourceReg = 'esi') {
    e.set_eax(0xa5a5a5a5); e.set_ecx(count);
    e.set_edx(sourceReg === 'edx' ? src : 0x22334455);
    e.set_ebx(0x66778899); e.set_esi(sourceReg === 'esi' ? src : 0x13579bdf); e.set_edi(dst);
    e.set_ebp(0x13579bdf); e.set_esp(stack);
    dv.setUint32(imageWa(stack), 0, true);
    e.set_eip(code);
    for (let i = 0; i < 1000 && (e.get_eip() >>> 0) !== 0; i++) e.run(slice);
    assert.strictEqual(e.get_eip() >>> 0, 0, 'probe returns to sentinel');
    return state();
  }
  function compare(label, count, srcOffset, dstOffset, slice = 100000,
                   sourceReg = 'esi', code = LOOP) {
    const input = Uint8Array.from({ length: Math.max(srcOffset, dstOffset) + count * 4 + 64 },
      (_, i) => (i * 73 + 19) & 0xff);
    const base0 = (arena + 0x1000) >>> 0;
    const base1 = (arena + 0x8000) >>> 0;
    bytes.set(input, wa(base0)); bytes.set(input, wa(base1));
    const src0 = (base0 + srcOffset) >>> 0, dst0 = (base0 + dstOffset) >>> 0;
    const src1 = (base1 + srcOffset) >>> 0, dst1 = (base1 + dstOffset) >>> 0;
    e.set_loop_copy32_counted_emit(0);
    const baseline = run(install(code), src0, dst0, count, slice, sourceReg);
    const expected = bytes.slice(wa(base0), wa(base0) + input.length);
    e.set_loop_copy32_counted_emit(1);
    const folded = run(install(code), src1, dst1, count, slice, sourceReg);
    const actual = bytes.slice(wa(base1), wa(base1) + input.length);
    assert.deepStrictEqual(actual, expected, `${label}: written bytes`);
    const normalize = (s, base) => ({ ...s, [sourceReg]: s[sourceReg] - base,
      edi: s.edi - base });
    assert.deepStrictEqual(normalize(folded, base1), normalize(baseline, base0),
      `${label}: registers and flags`);
    console.log(`  ok ${label}`);
  }

  assert.strictEqual(e.get_loop_copy32_counted_runs(), 0, 'fold defaults off');
  compare('eight disjoint dwords use the bulk row', 8, 0, 0x100);
  assert.strictEqual(e.get_loop_copy32_counted_bulk_bytes(), 32n);
  compare('overlap retains interleaved dword semantics', 8, 0, 4);
  assert.strictEqual(e.get_loop_copy32_counted_bulk_bytes(), 32n,
    'overlap did not take memory.copy');
  const pageCrossOffset = ((0x1000 - (arena & 0xfff)) & 0xfff) + 0xffc;
  compare('page-crossing dword stays mapping-aware', 8, pageCrossOffset, 0x3000);
  assert.strictEqual(e.get_loop_copy32_counted_bulk_bytes(), 32n,
    'page crossing did not take memory.copy');
  compare('short run uses scalar fallback', 3, 0, 0x100);
  compare('small slices resume at the exact guest backedge', 32, 0, 0x100, 8);
  compare('different source register matches without EIP special-casing',
    8, 0, 0x100, 100000, 'edx', ALT_LOOP);
  assert(e.get_loop_copy32_counted_matches() >= 12, 'all variants recognized');
  console.log('PASS counted dword copy lowering');
})().catch(error => { console.error(error); process.exitCode = 1; });

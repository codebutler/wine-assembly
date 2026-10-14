#!/usr/bin/env node
// DC D0+i / DC D8+i are FCOM / FCOMP ST(i): undocumented aliases of the D8
// register forms that every x87 executes the same way. Trespasser's level
// loader compares and pops with DC D8 ("fcomp st(0)") at 0x539172; the
// decoder used to trap there as FPU_UNIMPL.
//
// Run: node test/test-x87-dc-fcom-alias.js

const fs = require('fs');
const path = require('path');
const { createHostImports } = require(path.join(__dirname, '..', 'lib/host-imports'));
const RegionMap = require('../lib/region-map.generated.js');

const ROOT = path.join(__dirname, '..');
const WASM_PATH = process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build', 'wine-assembly.wasm');

let failures = 0;
function check(name, got, want) {
  if (Object.is(got, want)) { console.log(`  ok   ${name}`); return; }
  console.log(`  FAIL ${name}: got ${got}, want ${want}`);
  failures++;
}

async function main() {
  const wasmBytes = fs.readFileSync(WASM_PATH);
  const exeBytes = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { exports: null, getMemory: () => memory.buffer };
  const base = createHostImports(ctx);
  const h = base.host;
  h.memory = memory;
  h.exit = () => {};
  h.log = () => {};
  h.log_i32 = () => {};
  let unimplemented = 0;
  h.crash_unimplemented = () => { unimplemented++; };
  h.wait_multiple = () => 0;
  h.shell_execute = () => 33;

  const { instance } = await WebAssembly.instantiate(wasmBytes, { host: h });
  ctx.exports = instance.exports;
  const e = instance.exports;
  const dv = new DataView(e.memory.buffer);
  const mem = new Uint8Array(e.memory.buffer);
  mem.set(exeBytes, e.get_staging());
  e.load_pe(exeBytes.length);

  const imageBase = e.get_image_base();
  const g2w = addr => RegionMap.g2w(addr, imageBase);
  const le32 = v => [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
  const A = imageBase + 0x8000, B = imageBase + 0x8008;
  const SW = imageBase + 0x8010, REST = imageBase + 0x8018, REST2 = imageBase + 0x8020;

  let codeOffset = 0;
  function run(bytes) {
    const codeAddr = imageBase + 0x1000 + codeOffset;
    codeOffset += 256;
    const wa = g2w(codeAddr);
    for (let i = 0; i < bytes.length; i++) mem[wa + i] = bytes[i];
    const stackTop = imageBase + 0xD00000;
    e.set_esp(stackTop);
    dv.setUint32(g2w(stackTop), 0, true);
    e.set_eip(codeAddr);
    try { e.run(100000); } catch (err) { return false; }
    return true;
  }
  // fld b; fld a; <op>; fnstsw ax; mov [SW], eax; fstp qword [REST]; fstp qword [REST2]
  function compare(op, a, b) {
    dv.setFloat64(g2w(A), a, true);
    dv.setFloat64(g2w(B), b, true);
    for (const p of [SW, REST, REST2]) dv.setFloat64(g2w(p), 12345, true);
    const ok = run([
      0xDB, 0xE3,                     // fninit
      0xDD, 0x05, ...le32(B),         // fld qword [b]
      0xDD, 0x05, ...le32(A),         // fld qword [a]      st0=a st1=b
      ...op,
      0xDF, 0xE0,                     // fnstsw ax
      0xA3, ...le32(SW),              // mov [SW], eax
      0xDD, 0x1D, ...le32(REST),      // fstp qword [REST]
      0xDD, 0x1D, ...le32(REST2),     // fstp qword [REST2]
      0xC3,
    ]);
    return {
      ok,
      cc: dv.getUint32(g2w(SW), true) & 0x4500,   // C3 | C2 | C0
      rest: dv.getFloat64(g2w(REST), true),
    };
  }

  console.log('DC D8+i = FCOMP ST(i):');
  let r = compare([0xDC, 0xD9], 1, 2);
  check('fcomp st(1) runs', r.ok && unimplemented === 0, true);
  check('1 < 2 sets C0', r.cc, 0x0100);
  check('pops once: the next value is b', r.rest, 2);
  r = compare([0xDC, 0xD9], 3, 2);
  check('3 > 2 clears C3/C2/C0', r.cc, 0);
  r = compare([0xDC, 0xD9], 2, 2);
  check('2 == 2 sets C3', r.cc, 0x4000);

  console.log('DC D8 = FCOMP ST(0) (Trespasser):');
  r = compare([0xDC, 0xD8], 5, 7);
  check('runs', r.ok && unimplemented === 0, true);
  check('ST(0) equals itself: C3', r.cc, 0x4000);
  check('pops once: the next value is b', r.rest, 7);

  console.log('DC D0+i = FCOM ST(i):');
  r = compare([0xDC, 0xD1], 1, 2);
  check('runs', r.ok && unimplemented === 0, true);
  check('1 < 2 sets C0', r.cc, 0x0100);
  check('does not pop: ST(0) is still a', r.rest, 1);

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });

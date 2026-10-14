#!/usr/bin/env node
// FSCALE is ldexp: ST(0) * 2^trunc(ST(1)), exact, for any scale.
//
// It used to multiply by one factor 2^n, and 2^n leaves f64 for |n| > 1023
// while the x87's 80-bit exponent does not. The MSVC CRT's transcendental exit
// (`_check_range_exit`) sends every result whose double exponent is zero --
// including an exact 0.0 -- through an underflow fix-up that does
//
//     fld qword [1536.0] ; fxch ; fscale ; ...
//
// and 0 * (2^1536 = +Inf) is NaN. So every CRT math call that legitimately
// returned 0.0 handed the game a NaN; MDK2's camera turned NaN and the world
// stopped drawing (docs/re-notes/mdk2-demo.md, "Black world").
//
// Run: node test/test-x87-fscale.js

const fs = require('fs');
const path = require('path');
const { createHostImports } = require(path.join(__dirname, '..', 'lib/host-imports'));
const RegionMap = require('../lib/region-map.generated.js');

const ROOT = path.join(__dirname, '..');
const WASM_PATH = process.env.WINE_ASSEMBLY_WASM || path.join(ROOT, 'build', 'wine-assembly.wasm');

let failures = 0;
function check(name, got, want) {
  const same = Number.isNaN(want) ? Number.isNaN(got) : Object.is(got, want);
  if (same) { console.log(`  ok   ${name}`); return; }
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
  h.crash_unimplemented = () => {};
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

  const X_ADDR = imageBase + 0x8000;
  const N_ADDR = imageBase + 0x8008;
  const OUT_ADDR = imageBase + 0x8010;

  let codeOffset = 0;
  // Run `bytes` once at a fresh address (so no earlier decoded block is reused).
  function run(bytes) {
    const codeAddr = imageBase + 0x1000 + codeOffset;
    codeOffset += 256;
    const wa = g2w(codeAddr);
    for (let i = 0; i < bytes.length; i++) mem[wa + i] = bytes[i];
    const stackTop = imageBase + 0xD00000;
    e.set_esp(stackTop);
    dv.setUint32(g2w(stackTop), 0, true);
    e.set_eip(codeAddr);
    e.run(100000);
  }

  function fscale(x, n) {
    dv.setFloat64(g2w(X_ADDR), x, true);
    dv.setFloat64(g2w(N_ADDR), n, true);
    dv.setFloat64(g2w(OUT_ADDR), 12345, true);
    run([
      0xDD, 0x05, ...le32(N_ADDR),   // fld qword [n]      st0=n
      0xDD, 0x05, ...le32(X_ADDR),   // fld qword [x]      st0=x st1=n
      0xD9, 0xFD,                    // fscale             st0=x*2^trunc(n)
      0xDD, 0x1D, ...le32(OUT_ADDR), // fstp qword [out]
      0xDD, 0xD8,                    // fstp st(0)         drop n
      0xC3,
    ]);
    return dv.getFloat64(g2w(OUT_ADDR), true);
  }

  console.log('fscale:');
  check('1.5 * 2^10', fscale(1.5, 10), 1536);
  check('2.75 * 2^trunc(2.9)', fscale(2.75, 2.9), 11);
  check('8 * 2^trunc(-2.9)', fscale(8, -2.9), 2);
  // The MSVC underflow fix-up's own operands.
  check('0 * 2^1536 is 0, not NaN', fscale(0, 1536), 0);
  check('-0 * 2^1536 keeps the sign', fscale(-0, 1536), -0);
  check('0 * 2^-1536', fscale(0, -1536), 0);
  // A nonzero result whose factor alone leaves f64.
  check('denormal 2^-1070 * 2^1536', fscale(2 ** -1070, 1536), 2 ** 466);
  check('3 * 2^-1080', fscale(3, -1080), 3 * 2 ** -1022 * 2 ** -58);
  check('2^-1000 * 2^1500', fscale(2 ** -1000, 1500), 2 ** 500);
  check('1 * 2^5000 overflows to +Inf', fscale(1, 5000), Infinity);
  check('-1 * 2^5000 overflows to -Inf', fscale(-1, 5000), -Infinity);
  check('1 * 2^-5000 underflows to 0', fscale(1, -5000), 0);
  check('Inf * 2^3', fscale(Infinity, 3), Infinity);
  // x87 invalid operations.
  check('0 * 2^+Inf is invalid (NaN)', fscale(0, Infinity), NaN);
  check('Inf * 2^-Inf is invalid (NaN)', fscale(Infinity, -Infinity), NaN);
  check('0 * 2^-Inf is 0', fscale(0, -Infinity), 0);
  check('NaN scale propagates', fscale(1, NaN), NaN);

  // The CRT sequence itself: scale a zero up by 1536, test it against
  // DBL_MIN, scale back by 2^-1536. Real hardware leaves 0.0.
  const C1536 = imageBase + 0x8020, CDOWN = imageBase + 0x8028;
  dv.setFloat64(g2w(C1536), 1536, true);
  dv.setFloat64(g2w(CDOWN), 2 ** -1022 * 2 ** -514, true);
  dv.setFloat64(g2w(X_ADDR), 0, true);
  dv.setFloat64(g2w(OUT_ADDR), 12345, true);
  run([
    0xDD, 0x05, ...le32(X_ADDR),   // fld qword [x]        the function's 0.0 result
    0xDD, 0x05, ...le32(C1536),    // fld qword [1536.0]
    0xD9, 0xC9,                    // fxch st(1)
    0xD9, 0xFD,                    // fscale
    0xDD, 0xD9,                    // fstp st(1)
    0xDC, 0x0D, ...le32(CDOWN),    // fmul qword [2^-1536]
    0xDD, 0x1D, ...le32(OUT_ADDR), // fstp qword [out]
    0xC3,
  ]);
  check('MSVC underflow fix-up on 0.0 returns 0.0', dv.getFloat64(g2w(OUT_ADDR), true), 0);

  console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });

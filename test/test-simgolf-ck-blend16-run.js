#!/usr/bin/env node
'use strict';

// The alpha-blended RGB565 sprite row fold (handler 456, $th_ck_blend16_run).
//
// The 210 bytes below are copied verbatim out of SimGolf's jgl.dll at
// 0x100153a5 -- the loop tools/hot-loop-census.js measured at 28-54% of ALL
// block entries in every one of four independent browser windows, which makes
// it the largest single item in the app.
//
// The test runs the row twice over identical inputs, once folded and once
// through the plain interpreter, and requires the two to agree pixel for
// pixel and register for register. That matters more here than it did for
// handler 455: this fold does not decline its expensive arm, it REPLACES ~45
// instructions of channel-wise fixed-point arithmetic with closed-form WAT,
// so there is no interpreter fallback left to be right when the WAT is wrong.
// The interpreter is the oracle -- no hand-computed expectations, because a
// wrong fold that agrees with a wrong expectation passes.
//
// Two of the guest's own quirks are asserted separately at the bottom, since
// they are the ones a "tidied" reimplementation would silently correct: red
// takes (c >> 7) & 0xF8 rather than the (c >> 8) & 0xF8 the RGB565 layout
// would suggest, and a blue result can reach 0x3E and carry into green's low
// bit. Both are what the x86 does, so both are what the fold must do.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const EXTRA_WAT = `
  (func (export "test_ckb_zf") (result i32) (call $get_zf))
  (func (export "test_ckb_sf") (result i32) (call $get_sf))
`;

// jgl.dll+0x100153a5, exactly as
// `node tools/pe-fnv.js <jgl.dll> 0x100153a5 210 --bytes` prints it.
// Position independent: every branch is relative and lands inside these 210
// bytes, so it may be placed at any address.
const LOOP = Uint8Array.from([
  0x80, 0x3e, 0xff, 0x0f, 0x83, 0xbd, 0x00, 0x00, 0x00, 0x80, 0x3b, 0xff,
  0x0f, 0x83, 0xb4, 0x00, 0x00, 0x00, 0x33, 0xc0, 0x33, 0xed, 0x8a, 0x03,
  0x3c, 0x00, 0x0f, 0x84, 0x9d, 0x00, 0x00, 0x00, 0x8a, 0x06, 0x66, 0x8b,
  0x2c, 0x41, 0x66, 0x8b, 0x07, 0x51, 0x52, 0x66, 0x8b, 0xd5, 0xc1, 0xe2,
  0x10, 0x66, 0x8b, 0xc8, 0xc1, 0xe1, 0x10, 0x8a, 0x0b, 0x66, 0xc1, 0xed,
  0x07, 0x66, 0x81, 0xe5, 0xf8, 0x00, 0x66, 0xc1, 0xe8, 0x07, 0x24, 0xf8,
  0xf6, 0xe1, 0x66, 0xc1, 0xe8, 0x08, 0x66, 0x03, 0xc5, 0x66, 0xc1, 0xe8,
  0x03, 0x66, 0xc1, 0xe0, 0x0a, 0x66, 0x0b, 0xd0, 0x8b, 0xc1, 0xc1, 0xe8,
  0x10, 0x8b, 0xea, 0xc1, 0xed, 0x10, 0x66, 0xc1, 0xed, 0x02, 0x66, 0x81,
  0xe5, 0xf8, 0x00, 0x66, 0xc1, 0xe8, 0x02, 0x66, 0x25, 0xf8, 0x00, 0xf6,
  0xe1, 0x66, 0xc1, 0xe8, 0x08, 0x66, 0x03, 0xc5, 0x66, 0xc1, 0xe8, 0x03,
  0x66, 0xc1, 0xe0, 0x05, 0x66, 0x0b, 0xd0, 0x8b, 0xc1, 0xc1, 0xe8, 0x10,
  0x8b, 0xea, 0xc1, 0xed, 0x10, 0x66, 0xc1, 0xe5, 0x03, 0x66, 0x81, 0xe5,
  0xf8, 0x00, 0x66, 0xc1, 0xe0, 0x03, 0x66, 0x25, 0xf8, 0x00, 0xf6, 0xe1,
  0x66, 0xc1, 0xe8, 0x08, 0x66, 0x03, 0xc5, 0x66, 0xc1, 0xe8, 0x03, 0x66,
  0x0b, 0xd0, 0x66, 0x89, 0x17, 0x5a, 0x59, 0xeb, 0x09, 0x8a, 0x06, 0x66,
  0x8b, 0x04, 0x41, 0x66, 0x89, 0x07, 0x46, 0x43, 0x83, 0xc7, 0x02, 0x4a,
  0x0f, 0x85, 0x2e, 0xff, 0xff, 0xff,
]);

// Every arm, repeatedly, with the sentinels interleaved so a fold that
// resynchronised its cursors wrongly would drift into the wrong arm.
//   0xff source  -> transparent, destination untouched
//   0xff alpha   -> transparent by the SECOND cursor, which is the arm a
//                   one-cursor fold would get wrong
//   alpha 0      -> opaque LUT16 store
//   otherwise    -> the blend
const SRC   = [0x00, 0xff, 0x7f, 0x10, 0x01, 0x80, 0xfe, 0x40, 0x33, 0xff];
const ALPHA = [0x00, 0x20, 0xff, 0x01, 0x80, 0xfe, 0x7f, 0x00, 0xc0, 0x11];
const DST0  = [0x1111, 0x2222, 0x3333, 0xffff, 0x0000, 0x8410, 0x07e0,
               0xf800, 0x001f, 0x5555];

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none' });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  const bytes = new Uint8Array(memory.buffer);
  bytes.set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE loads');

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const wa = ga => (ga - imageBase + guestBase) >>> 0;

  const data = e.guest_alloc(0x4000) >>> 0;
  const src = data;
  const alpha = data + 0x100;
  const dst = data + 0x200;
  const lut = data + 0x400;

  const setup = () => {
    const m8 = new Uint8Array(memory.buffer);
    const m16 = new Uint16Array(memory.buffer);
    m8.set(SRC, wa(src));
    m8.set(ALPHA, wa(alpha));
    for (let i = 0; i < DST0.length; i++) m16[(wa(dst) >> 1) + i] = DST0[i];
    // A palette with bits in all three channels, so a channel the fold shifts
    // by the wrong amount cannot come out looking plausible.
    for (let i = 0; i < 256; i++) {
      m16[(wa(lut) >> 1) + i] = ((i << 8) ^ (i << 3) ^ (i >> 2)) & 0xffff;
    }
  };
  const readDst = () =>
    Array.from(new Uint16Array(memory.buffer, wa(dst), SRC.length));

  const runRow = (codeVa) => {
    setup();
    new Uint8Array(memory.buffer).set(LOOP, wa(codeVa));
    e.set_eip(codeVa);
    e.set_esi(src);
    e.set_ebx(alpha);
    e.set_edi(dst);
    e.set_ecx(lut);
    e.set_edx(SRC.length);
    e.set_eax(0xdeadbeef);
    e.set_ebp(0xcafebabe);
    // The fold bills every block it swallowed against $block_budget, so drive
    // until EIP leaves the loop rather than assuming one batch is enough.
    for (let i = 0; i < 1024 && (e.get_eip() >>> 0) !== ((codeVa + LOOP.length) >>> 0); i++) {
      e.run(1);
    }
    return {
      dst: readDst(),
      esi: e.get_esi() >>> 0, ebx: e.get_ebx() >>> 0, edi: e.get_edi() >>> 0,
      ecx: e.get_ecx() >>> 0, edx: e.get_edx() >>> 0,
      eax: e.get_eax() >>> 0, ebp: e.get_ebp() >>> 0,
      eip: e.get_eip() >>> 0, zf: e.test_ckb_zf(), sf: e.test_ckb_sf(),
    };
  };

  // ---- folded ----------------------------------------------------------
  const code = (imageBase + 0x2800) >>> 0;
  assert.strictEqual(e.get_ck_blend16(), 1, 'the fold is on by default');
  const m0 = e.get_ck_blend16_matches();
  const r0 = e.get_ck_blend16_runs();
  const p0 = e.get_ck_blend16_px();
  const folded = runRow(code);

  assert.strictEqual(e.get_ck_blend16_matches(), m0 + 1, 'the body hash matched');
  assert.strictEqual(e.get_ck_blend16_runs(), r0 + 1,
    'the whole row ran in one go -- this fold declines no arm');
  assert.strictEqual(e.get_ck_blend16_px(), p0 + BigInt(SRC.length),
    'every pixel of the row was accounted for');
  assert.strictEqual(folded.eip, (code + LOOP.length) >>> 0,
    'execution continues after the row');
  assert.strictEqual(folded.esi, (src + SRC.length) >>> 0, 'ESI walked the row');
  assert.strictEqual(folded.ebx, (alpha + SRC.length) >>> 0,
    'EBX walked the alpha row -- the second cursor moves too');
  assert.strictEqual(folded.edi, (dst + 2 * SRC.length) >>> 0, 'EDI walked the row');
  assert.strictEqual(folded.ecx, lut,
    'ECX survives: the blend arm pushes and pops it');
  assert.strictEqual(folded.edx, 0, 'EDX counted down to zero');
  assert.strictEqual(folded.zf, 1, 'the final DEC sets ZF');
  assert.strictEqual(folded.sf, 0, 'the final DEC clears SF');

  // ---- the same row, unfolded ------------------------------------------
  // A different address, because the folded block is already cached at the
  // first one and the switch is decode-time.
  e.set_ck_blend16(0);
  const plain = runRow((imageBase + 0x2c00) >>> 0);
  assert.strictEqual(e.get_ck_blend16_matches(), m0 + 1, 'the switch really is off');
  e.set_ck_blend16(1);

  assert.deepStrictEqual(folded.dst, plain.dst,
    'folded pixels match the interpreter, pixel for pixel');
  for (const r of ['eax', 'ebx', 'ecx', 'edx', 'esi', 'edi', 'ebp']) {
    assert.strictEqual(folded[r], plain[r],
      `${r.toUpperCase()} matches the interpreter ` +
      `(fold 0x${folded[r].toString(16)}, interp 0x${plain[r].toString(16)})`);
  }
  assert.strictEqual(folded.zf, plain.zf, 'ZF matches the interpreter');
  assert.strictEqual(folded.sf, plain.sf, 'SF matches the interpreter');

  // ---- what the oracle cannot catch ------------------------------------
  // Both arms of the comparison run the same code in the unfolded case, so
  // these pin down behaviour that is only interesting against the real jgl.
  assert.strictEqual(folded.dst[1], DST0[1],
    'a 0xFF source byte left the destination alone');
  assert.strictEqual(folded.dst[9], DST0[9], 'and so did the trailing one');
  assert.strictEqual(folded.dst[2], DST0[2],
    'a 0xFF ALPHA byte is transparent too -- the second cursor keys as well');

  const lut16 = i => (((i << 8) ^ (i << 3) ^ (i >> 2)) & 0xffff);
  assert.strictEqual(folded.dst[0], lut16(SRC[0]),
    'alpha 0 is a plain LUT16 store, not a blend against a zero');
  assert.strictEqual(folded.dst[7], lut16(SRC[7]), 'and again later in the row');

  // The guest's own arithmetic, reproduced here from the disassembly rather
  // than from the WAT, for the one pixel where the quirks are visible.
  const chan = (sc, dc, a) => ((((dc * a) >>> 8) + sc) & 0xffff) >>> 3;
  const blend = (s, d, a) =>
    ((chan((s >>> 7) & 0xf8, (d >>> 7) & 0xf8, a) << 10) |
     (chan((s >>> 2) & 0xf8, (d >>> 2) & 0xf8, a) << 5) |
      chan((s << 3) & 0xf8, (d << 3) & 0xf8, a)) & 0xffff;
  for (let i = 0; i < SRC.length; i++) {
    if (SRC[i] === 0xff || ALPHA[i] === 0xff || ALPHA[i] === 0) continue;
    assert.strictEqual(folded.dst[i], blend(lut16(SRC[i]), DST0[i], ALPHA[i]),
      `pixel ${i} matches jgl's own channel arithmetic`);
  }

  // Red really is (c >> 7) & 0xF8 and not (c >> 8) & 0xF8: if it were the
  // latter, this pixel would come out different. Guard the claim so a future
  // "fix" to the shift has to argue with a failing test.
  {
    let discriminated = 0;
    for (let i = 0; i < SRC.length; i++) {
      if (SRC[i] === 0xff || ALPHA[i] === 0xff || ALPHA[i] === 0) continue;
      const s = lut16(SRC[i]), d = DST0[i], a = ALPHA[i];
      const wrongRed = chan((s >>> 8) & 0xf8, (d >>> 8) & 0xf8, a);
      const realRed = chan((s >>> 7) & 0xf8, (d >>> 7) & 0xf8, a);
      if (realRed === wrongRed) continue;     // this pixel cannot tell them apart
      discriminated++;
      assert.strictEqual((folded.dst[i] >>> 10) & 0x3f, realRed,
        `pixel ${i}: red uses jgl's >>7, not the >>8 the RGB565 layout suggests`);
    }
    assert(discriminated > 0,
      'fixture must exercise the odd red shift (adjust SRC/DST0 if this trips)');
  }

  // ---- near miss --------------------------------------------------------
  // The match is byte-exact on purpose. One changed interior byte has to fall
  // back to the ordinary decoder rather than fold something it did not read.
  const nearCode = (imageBase + 0x3000) >>> 0;
  const near = Uint8Array.from(LOOP);
  near[0x59] = 0x06;         // shr bp,0x7 -> shr bp,0x6: a different blend
  setup();
  new Uint8Array(memory.buffer).set(near, wa(nearCode));
  e.set_eip(nearCode);
  e.set_esi(src); e.set_ebx(alpha); e.set_edi(dst); e.set_ecx(lut);
  e.set_edx(SRC.length); e.set_eax(0); e.set_ebp(0);
  const mNear = e.get_ck_blend16_matches();
  e.run(1);
  assert.strictEqual(e.get_ck_blend16_matches(), mNear,
    'a single changed byte in the body remains ordinary x86');

  console.log('PASS SimGolf alpha-blended RGB565 sprite row superinstruction');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

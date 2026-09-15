#!/usr/bin/env node
'use strict';

// The colour-keyed LUT16 sprite row fold (handler 455, $th_ck_lut16_run).
//
// The 48 bytes below are copied verbatim out of SimGolf's jgl.dll at
// 0x10017b6f -- the loop tools/browser-handler-hist.js puts at the top of the
// browser profile. The test runs them twice over identical inputs, once with
// the fold on and once with it off, and requires the two to agree pixel for
// pixel and register for register: the interpreter is the oracle, not a
// hand-computed expectation, so a wrong fold cannot pass by agreeing with a
// wrong expectation.
//
// The interesting case is the shadow arm. The fold runs the transparent and
// source arms and DECLINES 0xF8..0xFE, jumping into the shadow arm with the
// cursors on that pixel; the row therefore has to resume in the fold
// afterwards. The fixture puts a shadow byte in the middle for exactly that,
// and asserts runs==2 to prove the row really was picked back up.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const EXTRA_WAT = `
  (func (export "test_ck_zf") (result i32) (call $get_zf))
  (func (export "test_ck_sf") (result i32) (call $get_sf))
`;

// jgl.dll+0x10017b6f, exactly as `node tools/dump_va.js jgl.dll 0x10017b6f 48`
// prints it. Position independent: every branch here is a rel8 within these
// 48 bytes, so it may be placed at any address.
const LOOP = Uint8Array.from([
  0x80, 0x3e, 0xff,             // head:   cmp byte [esi], 0xff
  0x73, 0x24,                   //         jnb  advance
  0x33, 0xc0,                   //         xor  eax, eax
  0x80, 0x3e, 0xf8,             //         cmp  byte [esi], 0xf8
  0x73, 0x0b,                   //         jnb  shadow
  0x8a, 0x06,                   //         mov  al, [esi]
  0x66, 0x8b, 0x04, 0x41,       //         mov  ax, [ecx+eax*2]
  0x66, 0x89, 0x07,             //         mov  [edi], ax
  0xeb, 0x12,                   //         jmp  advance
  0x8a, 0x06,                   // shadow: mov  al, [esi]
  0x2c, 0xf8,                   //         sub  al, 0xf8
  0xc1, 0xe0, 0x0f,             //         shl  eax, 0xf
  0x66, 0x0b, 0x07,             //         or   ax, [edi]
  0x66, 0x8b, 0x44, 0x45, 0x00, //         mov  ax, [ebp+eax*2+0x0]
  0x66, 0x89, 0x07,             //         mov  [edi], ax
  0x46,                         // advance:inc  esi
  0x83, 0xc7, 0x02,             //         add  edi, 2
  0x4a,                         //         dec  edx
  0x75, 0xd0,                   //         jnz  head
]);

// One transparent pixel, two ordinary ones, a shadow pixel in the middle so
// the fold has to bail and resume, then another pair.
const SRC = [0x00, 0xff, 0x7f, 0xf8, 0x01, 0xff];
// Seven entries, not six: the four-block fixture below uses the first six and
// the three-block one uses all seven. Every value is distinct so a transparent
// pixel that was wrongly written cannot coincide with what was already there.
const DST0 = [0x1111, 0x2222, 0xa07f, 0x0003, 0x5555, 0x6666, 0x7777];

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none' });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  let bytes = new Uint8Array(memory.buffer);
  bytes.set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE loads');

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const wa = ga => (ga - imageBase + guestBase) >>> 0;

  const data = e.guest_alloc(0x4000) >>> 0;
  const src = data;
  const dst = data + 0x100;
  const lut = data + 0x400;
  const shadow = data + 0x800;

  // Neither table is reachable by the fold's own arithmetic unless the match
  // read the right base register out of the SIB byte, so a swapped ECX/EBP
  // would show up as garbage rather than as a plausible-looking picture.
  const setup = (srcBytes = SRC) => {
    const m8 = new Uint8Array(memory.buffer);
    const m16 = new Uint16Array(memory.buffer);
    m8.set(srcBytes, wa(src));
    for (let i = 0; i < DST0.length; i++) m16[(wa(dst) >> 1) + i] = DST0[i];
    for (let i = 0; i < 256; i++) m16[(wa(lut) >> 1) + i] = (0xa000 | i) & 0xffff;
    for (let i = 0; i < 256; i++) m16[(wa(shadow) >> 1) + i] = (0xbe00 | i) & 0xffff;
  };
  const readDst = (n = SRC.length) =>
    Array.from(new Uint16Array(memory.buffer, wa(dst), n));

  const runRow = (codeVa, loop = LOOP, srcBytes = SRC) => {
    setup(srcBytes);
    new Uint8Array(memory.buffer).set(loop, wa(codeVa));
    e.set_eip(codeVa);
    e.set_esi(src);
    e.set_edi(dst);
    e.set_ecx(lut);
    e.set_ebp(shadow);
    e.set_edx(srcBytes.length);
    e.set_eax(0xdeadbeef);
    // The fold bills every block it swallowed against $block_budget, so a row
    // that bails into the shadow arm can legitimately span more than one
    // batch. Drive until EIP leaves the loop rather than assuming one.
    for (let i = 0; i < 512 && (e.get_eip() >>> 0) !== ((codeVa + loop.length) >>> 0); i++) {
      e.run(1);
    }
    return {
      dst: readDst(srcBytes.length),
      esi: e.get_esi() >>> 0, edi: e.get_edi() >>> 0,
      edx: e.get_edx() >>> 0, eax: e.get_eax() >>> 0,
      eip: e.get_eip() >>> 0, zf: e.test_ck_zf(), sf: e.test_ck_sf(),
    };
  };

  // ---- folded ----------------------------------------------------------
  const code = (imageBase + 0x2800) >>> 0;
  assert.strictEqual(e.get_ck_lut16(), 1, 'the fold is on by default');
  const m0 = e.get_ck_lut16_matches(), r0 = e.get_ck_lut16_runs();
  const p0 = e.get_ck_lut16_px();
  const folded = runRow(code);

  assert.strictEqual(e.get_ck_lut16_matches(), m0 + 1, 'the jgl grammar matched');
  assert.strictEqual(e.get_ck_lut16_runs(), r0 + 2,
    'the row resumed in the fold after the shadow pixel');
  assert.strictEqual(e.get_ck_lut16_px(), p0 + 5n,
    'five of the six pixels were blitted by the fold, the shadow one was not');
  assert.strictEqual(folded.eip, (code + LOOP.length) >>> 0,
    'execution continues after the row');
  assert.strictEqual(folded.esi, (src + SRC.length) >>> 0, 'ESI walked the row');
  assert.strictEqual(folded.edi, (dst + 2 * SRC.length) >>> 0, 'EDI walked the row');
  assert.strictEqual(folded.edx, 0, 'EDX counted down to zero');
  assert.strictEqual(folded.zf, 1, 'the final DEC sets ZF');
  assert.strictEqual(folded.sf, 0, 'the final DEC clears SF');

  // ---- the same row, unfolded ------------------------------------------
  // A different address, because the folded block is already cached at the
  // first one and the switch is decode-time.
  e.set_ck_lut16(0);
  const plain = runRow((imageBase + 0x2900) >>> 0);
  assert.strictEqual(e.get_ck_lut16_matches(), m0 + 1, 'the switch really is off');
  e.set_ck_lut16(1);

  assert.deepStrictEqual(folded.dst, plain.dst,
    'folded pixels match the interpreter, pixel for pixel');
  assert.strictEqual(folded.eax, plain.eax, 'EAX matches the interpreter');
  assert.strictEqual(folded.esi, plain.esi, 'ESI matches the interpreter');
  assert.strictEqual(folded.edi, plain.edi, 'EDI matches the interpreter');
  assert.strictEqual(folded.edx, plain.edx, 'EDX matches the interpreter');
  assert.strictEqual(folded.zf, plain.zf, 'ZF matches the interpreter');

  // Independently of the oracle: the transparent pixels must be untouched and
  // the shadow pixel must have gone through EBP's table, not ECX's.
  assert.strictEqual(folded.dst[1], DST0[1], '0xFF left the destination alone');
  assert.strictEqual(folded.dst[5], DST0[5], 'the trailing 0xFF did too');
  assert.strictEqual(folded.dst[0], 0xa000, 'source pixel came from the LUT');
  assert.strictEqual(folded.dst[2], 0xa07f, 'and so did the 0x7f one');
  assert.strictEqual(folded.dst[3], 0xbe03, 'the shadow pixel used EBP\'s table');

  // ---- near miss --------------------------------------------------------
  // The grammar is exact on purpose; one changed interior byte has to fall
  // back to the ordinary decoder rather than fold something it did not read.
  //
  // This used to flip the sentinel to 0xFE and demand a decline. That is no
  // longer a near miss and must not be reinstated: 0xFE is the key FOUR of
  // the eight real sites in jgl.dll actually use, and requiring 0xFF was a
  // bug that rejected every one of them. The key is read now, so the near
  // miss has to be a byte the grammar still genuinely depends on -- here the
  // SIB of `mov ax,[ecx+eax*2]`, retuned to scale 4. A LUT indexed by the
  // wrong stride would read plausible-looking garbage, which is exactly the
  // failure a fold must never produce silently.
  const nearCode = (imageBase + 0x2a00) >>> 0;
  const near = Uint8Array.from(LOOP);
  assert.strictEqual(near[17], 0x41, 'the SIB is where this test thinks it is');
  near[17] = 0x81;           // mov ax, [ecx+eax*4] -- wrong element stride
  setup();
  new Uint8Array(memory.buffer).set(near, wa(nearCode));
  e.set_eip(nearCode);
  e.set_esi(src); e.set_edi(dst); e.set_ecx(lut); e.set_ebp(shadow);
  e.set_edx(SRC.length); e.set_eax(0);
  const mNear = e.get_ck_lut16_matches();
  e.run(1);
  assert.strictEqual(e.get_ck_lut16_matches(), mNear,
    'a wrong LUT stride remains ordinary x86');

  // ---- the three-block form --------------------------------------------
  // The same blit written WITHOUT a shadow arm: cmp/jnb, the source arm
  // falling straight through, advance. 23 bytes verbatim from jgl.dll at
  // 0x1000e7f9, the region tools/hot-loop-census.js scored at a 43.5% floor
  // and 50.5% mean of all block entries across three browser windows -- the
  // only region in that profile that was hot in every window.
  //
  // Eight sites in that DLL share these bytes (four keyed 0xFE, four 0xFF)
  // and ALL of them were declined before, because the grammar demanded a
  // shadow arm they do not have. Both branches of that `if` are exercised
  // here: the fixture above has an arm, this one does not.
  const LOOP3 = Uint8Array.from([
    0x80, 0x3e, 0xfe,             // head:   cmp byte [esi], 0xfe
    0x73, 0x0b,                   //         jnb  advance
    0x33, 0xc0,                   //         xor  eax, eax
    0x8a, 0x06,                   //         mov  al, [esi]
    0x66, 0x8b, 0x04, 0x41,       //         mov  ax, [ecx+eax*2]
    0x66, 0x89, 0x07,             //         mov  [edi], ax   (falls through)
    0x46,                         // advance:inc  esi
    0x83, 0xc7, 0x02,             //         add  edi, 2
    0x4a,                         //         dec  edx
    0x75, 0xe9,                   //         jnz  head
  ]);
  // 0xFE and 0xFF are BOTH transparent under this key -- that is the whole
  // point of the key being 0xFE rather than 0xFF, and a fold that treated
  // 0xFE as an index would write a colour where the sprite has a hole.
  //
  // 0xFA earns its place: it sits in 0xF8..0xFD, the window that IS the
  // blend range in the four-block form and is an ORDINARY INDEX here. An
  // executor that kept the old hardcoded 0xF8 would bail this pixel into a
  // shadow arm that does not exist ($shadow_eip is 0 for this form), so this
  // byte is what separates "blend_lo came from the descriptor" from "the
  // three-block form happens to work on sprites without high indexes".
  const SRC3 = [0x00, 0xfe, 0x7f, 0xff, 0xfa, 0x01, 0xfe];

  const m3 = e.get_ck_lut16_matches();
  const r3 = e.get_ck_lut16_runs();
  const p3 = e.get_ck_lut16_px();
  const folded3 = runRow((imageBase + 0x2b00) >>> 0, LOOP3, SRC3);
  assert.strictEqual(e.get_ck_lut16_matches(), m3 + 1,
    'the three-block form matches the grammar');
  assert.strictEqual(e.get_ck_lut16_runs(), r3 + 1,
    'with no shadow arm there is nothing to bail into, so the row is ONE run');
  assert.strictEqual(e.get_ck_lut16_px(), p3 + 7n,
    'all seven pixels were handled inside the fold, transparent ones included');

  // With no shadow arm the source arm's fall-through IS the join. Nudge the
  // transparent arm's jnb one byte further so the two arms rejoin at
  // different places, and the loop must decline.
  //
  // Measured, so nobody re-derives it: this case is caught by the ADVANCE
  // BLOCK parse, not by the grammar's `pc == adv` fall-through check --
  // deleting that check leaves this assertion passing, because a skewed
  // `adv` lands mid-instruction and fails `inc S` immediately. The check is
  // kept as the explicit statement of the invariant, but do not read this
  // near miss as its coverage; isolating it would need a contrived loop
  // carrying a second, valid advance block.
  const skewCode = (imageBase + 0x2d00) >>> 0;
  const skew = Uint8Array.from(LOOP3);
  assert.strictEqual(skew[4], 0x0b, 'the jnb rel8 is where this test thinks');
  skew[4] = 0x0c;            // jnb lands mid-`add edi,2`, not on advance
  setup(SRC3);
  new Uint8Array(memory.buffer).set(skew, wa(skewCode));
  e.set_eip(skewCode);
  e.set_esi(src); e.set_edi(dst); e.set_ecx(lut); e.set_ebp(shadow);
  e.set_edx(SRC3.length); e.set_eax(0);
  const mSkew = e.get_ck_lut16_matches();
  e.run(1);
  assert.strictEqual(e.get_ck_lut16_matches(), mSkew,
    'arms that rejoin at different addresses remain ordinary x86');

  e.set_ck_lut16(0);
  const plain3 = runRow((imageBase + 0x2c00) >>> 0, LOOP3, SRC3);
  e.set_ck_lut16(1);
  assert.strictEqual(e.get_ck_lut16_matches(), m3 + 1,
    'the switch really is off for the three-block form too');

  assert.deepStrictEqual(folded3.dst, plain3.dst,
    'three-block folded pixels match the interpreter, pixel for pixel');
  assert.strictEqual(folded3.esi, plain3.esi, 'ESI matches the interpreter');
  assert.strictEqual(folded3.edi, plain3.edi, 'EDI matches the interpreter');
  assert.strictEqual(folded3.edx, plain3.edx, 'EDX matches the interpreter');
  assert.strictEqual(folded3.eax, plain3.eax, 'EAX matches the interpreter');
  assert.strictEqual(folded3.zf, plain3.zf, 'ZF matches the interpreter');

  // Independently of the oracle: both high bytes are holes, and the three
  // ordinary pixels came through ECX's table.
  assert.strictEqual(folded3.dst[1], DST0[1], '0xFE is transparent under this key');
  assert.strictEqual(folded3.dst[3], DST0[3], 'and so is 0xFF');
  assert.strictEqual(folded3.dst[6], DST0[6], 'including the trailing one');
  assert.strictEqual(folded3.dst[0], 0xa000, 'source pixel came from the LUT');
  assert.strictEqual(folded3.dst[2], 0xa07f, 'and so did the 0x7f one');
  assert.strictEqual(folded3.dst[5], 0xa001, 'and the 0x01 one');
  assert.strictEqual(folded3.dst[4], 0xa0fa,
    '0xFA is an ordinary index here, NOT a blend -- blend_lo came from the '
    + 'descriptor and not from the old hardcoded 0xF8');

  console.log('PASS SimGolf colour-keyed LUT16 sprite row superinstruction');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

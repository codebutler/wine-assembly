#!/usr/bin/env node
'use strict';

// The dest-indexed keyed sprite row fold (handler 457, $th_ck_shadow16_run).
//
// The 39 bytes below are copied verbatim out of SimGolf's jgl.dll at
// 0x10016eee -- the loop tools/hot-loop-census.js puts at 21.9% / 19.8% /
// 26.5% of all block entries across three independent browser windows. The
// test runs them twice over identical inputs, once with the fold on and once
// with it off, and requires the two to agree pixel for pixel and register for
// register: the interpreter is the oracle, not a hand-computed expectation,
// so a wrong fold cannot pass by agreeing with a wrong expectation.
//
// Two things this fixture exists to pin down, beyond "the pixels match":
//
//   THE ARM SPLIT IS AN EQUALITY, NOT A RANGE. Handler 455's loop sends
//   0xF8..0xFE to its shadow arm; this one sends only 0xF8, and 0xF9..0xFE go
//   to the ordinary palette arm. The row below carries a 0xF9 for exactly
//   that, so a fold that copied 455's `>= 0xF8` test fails here rather than
//   in a screenshot.
//
//   PARTIAL-REGISTER WRITES MERGE. `mov W16,[D]` writes half a register and
//   `mov T8,[S]` writes a quarter of one, and the SIB index that follows each
//   reads the whole thing -- with no `xor` anywhere in the loop to clear the
//   rest. EAX enters at 0x100 and EBX at 0x10000 here, so an implementation
//   that zero-extended instead of merging indexes a DIFFERENT table entry,
//   and the assertions below name both the entry it must read and the one it
//   must not. Both stay inside the allocated tables, so the discriminator is
//   a wrong value rather than a wild address.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const EXTRA_WAT = `
  (func (export "test_ck_zf") (result i32) (call $get_zf))
  (func (export "test_ck_sf") (result i32) (call $get_sf))
`;

// jgl.dll+0x10016eee, exactly as `node tools/dump_va.js jgl.dll 0x10016eee 39`
// prints it. Position independent: all four branches are rel8 within these 39
// bytes, so it may be placed at any address.
const LOOP = Uint8Array.from([
  0x80, 0x3e, 0xff,             // head:   cmp  byte [esi], 0xff
  0x73, 0x1b,                   //         jnb  advance
  0x80, 0x3e, 0xf8,             //         cmp  byte [esi], 0xf8
  0x75, 0x0d,                   //         jnz  plain
  0x66, 0x8b, 0x1f,             // shadow: mov  bx, [edi]
  0x66, 0x8b, 0x5c, 0x5d, 0x00, //         mov  bx, [ebp+ebx*2+0x0]
  0x66, 0x89, 0x1f,             //         mov  [edi], bx
  0xeb, 0x09,                   //         jmp  advance
  0x8a, 0x06,                   // plain:  mov  al, [esi]
  0x66, 0x8b, 0x1c, 0x41,       //         mov  bx, [ecx+eax*2]
  0x66, 0x89, 0x1f,             //         mov  [edi], bx
  0x46,                         // advance:inc  esi
  0x83, 0xc7, 0x02,             //         add  edi, 2
  0x4a,                         //         dec  edx
  0x75, 0xd9,                   //         jnz  head
]);

// Every arm, and 0xF9 for the equality-vs-range question. Two shadow pixels,
// so EBX has to carry its high half across an intervening plain pixel.
const SRC = [0xff, 0xf8, 0x7f, 0xf9, 0x00, 0xf8, 0xff];
// Small values on purpose: the shadow arm indexes its table with the
// DESTINATION word, so these decide which table entries get read.
const DST0 = [0x0003, 0x0011, 0x0007, 0x2222, 0x0005, 0x0009, 0x0013];

const EAX0 = 0x00000100;   // high 24 bits that `mov al,[esi]` must preserve
const EBX0 = 0x00010000;   // high 16 bits that `mov bx,[edi]` must preserve

const LUT_ENTRIES = 0x200;
const SHADOW_ENTRIES = 0x10040;
const lutValue = i => (0xa000 ^ (i * 3)) & 0xffff;
// The high bits have to reach the low 16, or entry 0x10011 and entry 0x0011
// hold the same word and the merge-vs-zero-extend question is unanswerable.
const shadowValue = i => (0x4100 ^ (i * 7) ^ (i >>> 5)) & 0xffff;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none' });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  const bytes = new Uint8Array(memory.buffer);
  bytes.set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE loads');

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const wa = ga => (ga - imageBase + guestBase) >>> 0;

  const data = e.guest_alloc(0x30000) >>> 0;
  const src = data;
  const dst = data + 0x100;
  const lut = data + 0x200;
  const shadow = data + 0x1000;

  // Neither table is reachable by the fold's own arithmetic unless the match
  // read the right base register out of each SIB byte, so a swapped ECX/EBP
  // shows up as garbage rather than as a plausible-looking picture.
  const setup = () => {
    const m8 = new Uint8Array(memory.buffer);
    const m16 = new Uint16Array(memory.buffer);
    m8.set(SRC, wa(src));
    for (let i = 0; i < DST0.length; i++) m16[(wa(dst) >> 1) + i] = DST0[i];
    for (let i = 0; i < LUT_ENTRIES; i++) m16[(wa(lut) >> 1) + i] = lutValue(i);
    for (let i = 0; i < SHADOW_ENTRIES; i++) m16[(wa(shadow) >> 1) + i] = shadowValue(i);
  };
  const readDst = () =>
    Array.from(new Uint16Array(memory.buffer, wa(dst), SRC.length));

  const runRow = (codeVa) => {
    setup();
    new Uint8Array(memory.buffer).set(LOOP, wa(codeVa));
    e.set_eip(codeVa);
    e.set_esi(src);
    e.set_edi(dst);
    e.set_ecx(lut);
    e.set_ebp(shadow);
    e.set_edx(SRC.length);
    e.set_eax(EAX0);
    e.set_ebx(EBX0);
    // The fold bills every block it swallowed against $block_budget, so drive
    // until EIP leaves the loop rather than assuming a single batch.
    for (let i = 0; i < 512 && (e.get_eip() >>> 0) !== ((codeVa + LOOP.length) >>> 0); i++) {
      e.run(1);
    }
    return {
      dst: readDst(),
      esi: e.get_esi() >>> 0, edi: e.get_edi() >>> 0,
      edx: e.get_edx() >>> 0, eax: e.get_eax() >>> 0, ebx: e.get_ebx() >>> 0,
      ecx: e.get_ecx() >>> 0, ebp: e.get_ebp() >>> 0,
      eip: e.get_eip() >>> 0, zf: e.test_ck_zf(), sf: e.test_ck_sf(),
    };
  };

  // ---- folded ----------------------------------------------------------
  const code = (imageBase + 0x2800) >>> 0;
  assert.strictEqual(e.get_ck_shadow16(), 1, 'the fold is on by default');
  const lut16Before = e.get_ck_lut16_matches();
  const m0 = e.get_ck_shadow16_matches(), r0 = e.get_ck_shadow16_runs();
  const p0 = e.get_ck_shadow16_px();
  const folded = runRow(code);

  assert.strictEqual(e.get_ck_shadow16_matches(), m0 + 1, 'the jgl grammar matched');
  // Unlike 455 this fold declines nothing, so the whole row is one run.
  assert.strictEqual(e.get_ck_shadow16_runs(), r0 + 1, 'the row ran in one go');
  assert.strictEqual(e.get_ck_shadow16_px(), p0 + BigInt(SRC.length),
    'every pixel in the row was blitted by the fold');
  assert.strictEqual(e.get_ck_lut16_matches(), lut16Before,
    'handler 455 did not also claim this loop');
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
  e.set_ck_shadow16(0);
  const plain = runRow((imageBase + 0x2900) >>> 0);
  assert.strictEqual(e.get_ck_shadow16_matches(), m0 + 1, 'the switch really is off');
  e.set_ck_shadow16(1);

  assert.deepStrictEqual(folded.dst, plain.dst,
    'folded pixels match the interpreter, pixel for pixel');
  for (const reg of ['eax', 'ebx', 'ecx', 'ebp', 'esi', 'edi', 'edx']) {
    assert.strictEqual(folded[reg], plain[reg],
      `${reg.toUpperCase()} matches the interpreter`);
  }
  assert.strictEqual(folded.zf, plain.zf, 'ZF matches the interpreter');
  assert.strictEqual(folded.sf, plain.sf, 'SF matches the interpreter');

  // ---- what the oracle cannot catch on its own -------------------------
  // Both arms agreeing proves the fold reproduces the interpreter; these
  // assertions are what proves the interpreter was asked the right question.
  assert.strictEqual(folded.dst[0], DST0[0], '0xFF left the destination alone');
  assert.strictEqual(folded.dst[6], DST0[6], 'the trailing 0xFF did too');

  // Shadow pixels: indexed by the DESTINATION word, merged into EBX's live
  // high half, and looked up in EBP's table rather than ECX's.
  assert.strictEqual(folded.dst[1], shadowValue(EBX0 | DST0[1]),
    'the shadow pixel remapped its own destination through EBP\'s table');
  assert.notStrictEqual(shadowValue(EBX0 | DST0[1]), shadowValue(DST0[1]),
    'the fixture can tell a merged EBX from a zero-extended one');
  assert.strictEqual(folded.dst[5], shadowValue(EBX0 | DST0[5]),
    'the second shadow pixel did too, with EBX\'s high half still intact');

  // Plain pixels: indexed by the source byte merged into EAX's live high
  // bits, through ECX's table. 0xF9 is here because 455's loop would have
  // sent it to the shadow arm and this one must not.
  assert.strictEqual(folded.dst[2], lutValue(EAX0 | 0x7f),
    'the plain pixel came from ECX\'s table at the merged index');
  assert.notStrictEqual(lutValue(EAX0 | 0x7f), lutValue(0x7f),
    'the fixture can tell a merged EAX from a zero-extended one');
  assert.strictEqual(folded.dst[3], lutValue(EAX0 | 0xf9),
    '0xF9 takes the PLAIN arm here, not the shadow arm');
  assert.strictEqual(folded.dst[4], lutValue(EAX0 | 0x00),
    'and 0x00 is an ordinary palette index, not a terminator');

  // ---- near miss --------------------------------------------------------
  // The grammar is exact on purpose; one changed interior byte has to fall
  // back to the ordinary decoder rather than fold something it did not read.
  const nearCode = (imageBase + 0x2a00) >>> 0;
  const near = Uint8Array.from(LOOP);
  near[7] = 0xf9;            // cmp byte [esi], 0xf9 -- a different sentinel
  setup();
  new Uint8Array(memory.buffer).set(near, wa(nearCode));
  e.set_eip(nearCode);
  e.set_esi(src); e.set_edi(dst); e.set_ecx(lut); e.set_ebp(shadow);
  e.set_edx(SRC.length); e.set_eax(EAX0); e.set_ebx(EBX0);
  const mNear = e.get_ck_shadow16_matches();
  e.run(1);
  assert.strictEqual(e.get_ck_shadow16_matches(), mNear,
    'a different sentinel remains ordinary x86');

  // An aliased pair of cursors must decline too: the executor holds all seven
  // registers in locals, so a match there would run correct-looking wrong
  // code. Point the shadow table at ESI's register and the grammar's
  // distinctness check is the only thing standing between that and a fold.
  const aliasCode = (imageBase + 0x2b00) >>> 0;
  const alias = Uint8Array.from(LOOP);
  alias[16] = 0x5e;          // SIB base ebp -> esi, which is already the source
  setup();
  new Uint8Array(memory.buffer).set(alias, wa(aliasCode));
  e.set_eip(aliasCode);
  e.set_esi(src); e.set_edi(dst); e.set_ecx(lut); e.set_ebp(shadow);
  e.set_edx(SRC.length); e.set_eax(EAX0); e.set_ebx(EBX0);
  const mAlias = e.get_ck_shadow16_matches();
  e.run(1);
  assert.strictEqual(e.get_ck_shadow16_matches(), mAlias,
    'an aliased register set is declined');

  console.log('PASS SimGolf dest-indexed keyed sprite row superinstruction');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

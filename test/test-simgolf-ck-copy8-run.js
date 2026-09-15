#!/usr/bin/env node
'use strict';

// The colour-keyed 8bpp->8bpp copy row (handler 460, $th_ck_copy8_run).
//
// The 14 bytes below are copied verbatim out of SimGolf's jgl.dll at
// 0x1003b602. That loop is what the game's ~48 second "Loading ..." splash
// is actually doing: profiled inside the stall (histogram armed at 8s), its
// two blocks are 40.7% of ALL block entries over a working set of just 908
// blocks -- so the splash is not waiting on anything, it is preprocessing
// sprites a pixel at a time.
//
// As in the LUT16 test, the interpreter is the oracle: the row runs twice
// over identical inputs, folded and unfolded, and the two must agree byte
// for byte and register for register. A wrong fold cannot pass by agreeing
// with a wrong hand-written expectation.
//
// The case worth the most here is a FULLY TRANSPARENT row. The x86 writes
// the temp register only inside the arm it skips, so a row with no opaque
// pixel must leave AH exactly as it was -- and on the real site under 4% of
// pixels are opaque, so that is a row shape this fold meets constantly.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const EXTRA_WAT = `
  (func (export "test_ck8_zf") (result i32) (call $get_zf))
`;

// jgl.dll+0x1003b602. Position independent: both branches are rel8 within
// these 14 bytes, so it may be placed at any address.
const LOOP = Uint8Array.from([
  0x80, 0x3e, 0xfe,   // head:   cmp byte [esi], 0xfe
  0x73, 0x04,         //         jnb  advance
  0x8a, 0x26,         //         mov  ah, [esi]
  0x88, 0x27,         //         mov  [edi], ah      (falls through)
  0x46,               // advance:inc  esi
  0x47,               //         inc  edi
  0x4a,               //         dec  edx
  0x75, 0xf2,         //         jnz  head
]);

// 0xFE and 0xFF are both transparent under this key. 0xFA is deliberately
// high but below it: an ordinary opaque byte, and the value that would break
// if the key were ever hardcoded to something else.
const SRC = [0x00, 0xfe, 0x7f, 0xff, 0xfa, 0x01, 0xfe];
const DST0 = [0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77];
const ALL_CLEAR = [0xfe, 0xff, 0xfe, 0xff, 0xfe, 0xff, 0xfe];

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat: EXTRA_WAT, fonts: 'none' });
  const fixture = fs.readFileSync(path.join(__dirname, 'binaries', 'notepad.exe'));
  new Uint8Array(memory.buffer).set(fixture, e.get_staging());
  assert(e.load_pe(fixture.length), 'fixture PE loads');

  const imageBase = e.get_image_base() >>> 0;
  const guestBase = e.get_guest_base() >>> 0;
  const wa = ga => (ga - imageBase + guestBase) >>> 0;

  const data = e.guest_alloc(0x4000) >>> 0;
  const src = data;
  const dst = data + 0x100;

  const EAX0 = 0xdead55aa;   // AH = 0x55, and nothing else may move either

  const runRow = (codeVa, srcBytes) => {
    const m8 = new Uint8Array(memory.buffer);
    m8.set(srcBytes, wa(src));
    m8.set(DST0, wa(dst));
    m8.set(LOOP, wa(codeVa));
    e.set_eip(codeVa);
    e.set_esi(src);
    e.set_edi(dst);
    e.set_edx(srcBytes.length);
    e.set_eax(EAX0);
    // The fold bills every block it swallowed against $block_budget, so drive
    // until EIP leaves the loop rather than assuming a single batch.
    for (let i = 0; i < 512 && (e.get_eip() >>> 0) !== ((codeVa + LOOP.length) >>> 0); i++) {
      e.run(1);
    }
    return {
      dst: Array.from(new Uint8Array(memory.buffer, wa(dst), srcBytes.length)),
      esi: e.get_esi() >>> 0, edi: e.get_edi() >>> 0,
      edx: e.get_edx() >>> 0, eax: e.get_eax() >>> 0,
      eip: e.get_eip() >>> 0, zf: e.test_ck8_zf(),
    };
  };

  // ---- folded ------------------------------------------------------------
  assert.strictEqual(e.get_ck_copy8(), 1, 'the fold is on by default');
  const m0 = e.get_ck_copy8_matches();
  const r0 = e.get_ck_copy8_runs();
  const p0 = e.get_ck_copy8_px();
  const folded = runRow((imageBase + 0x2800) >>> 0, SRC);

  assert.strictEqual(e.get_ck_copy8_matches(), m0 + 1, 'the grammar matched');
  assert.strictEqual(e.get_ck_copy8_runs(), r0 + 1,
    'there is no blend arm to bail into, so the row is exactly one run');
  assert.strictEqual(e.get_ck_copy8_px(), p0 + BigInt(SRC.length),
    'every pixel was handled inside the fold, transparent ones included');
  assert.strictEqual(folded.eip, (imageBase + 0x2800 + LOOP.length) >>> 0,
    'execution continues after the row');
  assert.strictEqual(folded.esi, (src + SRC.length) >>> 0, 'ESI walked the row');
  assert.strictEqual(folded.edi, (dst + SRC.length) >>> 0,
    'EDI advanced by ONE per pixel, not two -- the dest step is an inc');
  assert.strictEqual(folded.edx, 0, 'EDX counted down to zero');
  assert.strictEqual(folded.zf, 1, 'the final DEC sets ZF');

  // ---- the same row, unfolded -------------------------------------------
  // A different address, because the folded block is already cached at the
  // first one and the switch is decode-time.
  e.set_ck_copy8(0);
  const plain = runRow((imageBase + 0x2900) >>> 0, SRC);
  assert.strictEqual(e.get_ck_copy8_matches(), m0 + 1, 'the switch really is off');
  e.set_ck_copy8(1);

  assert.deepStrictEqual(folded.dst, plain.dst,
    'folded bytes match the interpreter, byte for byte');
  assert.strictEqual(folded.eax, plain.eax, 'EAX matches the interpreter');
  assert.strictEqual(folded.esi, plain.esi, 'ESI matches the interpreter');
  assert.strictEqual(folded.edi, plain.edi, 'EDI matches the interpreter');
  assert.strictEqual(folded.edx, plain.edx, 'EDX matches the interpreter');
  assert.strictEqual(folded.zf, plain.zf, 'ZF matches the interpreter');

  // Independently of the oracle: the keyed bytes are holes, the rest copied.
  assert.strictEqual(folded.dst[1], DST0[1], '0xFE is transparent under this key');
  assert.strictEqual(folded.dst[3], DST0[3], 'and so is 0xFF');
  assert.strictEqual(folded.dst[6], DST0[6], 'including the trailing one');
  assert.strictEqual(folded.dst[0], 0x00, 'the opaque bytes were copied through');
  assert.strictEqual(folded.dst[2], 0x7f, 'no palette is involved');
  assert.strictEqual(folded.dst[4], 0xfa,
    '0xFA is below the key and therefore an ordinary opaque byte');
  assert.strictEqual(folded.dst[5], 0x01, 'and the last one');

  // AH holds the last byte the source arm loaded; the rest of EAX must not
  // have moved, which is what makes this a set_reg8 and not a set_reg.
  assert.strictEqual((folded.eax >>> 8) & 0xff, 0x01,
    'AH carries the LAST opaque byte out of the row');
  assert.strictEqual(folded.eax >>> 16, EAX0 >>> 16,
    'the high half of EAX is untouched');
  assert.strictEqual(folded.eax & 0xff, EAX0 & 0xff, 'AL is untouched');

  // ---- a fully transparent row ------------------------------------------
  // The x86 writes AH only inside the arm it never enters here, so AH must
  // come out exactly as it went in. A fold that wrote back unconditionally
  // would leave the last token there instead and nothing else would notice.
  const clearFolded = runRow((imageBase + 0x2a00) >>> 0, ALL_CLEAR);
  e.set_ck_copy8(0);
  const clearPlain = runRow((imageBase + 0x2b00) >>> 0, ALL_CLEAR);
  e.set_ck_copy8(1);

  assert.deepStrictEqual(clearFolded.dst, DST0,
    'a fully transparent row writes no destination byte at all');
  assert.strictEqual(clearFolded.eax, EAX0,
    'AH is UNCHANGED when no pixel was opaque');
  assert.strictEqual(clearFolded.eax, clearPlain.eax,
    'and the interpreter agrees about that');
  assert.deepStrictEqual(clearFolded.dst, clearPlain.dst,
    'the interpreter agrees about the destination too');

  // ---- near misses -------------------------------------------------------
  // The grammar is exact on purpose. Each of these is a byte the fold
  // genuinely depends on, so each has to fall back to the ordinary decoder
  // rather than fold something it did not read.
  const nearMiss = (name, patch) => {
    const bytes = Uint8Array.from(LOOP);
    patch(bytes);
    const at = (imageBase + 0x2c00 + nearMiss.n * 0x100) >>> 0;
    nearMiss.n = (nearMiss.n || 0) + 1;
    const m8 = new Uint8Array(memory.buffer);
    m8.set(SRC, wa(src));
    m8.set(DST0, wa(dst));
    m8.set(bytes, wa(at));
    e.set_eip(at);
    e.set_esi(src); e.set_edi(dst); e.set_edx(SRC.length); e.set_eax(EAX0);
    const before = e.get_ck_copy8_matches();
    e.run(1);
    assert.strictEqual(e.get_ck_copy8_matches(), before, name);
  };
  nearMiss.n = 0;

  // A different 8-bit register on the store than on the load: the byte would
  // come from somewhere the fold never read.
  nearMiss('a mismatched temp register remains ordinary x86', b => {
    assert.strictEqual(b[8], 0x27, 'the store ModRM is where this test thinks');
    b[8] = 0x07;             // mov [edi], al  rather than ah
  });
  // A dest step of two is the LUT16 shape, not this one, and folding it here
  // would advance EDI at half the rate the guest expects.
  nearMiss('an add-based dest step remains ordinary x86', b => {
    assert.strictEqual(b[10], 0x47, 'the inc edi is where this test thinks');
    b[10] = 0x90;            // nop instead of inc edi
  });

  console.log('PASS SimGolf colour-keyed 8bpp copy row superinstruction');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

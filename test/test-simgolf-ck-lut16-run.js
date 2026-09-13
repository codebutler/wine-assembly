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
const DST0 = [0x1111, 0x2222, 0xa07f, 0x0003, 0x5555, 0x6666];

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
  const setup = () => {
    const m8 = new Uint8Array(memory.buffer);
    const m16 = new Uint16Array(memory.buffer);
    m8.set(SRC, wa(src));
    for (let i = 0; i < DST0.length; i++) m16[(wa(dst) >> 1) + i] = DST0[i];
    for (let i = 0; i < 256; i++) m16[(wa(lut) >> 1) + i] = (0xa000 | i) & 0xffff;
    for (let i = 0; i < 256; i++) m16[(wa(shadow) >> 1) + i] = (0xbe00 | i) & 0xffff;
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
    e.set_eax(0xdeadbeef);
    // The fold bills every block it swallowed against $block_budget, so a row
    // that bails into the shadow arm can legitimately span more than one
    // batch. Drive until EIP leaves the loop rather than assuming one.
    for (let i = 0; i < 512 && (e.get_eip() >>> 0) !== ((codeVa + LOOP.length) >>> 0); i++) {
      e.run(1);
    }
    return {
      dst: readDst(),
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
  const nearCode = (imageBase + 0x2a00) >>> 0;
  const near = Uint8Array.from(LOOP);
  near[2] = 0xfe;            // cmp byte [esi], 0xfe -- a different sentinel
  setup();
  new Uint8Array(memory.buffer).set(near, wa(nearCode));
  e.set_eip(nearCode);
  e.set_esi(src); e.set_edi(dst); e.set_ecx(lut); e.set_ebp(shadow);
  e.set_edx(SRC.length); e.set_eax(0);
  const mNear = e.get_ck_lut16_matches();
  e.run(1);
  assert.strictEqual(e.get_ck_lut16_matches(), mNear,
    'a different sentinel remains ordinary x86');

  console.log('PASS SimGolf colour-keyed LUT16 sprite row superinstruction');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

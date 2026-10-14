#!/usr/bin/env node
'use strict';

// A large block gets a sparse arena of its own, and a freed one is kept for the
// next large request (never carved by small ones) until memory pressure hands it back,
// as the Windows heap does with a request it hands to VirtualAlloc. Alien
// Shooter allocates and frees a 48 MB decode buffer per sprite pack with a few
// small allocations in between. Those used to carve the freed block's front, so
// every 48 MB request reserved a fresh range: six cycles spent the whole 316 MB
// backing pool while under 3 MB was live, and every later pack load failed.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const { exports: e } = await bootRenderHarness({ fonts: 'none' });
  const BIG = 0x03000000, keep = [];
  for (let i = 0; i < 12; i++) {
    const p = e.guest_alloc(BIG) >>> 0;
    assert(p, `48 MB allocation ${i} succeeds (the old heap failed the 7th)`);
    // Writable end to end: the arena is committed, not just reserved.
    e.guest_write32(p, 0x11111111 + i);
    e.guest_write32(p + BIG - 4, 0x22222222 + i);
    assert.strictEqual(e.guest_read32(p + BIG - 4) >>> 0, 0x22222222 + i);
    e.guest_free(p);
    for (let k = 0; k < 64; k++) {
      const s = e.guest_alloc(k & 1 ? 4096 : 10256) >>> 0;
      assert(s, 'small allocation between the large ones');
      keep.push(s);
    }
  }
  // Fresh pages, not the previous owner's bytes (HeapAlloc of a large block is
  // a fresh VirtualAlloc on Windows).
  const fresh = e.guest_alloc(BIG) >>> 0;
  assert(fresh);
  assert.strictEqual(e.guest_read32(fresh) >>> 0, 0, 'a reissued large block starts zeroed');
  assert.strictEqual(e.guest_read32(fresh + BIG - 4) >>> 0, 0);
  e.guest_free(fresh);
  for (const s of keep) e.guest_free(s);
  console.log('PASS  large heap blocks own an arena reused across alloc/free cycles (12 x 48 MB with live small blocks between)');

  // The threshold is the Windows heap's own (VirtualMemoryThreshold, 508 KB),
  // not 1 MB. Battlezone's demo repaints its 640x480 8-bit ad screen every idle
  // pass: a 4 KB read buffer, a 1072-byte BITMAPINFO it never frees, and a
  // 921,608-byte pixel buffer, then frees the buffer and the pixels. Under a
  // 1 MB threshold the leaked BITMAPINFO was carved from the previous pass's
  // freed pixel block, which was then too short for the next one, so every pass
  // took a fresh 900 KB; about 335 passes in, the menu background could not be
  // allocated and drew grey.
  const PIXELS = 921608, leaked = [];
  let first = 0;
  for (let i = 0; i < 1200; i++) {
    const io = e.guest_alloc(4096) >>> 0;
    const bmi = e.guest_alloc(1072) >>> 0;
    const px = e.guest_alloc(PIXELS) >>> 0;
    assert(io && bmi && px, `ad repaint ${i}: all three allocations succeed`);
    if (!first) first = px;
    assert.strictEqual(px, first, `ad repaint ${i} reuses the freed pixel block`);
    e.guest_free(io);
    e.guest_free(px);
    leaked.push(bmi);
  }
  for (const s of leaked) e.guest_free(s);
  console.log('PASS  a 900 KB block freed between leaking small allocations is reused (Battlezone ad screen, 1200 passes)');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

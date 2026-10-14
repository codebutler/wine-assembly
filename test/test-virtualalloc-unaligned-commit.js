#!/usr/bin/env node
'use strict';

// VirtualAlloc with an address commits every page holding a byte of
// [lpAddress, lpAddress + dwSize) and returns the page-aligned base, as on
// Windows. Trespasser's page manager commits from its access-violation filter
// at the faulting address less 16 -- VirtualAlloc(0x17530ff0, 0x1000,
// MEM_COMMIT) -- which spans two pages; committing only from the unaligned
// base left the second page, the one it had just touched, unmapped, and the
// game faulted on it until it died with 0xC0000005.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "t_valloc") (param $addr i32) (param $size i32) (param $type i32) (result i32)
    (local $sp i32)
    (local.set $sp (i32.load offset=16 (global.get $reg_base)))
    (call $handle_VirtualAlloc (local.get $addr) (local.get $size) (local.get $type)
      (i32.const 4) (i32.const 0) (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $sp))
    (i32.load (global.get $reg_base)))
  (func (export "t_g2w") (param $ga i32) (result i32) (call $g2w (local.get $ga)))
  (func (export "t_sentinel") (result i32) (global.get $NULL_SENTINEL))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const image = fs.readFileSync(path.join(__dirname, 'binaries/notepad.exe'));
  new Uint8Array(memory.buffer).set(image, e.get_staging());
  assert(e.load_pe(image.length));
  const MEM_COMMIT = 0x1000, MEM_RESERVE = 0x2000;
  const mapped = ga => (e.t_g2w(ga) >>> 0) !== (e.t_sentinel() >>> 0);

  const base = e.t_valloc(0, 0x10000, MEM_RESERVE) >>> 0;
  assert(base && (base & 0xFFFF) === 0, 'a 64 KB reservation');
  assert(!mapped(base) && !mapped(base + 0x1000), 'reserved, nothing committed yet');

  // Trespasser's spelling: 16 bytes below a page boundary, one page long.
  const got = e.t_valloc(base + 0xff0, 0x1000, MEM_COMMIT) >>> 0;
  assert.strictEqual(got, base, 'returns the page-aligned base');
  assert(mapped(base), 'the page holding the first byte is committed');
  assert(mapped(base + 0x1000), 'and the page holding the last byte, which was left out');
  assert(mapped(base + 0x1fef), 'the last requested byte translates');
  assert(!mapped(base + 0x2000), 'nothing past the last page holding a requested byte');

  // An aligned request is unchanged.
  assert.strictEqual(e.t_valloc(base + 0x4000, 0x1000, MEM_COMMIT) >>> 0, base + 0x4000);
  assert(mapped(base + 0x4000) && !mapped(base + 0x5000), 'aligned commit maps exactly its page');

  // A one-byte request inside a page commits that page.
  assert.strictEqual(e.t_valloc(base + 0x8123, 1, MEM_COMMIT) >>> 0, base + 0x8000);
  assert(mapped(base + 0x8000) && !mapped(base + 0x9000), 'one byte commits its whole page');

  console.log('PASS test-virtualalloc-unaligned-commit');
})().catch(err => { console.error(err); process.exit(1); });

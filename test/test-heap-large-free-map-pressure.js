#!/usr/bin/env node
'use strict';

// Freed large heap blocks must not starve a mapped allocation. Since the
// large-block threshold became 508 KB (8c1018120), a freed 508 KB-1 MB block
// keeps its own sparse arena, and that arena's backing, on $heap_large_free
// until memory pressure hands it back. Only the heap's own paths applied that
// pressure. guest_map_alloc -- what lib/d3d9-software-backend.js allocates its
// render targets and textures with -- reserved and committed directly and
// returned 0. Black & White 2 frees enough mid-sized blocks while loading its
// land that the software D3D9 queue then died with "native allocation failed"
// at ~740 s, and the world froze.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const { exports: e } = await bootRenderHarness({ fonts: 'none' });
  const MID = 600 * 1024, live = [];
  // Spend the backing pool on mid-sized blocks, then free every one: they all
  // go to the large free list, still holding their backing.
  for (let i = 0; i < 4096; i++) {
    const p = e.guest_alloc(MID) >>> 0;
    if (!p) break;
    e.guest_write32(p + MID - 4, i); // touch the far end: committed
    live.push(p);
  }
  assert(live.length > 64, `the pool holds many 600 KB blocks (${live.length})`);
  for (const p of live) e.guest_free(p);

  // A mapped allocation larger than any freed block now has to get its backing
  // from the freed arenas.
  const VIEW = 8 * 1024 * 1024;
  const view = e.guest_map_alloc(VIEW) >>> 0;
  assert(view, `an 8 MB mapped allocation succeeds after ${live.length} freed 600 KB blocks`);
  e.guest_write32(view + VIEW - 4, 0x5A5A5A5A);
  assert.strictEqual(e.guest_read32(view + VIEW - 4) >>> 0, 0x5A5A5A5A, 'the view is committed end to end');
  assert.strictEqual(e.guest_map_free(view), 1);

  // And the heap still serves the same size afterwards.
  const again = e.guest_alloc(MID) >>> 0;
  assert(again, 'a 600 KB block is still available afterwards');
  e.guest_free(again);
  console.log(`PASS  ${live.length} freed 600 KB large blocks do not starve an 8 MB mapped allocation`);
})().catch(error => { console.error(error); process.exitCode = 1; });

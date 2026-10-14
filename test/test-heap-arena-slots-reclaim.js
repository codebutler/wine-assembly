#!/usr/bin/env node
'use strict';

// Freed large blocks must not hold heap-arena slots forever. Since the large
// threshold became 508 KB (8c1018120) every block from 508 KB to 1 MB is an
// arena of its own, and a freed one keeps its arena -- and its slot in the
// 1024-entry HEAP_ARENAS table -- on $heap_large_free until it is reused or
// released. Reuse needs a request of the same size or up to a third smaller,
// and release used to happen only when address space or backing ran out.
// Black & White 2 freed so many differently sized mid blocks while loading its
// land that the table filled with arenas nothing used: every spill failed
// (OOM reason 4) and the software D3D9 backend died with "native allocation
// failed". Before 8c1018120 those blocks were ordinary free-list entries and
// held no slot at all.
//
// 2 GB of memory, as Black & White 2 runs with (bigMemory): the 316 MB pool of
// a 512 MB memory runs out of backing long before 1024 arenas exist.

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const pages = 32768;
  const { exports: e } = await bootRenderHarness({
    fonts: 'none',
    memory: new WebAssembly.Memory({ initial: pages, maximum: pages, shared: true }),
  });
  // Churn: one block of each size from 508 KB to 1 MB in 4 KB steps, freed at
  // once. Each is larger than every block freed before it, so none is reused,
  // and each leaves a free arena behind.
  let churned = 0;
  for (let size = 0x7F000; size < 0x100000; size += 0x1000) {
    const p = e.guest_alloc(size) >>> 0;
    assert(p, `churn block of ${size} bytes`);
    e.guest_free(p);
    churned++;
  }
  // Fill: live 600 KB blocks until the heap refuses one (or 1100: more slots
  // than the table has, so the loop always ends on a refusal).
  const MID = 600 * 1024, live = [];
  for (let i = 0; i < 1100; i++) {
    const p = e.guest_alloc(MID) >>> 0;
    if (!p) break;
    live.push(p);
  }
  // Without reclaiming, the churned arenas keep ~125 slots and the fill stops
  // near 1024 - 125; with it they are handed back and the fill reaches the
  // table's real capacity (less the few arenas the boot itself holds).
  assert(live.length >= 1000,
    `${live.length} live 600 KB blocks after ${churned} churned sizes (the churn kept its slots)`);
  for (const p of live) e.guest_free(p);
  console.log(`PASS  ${churned} freed mid-sized blocks give their arena slots back (${live.length} live 600 KB blocks fit afterwards)`);
})().catch(error => { console.error(error); process.exitCode = 1; });

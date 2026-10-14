#!/usr/bin/env node
'use strict';

// A DirectDraw presentation's pixels are read lazily, at composite time. In
// the browser the guest runs in a Worker and keeps flipping meanwhile, while
// the gdi_surface_create that rebinds the presentation to the new front
// buffer is still queued behind it. Reading the DIB named by the last create
// then shows the *back* buffer -- right after a Flip it still holds the frame
// before last -- and the screen stepped N, N-1, N+1: Ricochet Xtreme's
// cursor and its animated balls blinked back to old positions (user report,
// 2026-10-11). The flush must read the surface's current DIB from the DX
// object table, which Flip updates in shared memory.

const assert = require('assert');
const { createHostImports } = require('../lib/host-imports');
const RegionMap = require('../lib/region-map.generated.js');

const DX_OBJECTS = RegionMap.BASE.DX_OBJECTS;
const DX_ENTRY_SIZE = 32;
const memory = new ArrayBuffer(DX_OBJECTS + RegionMap.SIZE.DX_OBJECTS);
const bytes = new Uint8Array(memory);
const dv = new DataView(memory);

const W = 8, H = 4, STRIDE = W * 4;
const slot = 1;
const id = 0x200000 + slot;               // DirectDraw surface DC id
const bufA = 0x10000, bufB = 0x20000;
const entry = DX_OBJECTS + slot * DX_ENTRY_SIZE;

// A DDSurface entry, as $gdi_dx_surface_entry and host-imports read it.
const setEntry = dib => {
  dv.setUint32(entry, 2, true);           // type: DDSurface
  dv.setUint16(entry + 12, W, true);
  dv.setUint16(entry + 14, H, true);
  dv.setUint16(entry + 16, 32, true);
  dv.setUint16(entry + 18, STRIDE, true);
  dv.setUint32(entry + 20, dib, true);    // current DIB: Flip swaps it
};
const fill = (base, r, g, b) => {
  for (let p = base; p < base + STRIDE * H; p += 4) {
    bytes[p] = b; bytes[p + 1] = g; bytes[p + 2] = r; bytes[p + 3] = 0;
  }
};

const renderer = {
  windows: { 0x10001: {} },
  scheduleRepaint() {},
  attachWindowSurface(hwnd, canvas) { this.windows[hwnd]._backCanvas = canvas; return true; },
  detachWindowSurface() { return true; },
};
const { host, gdi } = createHostImports({ getMemory: () => memory, exports: {}, renderer });
const pixel = () => {
  const p = gdi.surfacePresentations.get(id);
  return Array.from(p.canvas.getContext('2d').getImageData(3, 2, 1, 1).data);
};

// Frame 1 is in A, the front buffer; the guest presents it.
setEntry(bufA);
fill(bufA, 10, 20, 30);
assert.strictEqual(host.gdi_surface_create(id, W, H, 32, bufA, STRIDE, 1, 0, 0), 1);
assert.strictEqual(host.gdi_surface_attach(id, 0x10001), 1);
assert.strictEqual(host.gdi_surface_upload(id, 0, 0, W, H), 1);
assert.deepStrictEqual(pixel(), [10, 20, 30, 255], 'the presented frame is shown');

// The guest draws frame 2 into B and Flips: B is now the front and A the
// back buffer, which it starts redrawing (here: half way to frame 3). The
// rebinding create for B has not reached the page yet.
fill(bufB, 40, 50, 60);
setEntry(bufB);
fill(bufA, 99, 0, 99);
const p = gdi.surfacePresentations.get(id);
p.surface.markDirty(0, 0, W, H);          // the upload that did arrive
assert.strictEqual(p.canvas._waFlushCanonicalSurface(), 1);
assert.deepStrictEqual(pixel(), [40, 50, 60, 255],
  'the composite shows the front buffer the Flip named, not the back buffer being redrawn');
assert.strictEqual(p.surface.storageOffset, bufB);

// The late create for B then changes nothing visible.
assert.strictEqual(host.gdi_surface_create(id, W, H, 32, bufB, STRIDE, 1, 0, 0), 1);
assert.strictEqual(p.canvas._waFlushCanonicalSurface(), 1);
assert.deepStrictEqual(pixel(), [40, 50, 60, 255]);

// A surface the table no longer describes the same way keeps its binding.
dv.setUint16(entry + 18, STRIDE * 2, true);
dv.setUint32(entry + 20, bufA, true);
p.surface.markDirty(0, 0, W, H);
assert.strictEqual(p.canvas._waFlushCanonicalSurface(), 1);
assert.strictEqual(p.surface.storageOffset, bufB, 'a geometry mismatch does not rebind');

console.log('PASS DirectDraw lazy flush reads the current front buffer after a Flip');

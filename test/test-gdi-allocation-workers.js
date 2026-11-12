#!/usr/bin/env node
'use strict';

// Real simultaneous allocations: cooperative slice interleaving cannot expose
// a collision inside the scan-and-claim of a bitmap, DIB page run, or DC.
const assert = require('assert');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const ROUNDS = 30, COUNT = 100;
const EXTRA = `
  (func (export "race_dc_alloc") (result i32) (call $gdi_dc_alloc))
  (func (export "race_dc_delete") (param i32)
    (drop (call $gdi_dc_delete (local.get 0))))
  (func (export "race_lock") (result i32) (global.get $GDI_ALLOC_LOCK))
  (func (export "race_owner") (result i32) (call $lock_owner_id))
  (func (export "race_descriptor") (result i32) (global.get $GDI_BLIT_DST_DESC))
  (func (export "race_bits") (param i32) (result i32)
    (call $gdi_bitmap_storage (local.get 0)))
  (func (export "race_prepare") (param $src i32) (param $dst i32)
    (drop (call $gdi_surface_descriptor (local.get $src) (global.get $GDI_BLIT_SRC_DESC)))
    (drop (call $gdi_surface_descriptor (local.get $dst) (global.get $GDI_BLIT_DST_DESC))))
  (func (export "race_blit") (param $src i32) (param $dst i32) (result i32)
    (call $gdi_raster_bitblt (local.get $dst) (local.get $src)
      (global.get $GDI_BLIT_DST_DESC) (i32.const 0) (i32.const 0)
      (i32.const 128) (i32.const 128) (global.get $GDI_BLIT_SRC_DESC)
      (i32.const 0) (i32.const 0) (i32.const 0) (i32.const 0x00CC0020)))
`;

async function boot(module, memory, tid, shadow = false) {
  let e;
  const host = { memory };
  for (const d of WebAssembly.Module.imports(module)) {
    if (d.kind !== 'function') continue;
    host[d.name] = () => {
      // Catch accidental expansion of the critical section over rendering RPC.
      if (e) assert.notStrictEqual(Atomics.load(new Int32Array(memory.buffer),
        e.race_lock() / 4), e.race_owner(), 'host import under allocator lock: ' + d.name);
      return d.name === 'gdi_surface_create' ? 1 : 0;
    };
  }
  e = (await WebAssembly.instantiate(module, { host })).exports;
  e.set_host_shadow(shadow ? 1 : 0);
  e.init_thread(tid, 0x400000, 0, 0, 0, 0, 0, 0);
  return e;
}

if (!isMainThread) {
  (async () => {
    const { module, memory, barrier, tid } = workerData;
    const e = await boot(module, memory, tid), sync = new Int32Array(barrier);
    let rows = [];
    parentPort.postMessage({ ready: true });
    for (let round = 1; round <= ROUNDS; round++) {
      while (Atomics.load(sync, 0) < round) Atomics.wait(sync, 0, round - 1, 1000);
      // Release previous live allocations concurrently with the other thread's
      // allocation; slot clearing must be serialized with slot reservation too.
      for (const row of rows) {
        e.race_dc_delete(row.dc);
        e.test_gdi_object_delete_full(row.h);
      }
      rows = [];
      for (let k = 0; k < COUNT; k++) {
        const width = 156 + (k % 4) * 80, height = 26;
        const h = e.test_gdi_create_compat_bitmap(width, height, 0);
        const bits = e.race_bits(h), dc = e.race_dc_alloc();
        const marker = tid * 100000 + round * COUNT + k;
        e.test_gdi_dc_set_field(dc, 24, marker, 0);
        rows.push({ h, bits, dc, marker, width, height });
      }
      parentPort.postMessage({ round, rows });
    }
    const src = e.test_gdi_create_compat_bitmap(128, 128, 0);
    const dst = e.test_gdi_create_compat_bitmap(128, 128, 0);
    const srcDc = e.race_dc_alloc(), dstDc = e.race_dc_alloc();
    e.test_gdi_dc_set_field(srcDc, 84, src, 0);
    e.test_gdi_dc_set_field(dstDc, 84, dst, 0);
    const color = tid === 1 ? 0x00123456 : 0x00654321;
    new Uint32Array(memory.buffer, e.race_bits(src), 128 * 128).fill(color);
    e.race_prepare(srcDc, dstDc);
    // Both descriptors are prepared before either blit consumes them. With a
    // shared scratch buffer, one thread deterministically uses the other's DC.
    Atomics.add(sync, 1, 1);
    Atomics.notify(sync, 1);
    while (Atomics.load(sync, 1) < 2) Atomics.wait(sync, 1, 1, 1000);
    assert.strictEqual(e.race_blit(srcDc, dstDc), 1);
    parentPort.postMessage({ pixels: e.race_bits(dst), color });
  })().catch(error => { throw error; });
} else {
  (async () => {
    const { compileSrcWasm } = require('./compile-src');
    const module = await WebAssembly.compile(compileSrcWasm((file, source) =>
      file === '13-exports.wat' ? source + EXTRA : source));
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const barrier = new SharedArrayBuffer(8), sync = new Int32Array(barrier);
    const e = await boot(module, memory, 0);
    // The browser initializes its host shadow using slot 7, but real guest
    // thread 7 must still have an independent drawing buffer.
    const shadow = await boot(module, memory, 7, true);
    const guest7 = await boot(module, memory, 7);
    assert.notStrictEqual(shadow.race_descriptor(), guest7.race_descriptor());
    const workers = [1, 2].map(tid =>
      new Worker(__filename, { workerData: { module, memory, barrier, tid } }));
    const next = workers.map(w => {
      const queue = [], waiters = [];
      let failure;
      w.on('message', value => waiters.length ? waiters.shift().resolve(value) : queue.push(value));
      w.on('error', error => {
        failure = error;
        for (const waiter of waiters.splice(0)) waiter.reject(error);
      });
      return () => failure ? Promise.reject(failure) : queue.length ?
        Promise.resolve(queue.shift()) : new Promise((resolve, reject) => waiters.push({ resolve, reject }));
    });
    const timeout = setTimeout(() => {
      console.error('concurrent GDI allocation timed out');
      process.exit(1);
    }, 60000);
    try {
      await Promise.all(next.map(n => n()));
      for (let round = 1; round <= ROUNDS; round++) {
        Atomics.store(sync, 0, round);
        Atomics.notify(sync, 0);
        const rows = (await Promise.all(next.map(n => n()))).flatMap(v => v.rows);
        assert.strictEqual(new Set(rows.map(r => r.h)).size, COUNT * 2, 'duplicate bitmap handle');
        assert.strictEqual(new Set(rows.map(r => r.dc)).size, COUNT * 2, 'duplicate DC handle');
        const spans = rows.map(r => [r.bits, r.bits + Math.ceil(r.width * r.height * 4 / 4096) * 4096])
          .sort((a, b) => a[0] - b[0]);
        for (let i = 1; i < spans.length; i++)
          assert.ok(spans[i][0] >= spans[i - 1][1], 'overlapping bitmap storage');
        for (const row of rows) {
          assert.ok(row.h && row.dc && row.bits, 'allocation failed');
          assert.ok(e.test_gdi_object_record(row.h), 'live bitmap disappeared');
          assert.strictEqual(e.race_bits(row.h), row.bits, 'bitmap storage changed');
          assert.strictEqual(e.test_gdi_dc_get_field(row.dc, 24, -1), row.marker, 'DC record overwritten');
        }
      }
      console.log('GDI concurrent allocation: 6000 bitmaps and DCs, distinct live handles/storage; passed');
      for (const { pixels, color } of await Promise.all(next.map(n => n())))
        for (const pixel of new Uint32Array(memory.buffer, pixels, 128 * 128))
          assert.strictEqual(pixel & 0xFFFFFF, color, 'concurrent blit used another thread\'s descriptor');
      console.log('GDI interleaved descriptor preparation: both images match their own source; passed');
    } finally {
      clearTimeout(timeout);
      await Promise.all(workers.map(w => w.terminate()));
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
}

'use strict';
// Two guest threads loading DLLs at the same time (DLL-CONCURRENT-MAPPING).
//
// PE_STAGING is one buffer for the whole process and the next DLL address is
// worked out from the last DLL_TABLE row and the heap watermark, so before the
// loader lock two real Workers could stage over each other, pick the same
// address and claim the same row; and a HeapAlloc on another thread could hand
// out an arena over an image that was still being mapped. Here two actual
// Workers share one memory and one compiled module, as browser Threads mode
// does, and the interleavings are forced rather than hoped for:
//
//   1. A stages its image and takes its address, then pauses before load_dll;
//      B starts its own load during the pause. With the lock B waits for A's
//      publication; without it B overwrites A's staged bytes and takes the
//      same address.
//   2. A stages and takes its address again and pauses; B allocates from the
//      guest heap during the pause and marks its block. A's image must land
//      clear of B's block, and the mark must survive.
//
// Each instance gets its own thread id: the lock is owned per thread, and two
// bare instances would otherwise share id 1 and recurse into each other.
const fs = require('fs'), path = require('path');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const root = path.resolve(__dirname, '..');
const assert = require('node:assert/strict');

const PAUSE_MS = 300;
// Cells in the shared control buffer.
const A_STAGED = 0, B_DONE = 1, PHASE = 2;

if (!isMainThread) {
  (async () => {
    const { createHostImports } = require(root + '/lib/host-imports');
    const { loadDll } = require(root + '/lib/dll-loader');
    const { guestToWasm } = require(root + '/lib/mem-utils');
    const memory = workerData.memory, ctl = new Int32Array(workerData.control);
    const ctx = { getMemory: () => memory.buffer, resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit: () => {} };
    const imports = createHostImports(ctx); imports.host.memory = memory;
    for (const name of ['create_thread', 'exit_thread', 'terminate_thread', 'create_event', 'set_event', 'reset_event', 'wait_single', 'wait_multiple']) imports.host[name] = () => 0;
    const instance = await WebAssembly.instantiate(workerData.module, imports), e = instance.exports; ctx.exports = e;
    e.set_current_thread_id(workerData.id === 'a' ? 2 : 3);
    const dv = () => new DataView(memory.buffer);
    const read = (guest) => dv().getUint32(guestToWasm(guest, e, memory.buffer, e.get_image_base()), true);
    const write = (guest, v) => dv().setUint32(guestToWasm(guest, e, memory.buffer, e.get_image_base()), v, true);
    const waitFor = (cell, value, what) => {
      while (Atomics.load(ctl, cell) < value) {
        if (Atomics.wait(ctl, cell, Atomics.load(ctl, cell), 10000) === 'timed-out') throw Error(`${what} timed out`);
      }
    };
    const load = (fixture, name) => {
      let pathIndex = -1;
      const wrapped = {
        ...e,
        set_dll_path: (index, ptr) => { pathIndex = index; e.set_dll_path(index, ptr); },
        load_dll: (...args) => {
          if (workerData.id === 'a') {
            // Staged and placed, not yet mapped: let B race now.
            Atomics.add(ctl, A_STAGED, 1); Atomics.notify(ctl, A_STAGED);
            Atomics.wait(ctl, PHASE, 0, PAUSE_MS);  // PHASE stays 0: a timed sleep
          }
          return e.load_dll(...args);
        },
      };
      const mapped = loadDll(wrapped, memory.buffer, new Uint8Array(fixture), name);
      // load_dll now writes the path row itself, before publishing; the row it
      // took is this instance's own last_loaded_dll_index.
      if (pathIndex < 0 && e.set_next_dll_path) pathIndex = e.get_last_loaded_dll_index();
      return { loadAddr: mapped.loadAddr >>> 0, payload: read(mapped.loadAddr + 0x1180) >>> 0, pathIndex };
    };
    parentPort.postMessage({ ready: true });
    parentPort.once('message', () => {
      try {
        const out = { id: workerData.id };
        if (workerData.id === 'a') {
          out.first = load(workerData.fixtures[0], 'a1.dll');
          waitFor(B_DONE, 1, 'phase 1');
          out.second = load(workerData.fixtures[1], 'a2.dll');
          waitFor(B_DONE, 2, 'phase 2');
        } else {
          waitFor(A_STAGED, 1, 'A staging 1');
          out.first = load(workerData.fixtures[0], 'b1.dll');
          Atomics.add(ctl, B_DONE, 1); Atomics.notify(ctl, B_DONE);
          waitFor(A_STAGED, 2, 'A staging 2');
          // A HeapAlloc on this thread while A's image is staged and placed.
          const block = e.guest_alloc(0x4000) >>> 0;
          for (let i = 0; i < 0x4000; i += 4) write(block + i, 0xB10CB10C);
          out.block = block;
          // Read the mark back once A has mapped.
          Atomics.wait(ctl, PHASE, 0, PAUSE_MS * 3);
          let intact = true;
          for (let i = 0; i < 0x4000; i += 4) if (read(block + i) >>> 0 !== 0xB10CB10C) { intact = false; break; }
          out.blockIntact = intact;
          Atomics.add(ctl, B_DONE, 1); Atomics.notify(ctl, B_DONE);
        }
        out.dllCount = e.get_dll_count();
        out.rows = Array.from({ length: e.get_dll_count() }, (_, i) => dv().getUint32(e.get_dll_table() + i * 32, true));
        parentPort.postMessage(out);
      } catch (error) { parentPort.postMessage({ id: workerData.id, error: String(error && error.stack || error) }); }
    });
  })().catch(error => parentPort.postMessage({ id: workerData.id, error: String(error) }));
} else {
  (async () => {
    // A one-section DLL whose .data holds `payload` at RVA 0x1180.
    function dll(payload) {
      const b = Buffer.alloc(0x400), pe = 0x80, opt = pe + 24, section = opt + 0xe0;
      b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(pe, 0x3c);
      b.writeUInt32LE(0x4550, pe); b.writeUInt16LE(0x14c, pe + 4);
      b.writeUInt16LE(1, pe + 6); b.writeUInt16LE(0xe0, pe + 20);
      b.writeUInt16LE(0x210e, pe + 22); b.writeUInt16LE(0x10b, opt);
      b.writeUInt32LE(0x10000000, opt + 28);
      b.writeUInt32LE(0x1000, opt + 32); b.writeUInt32LE(0x200, opt + 36);
      b.writeUInt32LE(0x2000, opt + 56); b.writeUInt32LE(0x200, opt + 60);
      b.writeUInt32LE(16, opt + 92);
      b.write('.data\0\0\0', section, 'ascii');
      b.writeUInt32LE(0x200, section + 8); b.writeUInt32LE(0x1000, section + 12);
      b.writeUInt32LE(0x200, section + 16); b.writeUInt32LE(0x200, section + 20);
      b.writeUInt32LE(0xc0000040, section + 36);
      b.writeUInt32LE(payload, 0x380);
      return b;
    }
    const module = await WebAssembly.compile(fs.readFileSync(root + '/build/wine-assembly.wasm'));
    const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
    const control = new SharedArrayBuffer(16);
    const fixtures = { a: [dll(0xA1A1A1A1), dll(0xA2A2A2A2)], b: [dll(0xB1B1B1B1)] };
    const workers = [], results = {}, ready = [], done = [];
    const guard = setTimeout(() => { for (const w of workers) w.terminate(); }, 60000);
    try {
      for (const id of ['a', 'b']) {
        const w = new Worker(__filename, { workerData: { id, module, memory, control, fixtures: fixtures[id] } });
        workers.push(w);
        ready.push(new Promise(resolve => w.on('message', m => { if (m.ready) resolve(); })));
        done.push(new Promise(resolve => {
          w.on('message', m => { if (!m.ready) { results[id] = m; resolve(); } });
          w.on('error', error => { results[id] = { id, error: String(error) }; resolve(); });
          w.on('exit', resolve);
        }));
      }
      await Promise.all(ready);
      for (const w of workers) w.postMessage({ go: true });
      await Promise.all(done);
    } finally {
      clearTimeout(guard);
      for (const w of workers) w.terminate();
    }
    const { a, b } = results;
    assert.ok(a && !a.error, `worker a: ${a && a.error}`);
    assert.ok(b && !b.error, `worker b: ${b && b.error}`);

    // 1. Staging and address: each thread's image is its own, at its own place.
    assert.equal(a.first.payload, 0xA1A1A1A1, 'A maps the bytes it staged, not B\'s');
    assert.equal(b.first.payload, 0xB1B1B1B1, 'B maps its own bytes');
    assert.notEqual(a.first.loadAddr, b.first.loadAddr, 'the two images get different addresses');
    assert.ok(a.first.loadAddr + 0x2000 <= b.first.loadAddr || b.first.loadAddr + 0x2000 <= a.first.loadAddr,
      `the two images do not overlap (${a.first.loadAddr.toString(16)} / ${b.first.loadAddr.toString(16)})`);
    assert.notEqual(a.first.pathIndex, b.first.pathIndex, 'each load names its own DLL_TABLE row');
    assert.equal(a.rows[a.first.pathIndex], a.first.loadAddr, 'A\'s row holds A\'s image');
    assert.equal(a.rows[b.first.pathIndex], b.first.loadAddr, 'B\'s row holds B\'s image');

    // 2. Heap: an arena handed out while A was placed does not end up under A.
    assert.equal(a.second.payload, 0xA2A2A2A2, 'A\'s second image is intact');
    assert.ok(b.blockIntact, 'B\'s heap block is not overwritten by A\'s image');
    assert.ok(a.second.loadAddr + 0x2000 <= b.block || b.block + 0x4000 <= a.second.loadAddr,
      `A's image (${a.second.loadAddr.toString(16)}) and B's block (${b.block.toString(16)}) do not overlap`);

    assert.equal(a.dllCount, 3, 'three rows published');
    assert.equal(new Set(a.rows).size, 3, 'three distinct images');
    console.log('PASS test-dll-concurrent-mapping');
  })().catch(error => { console.error(error); process.exit(1); });
}

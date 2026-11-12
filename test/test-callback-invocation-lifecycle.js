#!/usr/bin/env node
'use strict';
// Production artifact and real PE/NE/init_thread exports, with synthetic
// images. No guest game execution and no extracted loader/token helpers.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { BASE } = require('../lib/region-map.generated');
const { pe } = require('./test-dll-lifecycle-real-pe');
const { neLifecycleImage } = require('./helpers/ne-lifecycle-image');
async function main() {
  const bytes = fs.readFileSync(path.join(__dirname, '../build/wine-assembly.wasm'));
  const mod = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const dv = new DataView(memory.buffer), base = BASE.CALLBACK_OWNERSHIP;
  const epoch = () => dv.getBigUint64(base + 8, true);
  const root = tid => dv.getBigUint64(base + 16 + tid * 528, true);
  const tokenBytes = () => Buffer.from(new Uint8Array(memory.buffer, base, 8464));
  const instance = () => {
    const ctx = { getMemory: () => memory.buffer, renderer: null,
      resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} }, onExit() {} };
    const imports = createHostImports(ctx); imports.host.memory = memory;
    imports.host.log_i32 = () => {};
    const x = new WebAssembly.Instance(mod, imports).exports; ctx.exports = x; return x;
  };
  const x = instance(), worker = instance();
  const image = pe([[0x2000, [0xc3]]]);
  const stage = image => new Uint8Array(memory.buffer, x.get_staging(), image.length).set(image);
  const load = () => { stage(image); assert.strictEqual(x.load_pe(image.length), 0x402000); };
  const initWorker = w => w.init_thread(1, x.get_image_base(), x.get_code_start(), x.get_code_end(),
    x.get_thunk_base(), x.get_thunk_end(), x.get_num_thunks(), x.get_rsrc_rva());
  load();
  const firstEpoch = epoch(), firstRoot = root(0);
  assert(firstEpoch > 0n && firstRoot > firstEpoch);
  initWorker(worker);
  const workerRoot = root(1);
  assert(workerRoot > firstRoot);
  worker.test_arena_depth_enter(); worker.test_arena_depth_leave();
  assert.strictEqual(epoch(), firstEpoch);
  assert.strictEqual(root(0), firstRoot);
  const replacement = instance(); initWorker(replacement);
  assert.notStrictEqual(root(1), workerRoot);
  let before = tokenBytes();
  assert.throws(() => worker.test_arena_depth_enter(), WebAssembly.RuntimeError);
  assert.deepStrictEqual(tokenBytes(), before);
  load();
  assert(epoch() > firstEpoch && root(0) > firstRoot);
  before = tokenBytes();
  assert.throws(() => replacement.test_arena_depth_enter(), WebAssembly.RuntimeError);
  assert.deepStrictEqual(tokenBytes(), before);
  // Adapt the ordinary two-segment NE image into a standalone executable.
  const ne = neLifecycleImage();
  ne.writeUInt16LE(1, 0x80 + 12); // clear library flag
  ne.writeUInt16LE(0x100, 0x80 + 0x12); // stack size
  ne.writeUInt16LE(0xff00, 0x80 + 0x18); // initial SP
  ne.writeUInt16LE(2, 0x80 + 0x1a); // initial SS segment
  ne.writeUInt16LE(0, 0x80 + 0x4e); // full 64 KiB data allocation
  const peEpoch = epoch();
  stage(ne);
  assert(x.load_ne(ne.length) > 0, 'actual standalone NE loader accepts fixture');
  assert(epoch() > peEpoch, 'NE process load establishes new lifetime');
  x.test_arena_depth_enter(); x.test_arena_depth_leave();
  const neEpoch = epoch();
  stage(ne);
  assert(x.load_pe(ne.length) > 0, 'PE entry delegates an NE image to real NE loader');
  assert(epoch() > neEpoch);
  console.log('callback invocation lifecycle PASS: production PE/NE/init_thread, same-memory process and thread-slot reuse');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

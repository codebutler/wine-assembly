#!/usr/bin/env node
'use strict';
// Explicit prebuilt-only diagnostic. Never invokes a compiler, runner or guest.
const fs = require('fs');
const crypto = require('crypto');
const assert = require('assert/strict');
const HASH = '8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686';
const SOURCE = 'b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function qualify(bytes) {
  assert.equal(bytes.length, 1879746, 'retained module length');
  assert.equal(sha(bytes), HASH, 'retained module hash; no substitute/build allowed');
}
function targetEvidence(e, target, read) {
  // No watchpoints are armed by this probe. Halt 5 alone is insufficient.
  if (e.get_last_run_halt() !== 5 || (e.get_eip() >>> 0) !== target ||
      (e.get_bp_addr() >>> 0) !== target) return null;
  return read();
}
async function probe(filename) {
  const available = Number(/^MemAvailable:\s+(\d+)/m.exec(fs.readFileSync('/proc/meminfo', 'utf8'))[1]) * 1024;
  assert(available >= 2684354560, 'native admission requires MemAvailable >= 2684354560');
  const bytes = fs.readFileSync(filename); qualify(bytes);
  const mod = await WebAssembly.compile(bytes); // compile retained binary, never WAT/source
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const imports = {}, calls = [], lifecycle = [];
  for (const item of WebAssembly.Module.imports(mod)) {
    const ns = imports[item.module] ||= {};
    if (item.kind === 'memory' && item.module === 'host' && item.name === 'memory') ns[item.name] = memory;
    else if (item.module === 'host' && ['beep_process_begin', 'beep_thread_begin'].includes(item.name)) {
      // init_thread announces its invocation epoch. Historical 04-cache.wat
      // drops this return; the CPU microprogram performs no sound operations.
      ns[item.name] = (...args) => { lifecycle.push({ name: item.name, args }); return 0; };
    } else {
      assert.equal(item.kind, 'function', 'unexpected nonfunction import');
      ns[item.name] = () => { calls.push(item.module + '.' + item.name); throw Error('unexpected host import: ' + calls.at(-1)); };
    }
  }
  const e = (await WebAssembly.instantiate(mod, imports)).exports;
  // Use the real exported initializer, slot 0, with an explicit synthetic code
  // interval. No PE, SDL, networking, host callback or game is loaded.
  const head = 0x7a3462, interior = head + 4, image = 0x400000;
  e.init_thread(0, image, 0x7a3362, head + 0x1000, 0x7500000, 0x7540000, 0, 1);
  const put = (pc, code) => new Uint8Array(memory.buffer, pc - image + 0x12000, code.length).set(code);
  // INC EAX; NOP; NOP; NOP; INC ECX; JMP head. Target is a real
  // instruction boundary four bytes after head, inside the decoded block.
  put(head, [0x40, 0x90, 0x90, 0x90, 0x41, 0xeb, 0xf9]);
  e.set_esp(0x7401000); e.set_ebp(0x7401000);
  const rows = [];
  function observe(name, budget) {
    e.run(budget);
    const row = { name, budget, eip: e.get_eip() >>> 0, halt: e.get_last_run_halt(),
      eax: e.get_eax(), ecx: e.get_ecx(), headCount: e.get_count(0), interiorCount: e.get_count(1),
      guard: e.test_arena_get(11), cacheStores: e.get_cache_stores(), blocks: e.get_last_run_blocks() };
    rows.push(row); return row;
  }
  function reset() { e.set_eip(head); e.set_eax(0); e.set_ecx(0); }
  // Warm real decoded cache/chains without diagnostics, then arm without flush.
  e.set_block_chain(1); reset(); observe('warm-unarmed', 8);
  e.set_count(0, head); e.set_count(1, interior); e.set_bp(interior); reset();
  let row = observe('warm-interior-breakpoint', 8);
  assert.equal(row.guard, 1); assert.equal(e.get_bp_addr(), interior);
  assert.equal(row.halt, 1); assert.equal(row.eip, head);
  assert.equal(row.eax, 8); assert.equal(row.ecx, 8);
  assert.equal(row.headCount, 8); assert.equal(row.interiorCount, 0);
  let snapshotReads = 0;
  const snapshot = () => { snapshotReads++; return { eax: e.get_eax() }; };
  assert.equal(targetEvidence(e, interior, snapshot), null);
  assert.equal(snapshotReads, 0);
  // Enter exactly the same cached interior instruction as a new block head.
  e.set_eip(interior);
  row = observe('explicit-interior-entry', 8);
  assert.equal(row.halt, 5); assert.equal(row.eip, interior);
  assert.equal(row.interiorCount, 0, 'breakpoint precedes counter');
  assert.deepEqual(targetEvidence(e, interior, snapshot), { eax: 8 });
  assert.equal(snapshotReads, 1);
  row = observe('skip-once', 1);
  assert.equal(row.halt, 1); assert.equal(row.eip, head);
  assert.equal(row.ecx, 9); assert.equal(row.interiorCount, 1);
  e.set_eip(interior); row = observe('re-entry-fires-again', 8);
  assert.equal(row.halt, 5); assert.equal(row.interiorCount, 1);
  observe('consume-second-skip', 1);
  // A warm successor must reach run's diagnostics even with chaining enabled.
  e.clear_bp(); e.clear_counts();
  const a = head + 0x100, b = a + 0x10;
  put(a, [0x40, 0xeb, 0x0d]); put(b, [0x41, 0xeb, 0xed]);
  e.set_eip(a); observe('warm-two-block-cycle', 16);
  e.set_count(0, a); e.set_count(1, b); e.set_bp(b); e.set_eip(a);
  row = observe('armed-cached-successor', 8);
  assert.equal(row.halt, 5); assert.equal(row.eip, b);
  assert.equal(row.headCount, 1); assert.equal(row.interiorCount, 0);
  observe('consume-successor-skip', 1);
  // Breakpoint-only benchmark chaining exempts the global debug guard; the
  // transfer's exact EIP comparison must still stop at a cached target.
  e.clear_counts(); e.set_benchmark_chain_bp(1); e.set_eip(a);
  row = observe('benchmark-exact-successor', 8);
  assert.equal(row.guard, 0); assert.equal(row.halt, 5); assert.equal(row.eip, b);
  observe('consume-benchmark-skip', 1);
  e.set_benchmark_chain_bp(0); e.clear_bp(); e.clear_counts();
  // Exact original SDL_net prefix, qualified separately against its pinned
  // file: MOV EBP,EAX; CALL EDI; CMP [EAX],4. This target is a return
  // boundary, unlike the earlier synthetic interior instruction. The callee
  // here is only RET, not the game's errno provider. No call result inferred.
  const originalHead = 0x7a3362, originalTarget = originalHead + 4;
  const callee = head + 0x600, data = image + 0x30000;
  put(originalHead, [0x8b, 0xe8, 0xff, 0xd7, 0x83, 0x38, 0x04]); put(callee, [0xc3]);
  e.set_count(0, originalHead); e.set_count(1, originalTarget); e.set_bp(originalTarget);
  e.set_eip(originalHead); e.set_eax(data); e.set_edi(callee); e.set_ebp(0x7401000);
  e.set_yield_state(1, 0);
  const storesBeforeYield = e.get_cache_stores();
  let blockedSnapshotReads = 0;
  for (let i = 0; i < 972; i++) {
    e.run(1000);
    assert.equal(e.get_last_run_halt(), 4); assert.equal(e.get_eip(), originalHead);
    assert.equal(targetEvidence(e, originalTarget, () => ++blockedSnapshotReads), null);
  }
  row = { name: 'blocked-reentry-972', eip: e.get_eip(), halt: e.get_last_run_halt(),
    headCount: e.get_count(0), interiorCount: e.get_count(1), ebp: e.get_ebp(),
    cacheStoresBefore: storesBeforeYield, cacheStoresAfter: e.get_cache_stores(), blockedSnapshotReads };
  rows.push(row);
  assert.equal(row.headCount, 972); assert.equal(row.interiorCount, 0);
  assert.equal(row.ebp, 0x7401000, 'MOV EBP,EAX did not execute');
  assert.equal(row.cacheStoresBefore, row.cacheStoresAfter, 'blocked before decode');
  assert.equal(blockedSnapshotReads, 0);
  e.set_yield_state(0, 0);
  row = observe('original-prefix-return-boundary', 1000);
  assert.equal(row.eip, originalTarget); assert.equal(row.halt, 5);
  assert.equal(row.headCount, 973); assert.equal(row.interiorCount, 0);
  assert.equal(e.get_ebp(), data, 'MOV executed after clearing blocking yield');
  assert.deepEqual(calls, [], 'no behavioral host substitutes were called');
  return { status: 'pass', qualification: 'retained-native synthetic microprogram; not original gameplay',
    moduleSHA256: HASH, moduleBytes: bytes.length, sourceRevision: SOURCE, memoryBytes: memory.buffer.byteLength,
    node: process.version, memAvailable: available, rows, snapshotReads, hostCalls: calls, lifecycle,
    historicalTargetReachability: 'UNKNOWN', productionDefectProven: false };
}
if (require.main === module) {
  assert.equal(process.argv.length, 3, 'usage: node --max-old-space-size=512 tools/maelstrom-retained-breakpoint-probe.cjs RETAINED.wasm');
  probe(process.argv[2]).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.stack); process.exitCode = 1; });
}
module.exports = { qualify, targetEvidence, probe, HASH, SOURCE, sha };

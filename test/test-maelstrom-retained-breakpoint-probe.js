'use strict';
// Cheap historical-source/provenance and rejecting controls. Explicit native
// qualification is a separate gated invocation of the prebuilt-only probe.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const vm = require('vm');
const { qualify, targetEvidence, sha, HASH } = require('../tools/maelstrom-retained-breakpoint-probe.cjs');
const { transform } = require('../tools/maelstrom-breakpoint-boundary-audit.cjs');
const { classifyTest } = require('../tools/test-tiers.js');
const dir = path.join(__dirname, '../docs/re-notes/maelstrom-recovered-breakpoint-regression-20261024');
const read = n => fs.readFileSync(path.join(dir, n));
const json = n => JSON.parse(read(n));
const unpack = n => zlib.gunzipSync(read(n + '.gz')).toString();
const exportsSource = unpack('13-exports.wat');
const cache = unpack('04-cache.wat'), alu = unpack('05-alu.wat');
assert.equal(sha(exportsSource), '739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86');
assert.equal(sha(cache), '42297da850a44dcaa41a6a94924eb1236b73a10c9b4dde4423802ea8d0806dbd');
assert.equal(sha(alu), 'e70c56e06d7568d5b9a6c09022659ef27ca8ac5eaef56409bf042c7e57a2edb6');
assert.equal(classifyTest(path.basename(__filename)), 'unit');
const runner = zlib.gunzipSync(fs.readFileSync(path.join(dir, '../maelstrom-breakpoint-boundary-audit-20261024/historical-runner.js.gz'))).toString();
assert.equal(sha(runner), '4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809');
const transformed = transform(runner, { enabled: true, exportsSource });
assert.equal(sha(transformed), '6d542cd2c11b24b76bcb1f845a695dce726f7038602f9e8c0b4f172ed5df1ad4');
assert.equal(Buffer.byteLength(transformed), 690739);
new vm.Script(transformed); // no runner execution
const run = exportsSource.slice(exportsSource.indexOf('(func $run '), exportsSource.indexOf('(export "get_last_run_halt")'));
const breakpoint = run.indexOf('(if (i32.eq (global.get $eip) (global.get $bp_addr))');
const counter = run.indexOf('(if (i32.eq (i32.load (local.get $hc_slot)) (global.get $eip))');
const blockingYield = run.indexOf('(if (i32.eq (global.get $yield_reason) (i32.const 16))');
const decode = run.indexOf('(call $decode_run (global.get $eip))');
assert(breakpoint >= 0 && breakpoint < counter && counter < blockingYield && blockingYield < decode,
  'exact historical breakpoint -> count -> blocking-yield -> decode ordering');
assert(run.slice(breakpoint, counter).includes('(global.set $last_run_halt (i32.const 5))'));
assert(run.slice(counter, blockingYield).includes('(i32.add (i32.load offset=4 (local.get $hc_slot)) (i32.const 1))'));
assert(run.slice(blockingYield, decode).includes('(global.set $last_run_halt (i32.const 4))'));
assert(exportsSource.includes('(global.set $dbg_chain_guard (global.get $dbg_any))'));
for (const s of [cache, alu]) {
  assert(s.includes('(global.get $dbg_chain_guard)'));
  assert(s.includes('(i32.eq (global.get $eip) (global.get $bp_addr))'));
}
// Genuine old receipt explicitly tracks DIFFERENT addresses. Never convert
// the passive total into native select calls or missing target snapshots.
const prior = json('prior-boundary.json');
const [arm, first, summary] = prior.rows;
assert.equal(arm.invocation.argument, 0x7a3366); assert.equal(arm.readback, 0x7a3366);
assert.equal(first.eip, 0x679753); assert.equal(first.haltRaw, 3);
assert.equal(summary.lastReturn.eip, 0x75040f8); assert.equal(summary.lastReturn.haltRaw, 4);
assert.equal(summary.lastReturn.selectReturnCounter.address, 0x7a3362);
assert.equal(summary.lastReturn.selectReturnCounter.value, 972);
assert.equal(summary.targetRecords, 0); assert.equal(prior.snapshotBytes, 0);
assert.notEqual(summary.lastReturn.selectReturnCounter.address, arm.readback);
// Retained original DLL: actual target follows an indirect CALL. Do NOT
// promote the synthetic interior example into a finding about the game.
const window = read('sdl-net-window.bin'), meta = json('sdl-net-window.json');
assert.equal(sha(window), meta.windowSHA256); assert.equal(window.length, 96);
assert.equal(meta.runtimeBase + meta.windowRVA, meta.windowRuntimeVA);
assert.equal(meta.windowRuntimeVA + 34, 0x7a3362);
assert.deepEqual([...window.subarray(34, 41)], [0x8b, 0xe8, 0xff, 0xd7, 0x83, 0x38, 0x04]);
assert.throws(() => qualify(Buffer.alloc(0)), /module length/);
assert.throws(() => qualify(Buffer.alloc(1879746)), /module hash/);
// Reject matching EIP with wrong halt, matching halt with wrong EIP/readback,
// and a positive counter by itself, without invoking ANY snapshot callback.
let reads = 0;
for (const [eip, halt, bp] of [[0x7a3366, 3, 0x7a3366], [0x7a3366, 4, 0x7a3366],
  [0x7a3362, 5, 0x7a3366], [0x7a3366, 5, 0x7a3362], [0x7a3362, 4, 0x7a3366]]) {
  const e = { get_eip: () => eip, get_last_run_halt: () => halt, get_bp_addr: () => bp,
    get_count: () => { throw Error('counter is not target evidence'); } };
  assert.equal(targetEvidence(e, 0x7a3366, () => ++reads), null);
}
assert.equal(reads, 0);
assert.equal(targetEvidence({ get_eip: () => 0x7a3366, get_last_run_halt: () => 5,
  get_bp_addr: () => 0x7a3366 }, 0x7a3366, () => ++reads), 1);
for (const guard of ['e.get_last_run_halt() !== 5', '(e.get_eip() >>> 0) !== target',
  '(e.get_bp_addr() >>> 0) !== target']) {
  const altered = targetEvidence.toString().replace(guard, 'false');
  assert.notEqual(altered, targetEvidence.toString());
  const mutated = vm.runInNewContext('(' + altered + ')');
  const [eip, halt, bp] = guard.includes('halt') ? [0x7a3366, 4, 0x7a3366]
    : guard.includes('get_eip') ? [0x7a3362, 5, 0x7a3366] : [0x7a3366, 5, 0x7a3362];
  assert.throws(() => assert.equal(mutated({ get_eip: () => eip, get_last_run_halt: () => halt,
    get_bp_addr: () => bp }, 0x7a3366, () => 'false evidence'), null), undefined, 'guard removal must fail oracle');
}
// Check retained result against explicit native assertions, separately from
// executing it. Removing the halt/counter/source assertions must fail review.
const native = json('native.log'), terminal = json('native-terminal.json');
assert.equal(native.status, 'pass'); assert.equal(native.moduleSHA256, HASH);
assert.equal(native.memoryBytes, 536870912); assert.deepEqual(native.hostCalls, []);
assert.equal(terminal.returncode, 0); assert.equal(terminal.reason, 'natural'); assert.equal(terminal.remainingGroup, false);
const byName = Object.fromEntries(native.rows.map(row => [row.name, row]));
const blocked = byName['blocked-reentry-972'];
assert.equal(blocked.headCount, 972); assert.equal(blocked.interiorCount, 0);
assert.equal(blocked.halt, 4); assert.equal(blocked.eip, 0x7a3362); assert.equal(blocked.blockedSnapshotReads, 0);
assert.equal(blocked.cacheStoresBefore, blocked.cacheStoresAfter);
assert.equal(byName['original-prefix-return-boundary'].halt, 5);
assert.equal(byName['original-prefix-return-boundary'].eip, 0x7a3366);
assert.equal(native.historicalTargetReachability, 'UNKNOWN'); assert.equal(native.productionDefectProven, false);
console.log('PASS: exact historical ordering, actual counter/target distinction, original CALL boundary, sealed retained-native observations, rejecting evidence/module controls; no native launch by this test');

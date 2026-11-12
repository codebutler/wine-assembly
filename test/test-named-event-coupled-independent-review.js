'use strict';
// Independent assertions, reusing only the candidate's source-slice plumbing.
// Production RPC/ThreadManager/CLI source remains unchanged. No full VM claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const cp = require('node:child_process');
const file = path.join(__dirname, 'test-named-event-cli-end-to-end.js');
let text = fs.readFileSync(file, 'utf8');
const reviewMutant = process.argv.find(a => a.startsWith('--review-mutant='))?.split('=')[1];
if (reviewMutant === 'digest') {
  const needle = ": fs.readFileSync(path.join(root, file), 'utf8');";
  assert(text.includes(needle));
  text = text.replace(needle, ": fs.readFileSync(path.join(root, file), 'utf8').replace('waitDigest(waitEntry).every((word, i) => word === v.i32[WAIT_DIGEST[i]])', 'true');");
}
const tail = "main().catch(e => { console.error(e); process.exitCode = 1; });";
assert(text.endsWith(tail + '\n'));
const fixtureModule = new Module(file, module);
fixtureModule.filename = file;
fixtureModule.paths = Module._nodeModulePaths(__dirname);
fixtureModule._compile(text.replace(tail, 'module.exports = { workerFixture };'), file);
const { workerFixture } = fixtureModule.exports;
const RPC = require('../lib/guest-rpc');
let { WorkerLink } = require('../lib/guest-thread-host');
if (reviewMutant === 'forwarding') {
  const hostFile = path.join(__dirname, '../lib/guest-thread-host.js');
  const source = fs.readFileSync(hostFile, 'utf8');
  const needle = "this._ask({ t: 'completeWait', result, waitStackBytes, waitToken, namedWaitSequence })";
  assert(source.includes(needle));
  const mod = new Module(hostFile, module); mod.filename = hostFile;
  mod.paths = Module._nodeModulePaths(path.dirname(hostFile));
  mod._compile(source.replace(needle, "this._ask({ t: 'completeWait', result, waitStackBytes, waitToken })"), hostFile);
  WorkerLink = mod.exports.WorkerLink;
}
async function main() {
  const authority = cp.fork(file, ['--authority'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
  process.env.WINE_NAMED_EVENT_ENDPOINT = JSON.stringify(await new Promise(resolve => authority.once('message', resolve)));
  const f = await workerFixture(6);
  try {
    const h = f.create(false, true);
    const words = new Int32Array(f.memory.buffer, RPC.RPC_BASE + 6 * RPC.RPC_STRIDE, RPC.CTRL_INTS);
    for (const field of ['version', 'sequence', 'slot', 'handle', 'timeout']) {
      f.tm.setEvent(h);
      const reply = await f.call(h, 1000, { mutate: e => ({ ...e, [field]: e[field] + 1 }) });
      assert(reply.error, field + ' mismatch must reject');
      assert.equal(f.tm.waitSingle(h, 0), 0, field + ' rejection preserves signal');
    }
    // Alter only the published digest, leaving the notification valid.
    f.tm.setEvent(h);
    const digestReply = await f.call(h, 1000, { mutate: e => { words[28] ^= 1; return e; } });
    assert(digestReply.error, 'digest-only mismatch must reject');
    assert.equal(f.tm.waitSingle(h, 0), 0);
    // Same Worker must recover with a new identity after malformed delivery.
    f.tm.setEvent(h); assert.equal((await f.call(h, 1000)).result, 0);

    // Explicitly witness the documented unreserved interval. Pulse within
    // delivery delay is lost; registration still retains the original budget.
    const before = f.tm._eventClient().registerWait.bind(f.tm._eventClient());
    let registers = 0, statuses = 0;
    f.tm._eventClient().registerWait = (...a) => { registers++; return before(...a); };
    const oldStatus = f.tm._eventClient().waitStatus.bind(f.tm._eventClient());
    f.tm._eventClient().waitStatus = (...a) => { statuses++; return oldStatus(...a); };
    const waiting = await f.call(h, 1000, { delay: 40, mutate: e => {
      assert.equal(registers, 0);
      f.tm.setEvent(h); f.tm.resetEvent(h); return e;
    } });
    assert.equal(waiting.result, 65535, 'entry gap is explicitly unreserved');
    const r = { waitHandle: h, waitTimeout: 1000, waitStackBytes: 12, namedWaitSequence: waiting.namedWaitSequence };
    for (let i = 0; i < 3; i++) assert.equal(f.tm.resolveWait(r, {}, { threadId: 7 }), null);
    assert.equal(registers, 1); assert.equal(statuses, 3);
    f.tm.setEvent(h); f.tm.resetEvent(h);
    const done = f.tm.resolveWait(r, {}, { threadId: 7 });
    assert.equal(done.result, 0, 'post-registration pulse is reserved');
    assert.equal(registers, 1);

    // Exercise real production WorkerLink.completeWait marshalling and the
    // real ThreadManager scheduler completion together, not a hand-built msg.
    const link = Object.create(WorkerLink.prototype);
    let completed;
    link._ask = async msg => { completed = await f.complete(msg); return completed; };
    await assert.doesNotReject(() => f.tm._completeWorkerWait({ link }, r, done),
      'scheduler and WorkerLink must preserve reservation identity through completion');
    assert.equal(completed.esp, 268); assert.equal(completed.clears, 1);
    await assert.rejects(() => f.tm._completeWorkerWait({ link }, r, done), /ownership mismatch/);
    assert.equal(completed.esp, 268); assert.equal(completed.clears, 1);
    // Old completion during a later invocation must neither complete it nor
    // retire its authority reservation.
    const next = await f.call(h, 1000);
    assert.equal(next.result, 65535);
    const stale = await f.complete({ ...done, namedWaitSequence: waiting.namedWaitSequence });
    assert(stale.ownershipMismatch); assert.equal(stale.clears, 1);
    const nextR = { ...r, namedWaitSequence: next.namedWaitSequence };
    assert.equal(f.tm.resolveWait(nextR, {}, { threadId: 7 }), null);
    // Close/recreate must keep the old cancellation separate from new signal.
    f.tm.closeEvent(h);
    const cancelled = f.tm.resolveWait(nextR, {}, { threadId: 7 });
    assert.equal(cancelled.result, 0xffffffff);
    await f.tm._completeWorkerWait({ link }, nextR, cancelled);
    assert.equal(completed.clears, 2); assert.equal(completed.esp, 280);
    const fresh = f.create(false, true);
    assert.equal((await f.call(fresh, 0)).result, 0);
    f.tm.setEvent(fresh);
    Atomics.store(words, RPC.SLOT.WAIT_SEQUENCE, 0x7fffffff);
    assert((await f.call(fresh, 100)).error, 'sequence exhaustion must reject before wrap');
    assert.equal(f.tm.waitSingle(fresh, 0), 0);
    // Exhaustion does not disable ordinary zero-time probes.
    f.tm.setEvent(fresh); assert.equal((await f.call(fresh, 0)).result, 0);
    console.log('PASS independent coupled identity/digest, entry gap, register-once/status-only, WorkerLink completion, stale invocation, close and exhaustion');
    // Two real Workers, separate clients, same named authority object.
    const g = await workerFixture(7);
    try {
      Atomics.store(words, RPC.SLOT.WAIT_SEQUENCE, 10000);
      for (const manual of [false, true]) {
        const name = `independent-shared-${process.pid}-${manual}`;
        const a = f.tm.createEvent(manual, false, name) & 0x7fffffff;
        const b = g.tm.createEvent(manual, false, name) & 0x7fffffff;
        const ar = await f.call(a, 1000), br = await g.call(b, 1000);
        assert.equal(ar.result, 65535); assert.equal(br.result, 65535);
        const af = { waitHandle: a, waitTimeout: 1000, waitStackBytes: 12, namedWaitSequence: ar.namedWaitSequence };
        const bf = { waitHandle: b, waitTimeout: 1000, waitStackBytes: 12, namedWaitSequence: br.namedWaitSequence };
        f.tm.setEvent(a); f.tm.resetEvent(a);
        assert.equal(f.tm.resolveWait(af, {}, { threadId: 7 }).result, 0);
        const bd = g.tm.resolveWait(bf, {}, { threadId: 8 });
        if (manual) assert.equal(bd.result, 0);
        else {
          assert.equal(bd, null, 'auto pulse commits exactly one Worker');
          g.tm.setEvent(b); g.tm.resetEvent(b);
          assert.equal(g.tm.resolveWait(bf, {}, { threadId: 8 }).result, 0);
        }
        assert(!(await f.complete({ result: 0, waitStackBytes: 12, namedWaitSequence: ar.namedWaitSequence })).ownershipMismatch);
        assert(!(await g.complete({ result: 0, waitStackBytes: 12, namedWaitSequence: br.namedWaitSequence })).ownershipMismatch);
        f.tm.closeEvent(a); g.tm.closeEvent(b);
      }
      console.log('PASS independent two-Worker shared-object manual-all/auto-one Set-Reset');
    } finally { await g.close(); }
  } finally {
    await f.close(); authority.send('close');
    await new Promise(resolve => authority.once('exit', resolve));
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });

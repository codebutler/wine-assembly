'use strict';
// Consumer-boundary diagnostic only; NOT a proposed timestamp transport.
// Production Worker RPC, CLI adapter and ThreadManager acquisition are retained.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const { ThreadManager } = require('../lib/thread-manager');
const RPC = require('../lib/guest-rpc');
const cli = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
const start = cli.indexOf('    wh.wait_single = (handle, timeout) => {');
const end = cli.indexOf('\n    };', start) + 7;
assert(start > 0 && end > start);
const install = new Function('wh', 'workerInstance', 'threadManager', 'tid', 'h', cli.slice(start, end));

async function probe(delayAfterValidation) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const tm = new ThreadManager({}, memory, { exports: { get_sync_table: () => 0 } }, () => ({ host: {} }));
  tm._log = () => {};
  tm.enableNamedEventAuthority();
  const handle = tm.createEvent(false, true, `entry-boundary-${process.pid}-${delayAfterValidation}`) & 0x7fffffff;
  const client = tm._eventClient();
  const ref = tm._authorityEvents.get(handle).refs[0];
  const wh = {};
  install(wh, null, tm, 7, {});
  const sigs = { wait_single: { params: ['i32', 'i32'], results: ['i32'] } };
  const errors = [];
  const broker = RPC.createMainBroker(memory, wh, sigs, { onError: (name, e) => errors.push(e.message) });
  // Deliberate diagnostic sideband from immediately BEFORE the import, not
  // production entry capture, shared ABI, or a versioned transport design.
  const worker = new Worker(`
    const { parentPort, workerData: d } = require('node:worker_threads');
    const fs = require('node:fs');
    if (process.platform !== 'linux' || process.versions.node !== '24.18.1' ||
        process.versions.uv !== '1.52.1') throw Error('ECLOCKSCOPE');
    const domain = 'linux-monotonic:' + fs.readFileSync('/proc/sys/kernel/random/boot_id', 'utf8').trim()
      + ':' + fs.readlinkSync('/proc/thread-self/ns/time');
    const RPC = require(d.rpc);
    const host = RPC.createWorkerImports(d.memory, d.sigs, m => parentPort.postMessage(m),
      { slot: 0, getSyncMsgDepth: () => 0 }).imports.host;
    const tick = process.hrtime.bigint().toString();
    parentPort.postMessage({ diagnosticClock: { domain, tick } });
    const result = host.wait_single(d.handle, 50) >>> 0;
    parentPort.postMessage({ result });
  `, { eval: true, workerData: { memory, sigs, handle, rpc: require.resolve('../lib/guest-rpc') } });
  let clock, stamp, atValidation, atAcquire;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('watchdog')), 10000);
      const fail = e => { clearTimeout(timer); reject(e); };
      worker.on('error', fail);
      worker.on('message', async m => {
        try {
          if (m.diagnosticClock) { clock = m.diagnosticClock; return; }
          if (m.t === 'rpc') {
            assert(clock);
            if (!delayAfterValidation) await sleep(180);
            // Existing provider wire request, not waitClock's re-sampling API.
            stamp = client._call({ op: 'waitClock', callerClock: clock });
            assert.deepEqual(stamp.callerClock, clock);
            atValidation = client.waitClock();
            assert.equal(atValidation.epoch, stamp.epoch);
            if (delayAfterValidation) assert(BigInt(atValidation.tick) < BigInt(stamp.tick) + 50000000n,
              'fixture must validate before expiry to demonstrate the check/acquire gap');
            if (delayAfterValidation) await sleep(180);
            atAcquire = client.waitClock();
            assert(BigInt(atAcquire.tick) >= BigInt(stamp.tick) + 50000000n);
            // An expired qualified stamp is legal and retains its exact tick.
            const repeated = client._call({ op: 'waitClock', callerClock: clock });
            assert.deepEqual(repeated, stamp);
            // Authority validation rejects a foreign domain, without acquiring.
            assert.throws(() => client._call({ op: 'waitClock', callerClock: {
              ...clock, domain: clock.domain + ':foreign',
            } }), e => e.code === 'ECLOCKSCOPE');
            assert.equal(broker.serveRpc(m.slot), true);
          } else { clearTimeout(timer); resolve(m.result); }
        } catch (e) { fail(e); }
      });
    });
    assert.deepEqual(errors, []);
    assert.equal(result, 0, 'unchanged CLI acquire ignores even a validated expired stamp');
    assert.equal(client.acquire(ref), false, 'unchanged adapter consumed the auto-reset signal');
    // The existing deadline-aware provider primitive DOES enforce this stamp.
    client.set(ref);
    const reservation = client.registerWait(ref, 50, stamp);
    assert.equal(reservation.state, 'timed-out');
    client.forgetWait(reservation.waitId);
    assert.equal(client.acquire(ref), true, 'registration preserved the signal');
    console.log(JSON.stringify({ mode: delayAfterValidation ? 'delay-after-validation' : 'delay-before-validation',
      clock, stamp, atValidation, atAcquire, result, reservedResult: reservation.state }));
    if (process.argv.includes('--require-entry-budget')) {
      assert.equal(result, 0x102, 'BLOCKED ACCEPTANCE: timestamp validation alone does not constrain CLI acquire');
    }
  } finally {
    await worker.terminate();
    tm.closeEvent(handle);
  }
}

(async () => {
  await probe(false);
  await probe(true);
  console.log('PASS consumer-boundary diagnostic only; transport prerequisite NOT IMPLEMENTED');
})().catch(e => { console.error(e); process.exitCode = 1; });

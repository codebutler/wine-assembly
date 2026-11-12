'use strict';
// BLOCKER reproducer, not reservation/CLI acceptance. No full VM is booted.
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
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function probe(lateReservation) {
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const tm = new ThreadManager({}, memory, { exports: { get_sync_table: () => 0 } }, () => ({ host: {} }));
  tm._log = () => {};
  tm.enableNamedEventAuthority();
  const handle = tm.createEvent(false, true, 'reserved-entry-' + process.pid + '-' + lateReservation) & 0x7fffffff;
  const client = tm._eventClient();
  let reservation;
  // Explicit near-miss control: merely substituting accepted provider calls
  // at the broker's existing adapter cannot recover the missing entry instant.
  // This is NOT a proposed production implementation or independent model.
  if (lateReservation) tm.waitSingle = (h, timeout) => {
    const clock = client.waitClock({ callerEntry: true });
    reservation = client.registerWait(tm._authorityEvents.get(h).refs[0], timeout, clock);
    return reservation.state === 'signaled' ? 0 : 0xffffffff;
  };
  const wh = {};
  install(wh, null, tm, 7, {});
  const productionAdapter = wh.wait_single;
  let receivedArgs;
  wh.wait_single = (...args) => { receivedArgs = args; return productionAdapter(...args); };
  const sigs = { wait_single: { params: ['i32', 'i32'], results: ['i32'] } };
  const broker = RPC.createMainBroker(memory, wh, sigs, { onError: (n, e) => { throw e; } });
  const w = new Worker(`
    const { parentPort, workerData: d } = require('node:worker_threads');
    const RPC = require(d.rpc);
    const h = RPC.createWorkerImports(d.memory, d.sigs, m => parentPort.postMessage(m),
      { slot: 0, getSyncMsgDepth: () => 0 }).imports.host;
    const entry = process.hrtime.bigint();
    const result = h.wait_single(d.handle, 50) >>> 0;
    parentPort.postMessage({ result, elapsedMs: Number(process.hrtime.bigint() - entry) / 1e6 });
  `, { eval: true, workerData: { memory, sigs, handle, rpc: require.resolve('../lib/guest-rpc') } });
  try {
    const result = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('reproducer watchdog')), 10000);
      w.on('error', e => { clearTimeout(timer); reject(e); });
      w.on('message', async m => {
        if (m.t === 'rpc') {
          // Delay delivery to the real broker, after the Worker entered its
          // real host import and posted the production RPC notification.
          await delay(180);
          try { broker.serveRpc(m.slot); } catch (e) { clearTimeout(timer); reject(e); }
        } else { clearTimeout(timer); resolve(m); }
      });
    });
    assert.deepEqual(receivedArgs, [handle, 50], 'broker receives no caller-entry stamp');
    assert(result.elapsedMs >= 180, 'all injected transport delay precedes adapter entry');
    assert.equal(result.result, 0, 'reproduce late success after the actual caller budget expired');
    console.log(JSON.stringify({ mode: lateReservation ? 'provider-at-broker-near-miss' : 'production-adapter', ...result, receivedArgs }));
    if (process.argv.includes('--require-entry-budget')) {
      assert.equal(result.result, 0x102, 'ACCEPTANCE GATE: expired guest-entry budget must not acquire');
    }
  } finally {
    await w.terminate();
    if (reservation) client.forgetWait(reservation.waitId);
    tm.closeEvent(handle);
  }
}

(async () => {
  await probe(false);
  await probe(true);
  console.log('PASS blocker reproduced: ordinary Worker entry timestamp is absent before CLI adapter; CLI NOT ACCEPTED');
})().catch(e => { console.error(e); process.exitCode = 1; });

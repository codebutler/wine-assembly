'use strict';
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const { Worker } = require('node:worker_threads');
const { NamedEventAuthority, NamedEventClient } = require('../lib/named-event-authority');

if (process.argv[2] === 'child') {
  const client = new NamedEventClient(JSON.parse(process.argv[3]));
  process.on('message', ({ id, op, args }) => {
    let callbackRan = false;
    setImmediate(() => { callbackRan = true; });
    try {
      const value = client[op](...args);
      // Every response was obtained with the caller's event loop blocked.
      assert.equal(callbackRan, false);
      process.send({ id, value });
    } catch (error) { process.send({ id, error: error.code || error.message }); }
  });
  process.send({ ready: true, pid: process.pid });
} else {
  const children = [];
  const authorities = [];
  let sequence = 0;
  async function child(endpoint) {
    const proc = fork(__filename, ['child', JSON.stringify(endpoint)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    children.push(proc);
    const ready = await once(proc, 'message');
    assert.equal(ready[0].ready, true);
    return { proc, call(op, ...args) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { cleanup(); reject(new Error('child deadline')); }, 7000);
        function cleanup() { clearTimeout(timer); proc.off('message', response); proc.off('exit', exited); }
        function exited() { cleanup(); reject(new Error('child exited')); }
        function response(message) {
          if (message.id !== id) return;
          cleanup();
          if (message.error) reject(Object.assign(new Error(message.error), { code: message.error }));
          else resolve(message.value);
        }
        proc.on('message', response); proc.once('exit', exited);
        proc.send({ id, op, args });
      });
    } };
  }
  function authority() { const a = new NamedEventAuthority(); authorities.push(a); return a; }
  async function main() {
    const a = authority();
    const x = await child(a.endpoint), y = await child(a.endpoint);
    assert.notEqual(x.proc.pid, y.proc.pid);
    const first = await x.call('create', 'progress');
    const second = await y.call('open', 'progress');
    assert.equal(first.generation, second.generation);
    await y.call('set', second.handle);
    assert.equal(await x.call('acquire', first.handle), true);
    console.log('PASS transport progress: two forked clients, synchronous calls complete before main-thread callbacks');
    if (process.argv.includes('--progress-only')) return;

    if (process.argv.includes('--independent-control')) {
      const independentAuthority = authority();
      const independentClient = await child(independentAuthority.endpoint);
      const mirrored = await independentClient.call('create', 'progress', false, true);
      await x.call('set', first.handle);
      const results = await Promise.all([x.call('acquire', first.handle), independentClient.call('acquire', mirrored.handle)]);
      console.log('Independent-authority control results:', results);
      assert.equal(results.filter(Boolean).length, 1, 'independent mirrored authorities must fail the one-consumer oracle');
      return;
    }

    const duplicate = await x.call('create', 'progress', true, true);
    assert.equal(duplicate.existed, true);
    assert.equal(await x.call('acquire', duplicate.handle), false);
    for (let i = 0; i < 40; i++) {
      await x.call('set', first.handle);
      const results = await Promise.all([x.call('acquire', first.handle), y.call('acquire', second.handle)]);
      assert.equal(results.filter(Boolean).length, 1);
    }
    await y.call('set', second.handle); await x.call('set', first.handle);
    assert.equal(await x.call('acquire', first.handle), true);
    assert.equal(await y.call('acquire', second.handle), false);
    await y.call('set', second.handle); await x.call('reset', first.handle);
    assert.equal(await y.call('acquire', second.handle), false);
    console.log('PASS auto reset: 40 two-process races have exactly one winner, repeated set coalesces, reset shared');

    const m = await x.call('create', 'manual', true, true);
    const n = await y.call('open', 'manual');
    assert.deepEqual(await Promise.all([x.call('acquire', m.handle), y.call('acquire', n.handle)]), [true, true]);
    assert.equal(await x.call('acquire', m.handle), true);
    await y.call('reset', n.handle);
    assert.deepEqual(await Promise.all([x.call('acquire', m.handle), y.call('acquire', n.handle)]), [false, false]);
    await x.call('set', m.handle);
    assert.deepEqual(await Promise.all([x.call('acquire', m.handle), y.call('acquire', n.handle)]), [true, true]);
    assert.equal(await y.call('acquire', second.handle), false);
    console.log('PASS manual reset broadcast/persistence/reset and unrelated name isolation');

    await assert.rejects(y.call('set', first.handle), { code: 'EBADHANDLE' });
    await x.call('close', first.handle);
    await assert.rejects(x.call('acquire', first.handle), { code: 'EBADHANDLE' });
    await y.call('close', second.handle);
    const surviving = await y.call('open', 'progress');
    assert.equal(surviving.generation, first.generation);
    await y.call('close', surviving.handle); await x.call('close', duplicate.handle);
    await assert.rejects(y.call('open', 'progress'), { code: 'ENOENT' });
    const recreated = await y.call('create', 'progress', false, false);
    assert.notEqual(recreated.generation, first.generation);
    await assert.rejects(x.call('set', first.handle), { code: 'EBADHANDLE' });
    assert.equal(await y.call('acquire', recreated.handle), false);
    console.log('PASS owned references, partial close, last close, generation recreation and stale handle rejection');

    await x.call('create', 'shutdown-only');
    await x.call('shutdown');
    await assert.rejects(y.call('open', 'shutdown-only'), { code: 'ENOENT' });
    await assert.rejects(x.call('open', 'manual'), { code: 'ECLOSED' });
    const z = await child(a.endpoint);
    const orphan = await z.call('create', 'crash-only');
    const held = await z.call('open', 'manual');
    const exited = once(z.proc, 'exit'); z.proc.kill('SIGKILL'); await exited;
    // EOF cleanup is asynchronous at the server. Bound eventual reclamation.
    let gone = false;
    for (let i = 0; i < 100; i++) {
      try { const r = await y.call('open', 'crash-only'); await y.call('close', r.handle); }
      catch (e) { assert.equal(e.code, 'ENOENT'); gone = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(gone, true);
    const fresh = await y.call('create', 'crash-only');
    assert.notEqual(fresh.generation, orphan.generation);
    assert.equal(held.generation, n.generation);
    assert.equal(await y.call('acquire', n.handle), true);
    console.log('PASS explicit shutdown and SIGKILL session cleanup, survivor references retained');

    const local = new NamedEventClient(a.endpoint);
    assert.throws(() => local.create(''), { code: 'EINVAL' });
    assert.throws(() => local.create('bad', 1), { code: 'EINVAL' });
    assert.throws(() => new NamedEventClient({ ...a.endpoint, token: 'wrong' }), { code: 'EAUTH' });
    const b = authority();
    const wrong = new NamedEventClient(b.endpoint);
    const independent = wrong.create('progress', false, true);
    await y.call('set', recreated.handle);
    const mirrored = [await y.call('acquire', recreated.handle), wrong.acquire(independent.handle)];
    assert.throws(() => assert.equal(mirrored.filter(Boolean).length, 1));
    wrong.shutdown();
    console.log('PASS independent-authority control REJECTED: two successes cannot satisfy one-consumer oracle');
    await a.close();
    assert.throws(() => local.open('manual'), { code: 'ECONNECTION' });
    assert.throws(() => local.open('manual'), { code: 'ECLOSED' });
    console.log('PASS authority loss fails closed');

    // Actual socket peer completes hello but deliberately never answers the next
    // operation. Its worker keeps running while this test thread is blocked.
    const blackholePath = require('node:path').join(b.directory, 'blackhole');
    const ready = new SharedArrayBuffer(4);
    const blackhole = new Worker(`
      const {workerData} = require('node:worker_threads');
      require('node:net').createServer(s => {
        let first = true;
        s.on('data', () => { if (first) { first = false; s.write('{"value":true}\\n'); } });
      }).listen(workerData.path, () => { const a = new Int32Array(workerData.ready); Atomics.store(a,0,1); Atomics.notify(a,0); });
    `, { eval: true, workerData: { path: blackholePath, ready } });
    try {
      assert.notEqual(Atomics.wait(new Int32Array(ready), 0, 0, 3000), 'timed-out');
      const stalled = new NamedEventClient({ path: blackholePath, token: '' }, { timeoutMs: 100 });
      const start = performance.now();
      assert.throws(() => stalled.create('unknown-outcome'), { code: 'ETIMEDOUT' });
      assert.ok(performance.now() - start < 2000);
      assert.throws(() => stalled.open('unknown-outcome'), { code: 'ECLOSED' });
      console.log('PASS unresponsive live peer: bounded timeout and poisoned client');
    } finally { await blackhole.terminate(); }
  }
  const watchdog = setTimeout(() => { console.error('global test deadline'); process.exit(1); }, 30000);
  main().then(() => console.log('PASS named-event authority suite')).catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    for (const proc of children) if (proc.exitCode === null && proc.signalCode === null) proc.kill();
    await Promise.all(authorities.map(a => a.close()));
    clearTimeout(watchdog);
  });
}

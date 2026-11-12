'use strict';
// Independent protocol tests. PROVIDER selects sealed fault/clock copies only.
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { Worker, isMainThread, workerData, parentPort } = require('node:worker_threads');
const { once } = require('node:events');
const path = require('node:path');
const provider = process.env.PROVIDER || path.resolve(__dirname, '../lib/named-event-authority.js');
const { NamedEventAuthority, NamedEventClient } = require(provider);
const mode = process.argv[2] || 'normal';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const actor = !isMainThread && workerData?.independentActor || mode === 'actor';
if (actor) {
  const c = new NamedEventClient(isMainThread ? JSON.parse(process.argv[3]) : workerData.endpoint);
  const port = isMainThread ? process : parentPort;
  const send = v => isMainThread ? process.send(v) : port.postMessage(v);
  port.on('message', ({ op, args }) => {
    try { send({ value: c[op](...args) }); } catch (e) { send({ error: e.code || e.message }); }
  });
  send({ ready: true });
} else {
  const actors = [], clients = [], authorities = [];
  let groups = 0;
  const pass = s => console.log('PASS ' + (++groups) + ' ' + s);
  const auth = () => { const a = new NamedEventAuthority(); authorities.push(a); return a; };
  const client = a => { const c = new NamedEventClient(a.endpoint); clients.push(c); return c; };
  const reg = (c, h, ms = 10000, clock = c.waitClock()) => c.registerWait(h, ms, clock);
  const state = (c, w) => c.waitStatus(w.waitId).state;
  async function peer(a, thread) {
    const p = thread ? new Worker(__filename, { workerData: { independentActor: true, endpoint: a.endpoint } })
      : fork(__filename, ['actor', JSON.stringify(a.endpoint)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    actors.push(p); assert.equal((await once(p, 'message'))[0].ready, true);
    return async (op, ...args) => {
      const response = once(p, 'message');
      if (thread) p.postMessage({ op, args }); else p.send({ op, args });
      const [r] = await response;
      if (r.error) throw Object.assign(new Error(r.error), { code: r.error });
      return r.value;
    };
  }
  async function run() {
    const a = auth(), c = client(a);
    if (mode.startsWith('fault-')) {
      const op = mode.slice(6), d = client(a), h = c.create('fault', false, op === 'registerWait');
      const dh = d.open('fault');
      let w;
      if (op !== 'registerWait') {
        w = reg(c, h.handle);
        if (op === 'waitStatus' || op === 'forgetWait') d.set(dh.handle);
      }
      c.timeoutMs = 120;
      const clock = op === 'registerWait' ? c.waitClock() : null;
      assert.throws(() => op === 'registerWait' ? c.registerWait(h.handle, 10000, clock)
        : op === 'set' ? c.set(h.handle) : c[op](w.waitId), { code: 'ETIMEDOUT' });
      assert.equal(c.closed, true);
      assert.throws(() => c.waitClock(), { code: 'ECLOSED' });
      assert.equal(d.acquire(dh.handle), false, 'no refund of assignment / no invented signal');
      d.set(dh.handle); await sleep(180);
      assert.equal(d.acquire(dh.handle), true, 'poisoned client must not replay against newer signal');
      assert.equal(d.acquire(dh.handle), false);
      pass('committed ' + op + ' lost reply poisons without replay'); return;
    }
    if (mode.startsWith('delay-')) {
      const h = c.create('delay', false, true), start = performance.now();
      const clock = c.waitClock();
      const w = reg(c, h.handle, 50, clock);
      const elapsed = performance.now() - start;
      assert.ok(elapsed >= 150, elapsed);
      if (mode === 'delay-inbound-clock') {
        assert.equal(w.state, 'signaled', 'authority interval starts AFTER inbound delay');
        assert.equal(c.acquire(h.handle), false);
      } else {
        assert.equal(w.state, 'timed-out');
        assert.equal(c.acquire(h.handle), true, 'response or registration transit exhausts stamped budget');
      }
      console.log(JSON.stringify({ mode, elapsed, state: w.state }));
      pass('measured transport timing contract; caller-entry timeout NOT solved'); return;
    }
    if (mode === 'boundary') {
      for (const offset of [-1n, 0n, 1n]) {
        const start = 1000000000n + (offset + 1n) * 100000000n;
        c._call({ op: '__tick', tick: String(start) });
        const h = c.create('edge' + offset), clock = c.waitClock(), w = reg(c, h.handle, 10, clock);
        c._call({ op: '__tick', tick: String(start + 10000000n + offset) });
        c.set(h.handle); c.reset(h.handle);
        assert.equal(state(c, w), offset < 0n ? 'signaled' : 'timed-out');
        c.set(h.handle);
        const immediate = reg(c, h.handle, 10, clock);
        assert.equal(immediate.state, offset < 0n ? 'signaled' : 'timed-out');
        assert.equal(c.acquire(h.handle), offset >= 0n);
        c._call({ op: '__tick', tick: String(start + 50000000n) });
        assert.equal(state(c, w), offset < 0n ? 'signaled' : 'timed-out');
        c.forgetWait(w.waitId); c.forgetWait(immediate.waitId);
      }
      pass('Set and immediate registration at -1/equal/+1 ns; retained outcome after expiry'); return;
    }
    const p = await peer(a, false), t = await peer(a, true), observations = [];
    for (const manual of [true, false]) {
      const h = c.create('mixed-' + manual, manual), ph = await p('open', 'mixed-' + manual), th = await t('open', 'mixed-' + manual);
      let wp, wt;
      if (process.env.LEGACY_POLL) {
        assert.equal(await p('acquire', ph.handle), false); assert.equal(await t('acquire', th.handle), false);
      } else {
        const clock = c.waitClock();
        [wp, wt] = await Promise.all([p('registerWait', ph.handle, 10000, clock), t('registerWait', th.handle, 10000, clock)]);
        assert.equal(wp.state, 'pending'); assert.equal(wt.state, 'pending');
      }
      c.set(h.handle); c.reset(h.handle);
      const values = process.env.LEGACY_POLL ? await Promise.all([p('acquire', ph.handle), t('acquire', th.handle)])
        : (await Promise.all([p('waitStatus', wp.waitId), t('waitStatus', wt.waitId)])).map(v => v.state === 'signaled');
      observations.push(values.filter(Boolean).length);
      console.log(JSON.stringify({ manual, mixedProcessWorkerWinners: values }));
      if (!process.env.LEGACY_POLL) {
        c.set(h.handle); // second Set assigns the remaining auto waiter, manual stays set
        assert.equal((await p('waitStatus', wp.waitId)).state, 'signaled');
        assert.equal((await t('waitStatus', wt.waitId)).state, 'signaled');
        assert.equal(c.acquire(h.handle), manual);
        c.reset(h.handle);
        assert.equal((await p('cancelWait', wp.waitId)).state, 'signaled');
        assert.equal(c.acquire(h.handle), false, 'cancellation after assignment cannot refund a wake');
        c.set(h.handle);
        for (let i = 0; i < 4; i++) {
          assert.equal((await p('cancelWait', wp.waitId)).state, 'signaled');
          assert.equal((await t('waitStatus', wt.waitId)).state, 'signaled');
        }
        assert.equal(c.acquire(h.handle), true); c.reset(h.handle);
        await p('forgetWait', wp.waitId); await t('forgetWait', wt.waitId);
      }
    }
    assert.deepEqual(observations, [2, 1], 'manual AND auto pulse reservation oracle');
    pass('mixed actual subprocess/Worker pulses, repeated Set and idempotent terminal operations');
    if (mode === 'pulse') return;
    const d = client(a), h = c.create('identity'), duplicate = c.open('identity'), dh = d.open('identity');
    const w = reg(c, h.handle), keep = reg(c, duplicate.handle);
    for (const op of ['waitStatus', 'cancelWait', 'forgetWait']) assert.throws(() => d[op](w.waitId), { code: 'EBADWAIT' });
    assert.throws(() => reg(d, h.handle), { code: 'EBADHANDLE' });
    c.close(h.handle); assert.equal(state(c, w), 'cancelled'); assert.equal(state(c, keep), 'pending');
    d.set(dh.handle); c.close(duplicate.handle); d.close(dh.handle);
    const fresh = c.create('identity', false, true);
    assert.notEqual(fresh.generation, h.generation); assert.equal(state(c, keep), 'signaled');
    assert.equal(c.cancelWait(keep.waitId).state, 'signaled'); assert.equal(c.acquire(fresh.handle), true);
    assert.throws(() => reg(c, h.handle), { code: 'EBADHANDLE' });
    pass('cross-session ownership and exact-reference cancellation; terminal generation detached from recreation');
    const cw = reg(c, fresh.handle);
    assert.throws(() => c.forgetWait(cw.waitId), { code: 'EBUSY' });
    assert.equal(c.cancelWait(cw.waitId).state, 'cancelled'); c.set(fresh.handle);
    assert.equal(state(c, cw), 'cancelled'); assert.equal(c.acquire(fresh.handle), true);
    c.forgetWait(cw.waitId); assert.throws(() => c.cancelWait(cw.waitId), { code: 'EBADWAIT' });
    const old = c.waitClock(); await sleep(30); c.set(fresh.handle);
    assert.equal(reg(c, fresh.handle, 1, old).state, 'timed-out'); assert.equal(c.acquire(fresh.handle), true);
    const foreign = client(auth()).waitClock();
    assert.throws(() => reg(c, fresh.handle, 100, foreign), { code: 'EINVAL' });
    pass('pending forget rejection, cancellation before Set, expired registration preserves signal, foreign stamp rejection');
    const gap = c.create('stamp-is-not-registration'), stamp = c.waitClock();
    c.set(gap.handle); c.reset(gap.handle);
    const ga = reg(c, gap.handle, 10000, stamp), gb = reg(c, gap.handle, 10000, stamp);
    assert.equal(ga.state, 'pending', 'stamp alone does not reserve an earlier pulse');
    assert.equal(gb.state, 'pending'); assert.notEqual(ga.waitId, gb.waitId);
    c.set(gap.handle); c.reset(gap.handle);
    assert.deepEqual([state(c, ga), state(c, gb)].sort(), ['pending', 'signaled']);
    c.set(gap.handle); c.reset(gap.handle);
    assert.equal(state(c, ga), 'signaled'); assert.equal(state(c, gb), 'signaled');
    pass('clock is not registration; duplicate registrations intentionally own two distinct results');
    // Count immediate terminals as quota, repeatedly reclaim all slots. Each cycle
    // gets a fresh session to avoid unrelated retained records from earlier groups.
    for (let cycle = 0; cycle < 3; cycle++) {
      const q = client(a), qh = q.create('quota-' + cycle, true, true), ids = [];
      for (let i = 0; i < 256; i++) { const x = reg(q, qh.handle); assert.equal(x.state, 'signaled'); ids.push(x.waitId); }
      assert.throws(() => reg(q, qh.handle), { code: 'ENOSPC' });
      for (const id of ids) q.forgetWait(id);
      assert.equal(reg(q, qh.handle).state, 'signaled'); q.shutdown();
    }
    pass('immediate terminal quota exhaustion and repeated explicit reclamation');
  }
  const watchdog = setTimeout(() => { console.error('independent deadline'); process.exit(1); }, 60000);
  run().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
    for (const p of actors) { if (p instanceof Worker) await p.terminate(); else p.kill(); }
    for (const c of clients) { try { c.shutdown(); } catch {} }
    await Promise.all(authorities.map(a => a.close())); clearTimeout(watchdog);
  });
}

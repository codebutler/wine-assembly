'use strict';
// Standalone provider acceptance. PROVIDER selects exact baseline or isolated
// fault/mutation source; production files are never edited by this test.
const assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const { once } = require('node:events');
const net = require('node:net');
const path = require('node:path');
const provider = process.env.PROVIDER || path.resolve(__dirname, '../lib/named-event-authority.js');
const { NamedEventAuthority, NamedEventClient } = require(provider);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const mode = process.argv[2] || 'normal';

if (mode === 'child') {
  const c = new NamedEventClient(JSON.parse(process.argv[3]));
  let legacyId = 0;
  const legacy = new Map();
  process.on('message', ({ id, op, args }) => {
    try {
      let value;
      // Explicit baseline adapter reproduces scheduler sampling; it is NOT
      // presented as registration in the original provider.
      if (process.env.LEGACY_POLL && op === 'registerWait') {
        const waitId = String(++legacyId);
        legacy.set(waitId, args[0]); value = { waitId, state: c.acquire(args[0]) ? 'signaled' : 'pending' };
      } else if (process.env.LEGACY_POLL && op === 'waitStatus') {
        value = { state: c.acquire(legacy.get(args[0])) ? 'signaled' : 'pending' };
      } else if (process.env.LEGACY_POLL && op === 'waitClock') value = {};
      else value = c[op](...args);
      process.send({ id, value });
    } catch (e) { process.send({ id, error: e.code || e.message }); }
  });
  process.send({ ready: true });
} else {
  const children = [], authorities = [], clients = [], rawSockets = [];
  let sequence = 0, groups = 0;
  const pass = text => { groups++; console.log('PASS ' + text); };
  function authority() { const a = new NamedEventAuthority(); authorities.push(a); return a; }
  function client(a, options) { const c = new NamedEventClient(a.endpoint, options); clients.push(c); return c; }
  async function child(a) {
    const p = fork(__filename, ['child', JSON.stringify(a.endpoint)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    children.push(p);
    assert.equal((await once(p, 'message'))[0].ready, true);
    return { p, call(op, ...args) {
      const id = ++sequence;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { done(); reject(new Error('subprocess response deadline')); }, 7000);
        function done() { clearTimeout(timer); p.off('message', got); p.off('exit', died); }
        function died() { done(); reject(new Error('subprocess exited')); }
        function got(r) {
          if (r.id !== id) return;
          done();
          if (r.error) reject(Object.assign(new Error(r.error), { code: r.error })); else resolve(r.value);
        }
        p.on('message', got); p.on('exit', died); p.send({ id, op, args });
      });
    } };
  }
  async function raw(a) {
    const socket = net.createConnection(a.endpoint.path); rawSockets.push(socket);
    let pending = '', response;
    socket.setEncoding('utf8');
    socket.on('data', chunk => {
      pending += chunk;
      let end;
      while ((end = pending.indexOf('\n')) >= 0) {
        const r = JSON.parse(pending.slice(0, end)); pending = pending.slice(end + 1);
        const done = response; response = null; done(r);
      }
    });
    await once(socket, 'connect');
    const call = request => new Promise((resolve, reject) => {
      response = r => r.error ? reject(Object.assign(new Error(r.error), { code: r.error })) : resolve(r.value);
      socket.write(JSON.stringify(request) + '\n');
    });
    await call({ op: 'hello', token: a.endpoint.token });
    return { call, socket };
  }
  const reg = (c, h, ms = 10000, clock = c.waitClock()) => c.registerWait(h, ms, clock);
  const childReg = async (c, h, ms = 10000) => c.call('registerWait', h, ms, await c.call('waitClock'));
  const state = (c, w) => c.waitStatus(w.waitId).state;
  const childState = async (c, w) => (await c.call('waitStatus', w.waitId)).state;

  async function reservation(a, c) {
    const x = await child(a), y = await child(a);
    const observations = [];
    for (const manual of [true, false]) {
      const h = c.create('pulse-' + manual, manual);
      const hx = await x.call('open', 'pulse-' + manual), hy = await y.call('open', 'pulse-' + manual);
      // A stamp issued to a different process is interpreted only by the same
      // authority, never by that process's local performance.now epoch.
      const clock = process.env.LEGACY_POLL ? {} : c.waitClock();
      const wx = await x.call('registerWait', hx.handle, 10000, clock);
      const wy = await y.call('registerWait', hy.handle, 10000, clock);
      assert.equal(wx.state, 'pending'); assert.equal(wy.state, 'pending');
      c.set(h.handle); c.reset(h.handle); // Both complete before either status request.
      const states = await Promise.all([childState(x, wx), childState(y, wy)]);
      console.log(JSON.stringify({ manual, setResetBeforeRetrieval: states }));
      observations.push([states.filter(s => s === 'signaled').length, manual ? 2 : 1]);
      if (!process.env.LEGACY_POLL) {
        // Repeated retrieval must not depend on the reset signal bit.
        assert.deepEqual(await Promise.all([childState(x, wx), childState(y, wy)]), states);
        assert.equal(c.acquire(h.handle), false);
      }
    }
    assert.deepEqual(observations, [[2, 2], [1, 1]], 'registered manual broadcast / auto one-winner reservations survive Set-Reset');
    if (mode === 'reservation' || process.env.LEGACY_POLL) return;
    for (let i = 0; i < 24; i++) {
      const h = c.create('contention-' + i), hx = await x.call('open', 'contention-' + i), hy = await y.call('open', 'contention-' + i);
      const [wx, wy] = await Promise.all([childReg(x, hx.handle), childReg(y, hy.handle)]);
      c.set(h.handle); c.reset(h.handle);
      const states = await Promise.all([childState(x, wx), childState(y, wy)]);
      assert.equal(states.filter(s => s === 'signaled').length, 1);
      for (const [peer, w] of [[x, wx], [y, wy]]) {
        await peer.call('cancelWait', w.waitId); await peer.call('forgetWait', w.waitId);
      }
    }
    pass('real subprocess manual broadcast and 24 auto-reset one-winner races; Set-Reset before retrieval');
  }

  async function normal() {
    const a = authority(), c = client(a), d = client(a);
    if (mode === 'boundary') {
      // Only a sealed test copy implements __tick. Production has no clock
      // injection API. All state and transport code otherwise stays real.
      for (const delta of [9999999n, 10000000n, 10000001n]) {
        const start = 1000000000n + delta * 10n;
        c._call({ op: '__tick', tick: start.toString() });
        const h = c.create('boundary-' + delta);
        const w = reg(c, h.handle, 10);
        c._call({ op: '__tick', tick: (start + delta).toString() });
        c.set(h.handle);
        const expected = delta < 10000000n ? 'signaled' : 'timed-out';
        assert.equal(state(c, w), expected);
        assert.equal(c.acquire(h.handle), expected === 'timed-out');
        c.reset(h.handle);
        assert.equal(state(c, w), expected);
      }
      pass('deterministic authority ordering: Set at deadline minus 1ns wins; equality and plus 1ns expire without consumption');
      return;
    }
    if (mode === 'lost-register' || mode === 'disconnect-register' || mode === 'lost-status') {
      const h = c.create('fault', false, true), hd = d.open('fault');
      c.timeoutMs = 150;
      const code = mode === 'disconnect-register' ? 'ECONNECTION' : 'ETIMEDOUT';
      if (mode === 'lost-status') {
        const w = reg(c, h.handle);
        assert.equal(w.state, 'signaled');
        assert.throws(() => c.waitStatus(w.waitId), { code });
      } else assert.throws(() => reg(c, h.handle), { code });
      assert.equal(d.acquire(hd.handle), false, 'committed immediate wake consumed signal despite lost response');
      assert.throws(() => c.acquire(h.handle), { code: 'ECLOSED' });
      d.set(hd.handle); assert.equal(d.acquire(hd.handle), true); assert.equal(d.acquire(hd.handle), false);
      pass('committed wake / lost reply outcome unknown, poisoned no replay, no refunded signal'); return;
    }
    await reservation(a, c);
    if (mode === 'reservation' || process.env.LEGACY_POLL) return;

    const h = c.create('immediate', false, true);
    const w = reg(c, h.handle);
    assert.equal(w.state, 'signaled'); assert.equal(c.acquire(h.handle), false);
    c.set(h.handle); // A second signal must survive any number of old status reads.
    for (let i = 0; i < 8; i++) assert.equal(state(c, w), 'signaled');
    assert.deepEqual(c.cancelWait(w.waitId), { state: 'signaled' });
    assert.equal(c.acquire(h.handle), true); assert.equal(c.acquire(h.handle), false);
    c.forgetWait(w.waitId);
    assert.throws(() => c.waitStatus(w.waitId), { code: 'EBADWAIT' });
    const m = c.create('persistent', true, true);
    assert.equal(reg(c, m.handle).state, 'signaled'); assert.equal(reg(c, m.handle).state, 'signaled');
    assert.equal(c.acquire(m.handle), true); c.reset(m.handle);
    pass('immediate/persistent signals, repeated status and post-assignment cancellation never consume twice');

    const clock = c.waitClock();
    await sleep(30);
    c.set(h.handle);
    const late = reg(c, h.handle, 1, clock);
    assert.equal(late.state, 'timed-out'); assert.equal(c.acquire(h.handle), true);
    const expires = reg(c, h.handle, 25);
    await sleep(100);
    c.set(h.handle); // No status poll was used to expire this registration.
    assert.equal(state(c, expires), 'timed-out'); assert.equal(c.acquire(h.handle), true);
    const wins = reg(c, h.handle, 100);
    c.set(h.handle); c.reset(h.handle); await sleep(140);
    assert.equal(state(c, wins), 'signaled', 'earlier Set assignment wins even after deadline');
    assert.equal(c.acquire(h.handle), false);
    for (const ms of [0, -1, Infinity, NaN, 1.1, 0xffffffff]) assert.throws(() => reg(c, h.handle, ms), { code: 'EINVAL' });
    assert.throws(() => c.registerWait(h.handle, 100, { epoch: clock.epoch, tick: '999999999999999999999999' }), { code: 'EINVAL' });
    assert.throws(() => c.registerWait(h.handle, 100, { epoch: 'foreign', tick: clock.tick }), { code: 'EINVAL' });
    assert.throws(() => c.registerWait(h.handle, 100, { epoch: clock.epoch, tick: 12 }), { code: 'EINVAL' });
    assert.throws(() => c.registerWait(h.handle, 100), { code: 'EINVAL' });
    const other = authority(), otherClient = client(other), otherRef = otherClient.create('other', false, true);
    assert.throws(() => otherClient.registerWait(otherRef.handle, 10000, clock), { code: 'EINVAL' });
    assert.equal(otherClient.acquire(otherRef.handle), true);
    pass('authority deadline includes registration transit; expired waits preserve late signals; earlier Set remains terminal');

    const cancelled = reg(c, h.handle);
    assert.throws(() => c.forgetWait(cancelled.waitId), { code: 'EBUSY' });
    assert.deepEqual(c.cancelWait(cancelled.waitId), { state: 'cancelled' });
    assert.deepEqual(c.cancelWait(cancelled.waitId), { state: 'cancelled' });
    c.set(h.handle); assert.equal(state(c, cancelled), 'cancelled'); assert.equal(c.acquire(h.handle), true);
    const won = reg(c, h.handle); c.set(h.handle);
    assert.deepEqual(c.cancelWait(won.waitId), { state: 'signaled' });
    assert.equal(c.acquire(h.handle), false, 'cancel after assignment does not invent refund');
    const first = reg(c, h.handle), second = reg(c, h.handle);
    c.set(h.handle); c.set(h.handle); c.set(h.handle);
    assert.equal(state(c, first), 'signaled'); assert.equal(state(c, second), 'signaled');
    assert.equal(c.acquire(h.handle), true); assert.equal(c.acquire(h.handle), false);
    assert.throws(() => d.waitStatus(won.waitId), { code: 'EBADWAIT' });
    assert.throws(() => d.cancelWait(won.waitId), { code: 'EBADWAIT' });
    assert.throws(() => d.forgetWait(won.waitId), { code: 'EBADWAIT' });
    assert.throws(() => d.registerWait(h.handle, 10, d.waitClock()), { code: 'EBADHANDLE' });
    pass('cancellation before/after assignment, explicit terminal cleanup and session ownership');

    const life = c.create('lifetime'), dup = c.open('lifetime');
    const pending = reg(c, life.handle), retained = reg(c, dup.handle);
    c.close(life.handle);
    assert.equal(state(c, pending), 'cancelled'); assert.equal(state(c, retained), 'pending');
    c.set(dup.handle); c.close(dup.handle);
    assert.equal(state(c, retained), 'signaled');
    const fresh = c.create('lifetime', false, true);
    assert.notEqual(fresh.generation, life.generation);
    assert.throws(() => reg(c, life.handle), { code: 'EBADHANDLE' });
    assert.equal(state(c, retained), 'signaled'); assert.equal(c.acquire(fresh.handle), true);
    const final = reg(c, fresh.handle); c.close(fresh.handle);
    assert.equal(state(c, final), 'cancelled'); assert.throws(() => d.open('lifetime'), { code: 'ENOENT' });
    pass('reference-specific close cancellation; terminal result survives final close/recreation without pinning event');

    const z = await child(a), survivor = c.create('survivor');
    const zh = await z.call('open', 'survivor');
    await childReg(z, zh.handle); await z.call('create', 'disconnect-marker');
    const exited = once(z.p, 'exit'); z.p.kill('SIGKILL'); await exited;
    for (let i = 0; ; i++) {
      try { const probe = c.open('disconnect-marker'); c.close(probe.handle); }
      catch (e) { assert.equal(e.code, 'ENOENT'); break; }
      assert.ok(i < 100); await sleep(10);
    }
    c.set(survivor.handle); assert.equal(c.acquire(survivor.handle), true);
    const rawPeer = await raw(a);
    const rh = await rawPeer.call({ op: 'open', name: 'survivor' });
    const rc = await rawPeer.call({ op: 'waitClock' });
    await rawPeer.call({ op: 'registerWait', handle: rh.handle, timeoutMs: 10000, clock: rc });
    await rawPeer.call({ op: 'shutdown' }); // Socket stays open; cleanup cannot rely on EOF.
    c.set(survivor.handle); assert.equal(c.acquire(survivor.handle), true);
    rawPeer.socket.destroy();
    const gone = await child(a), gh = await gone.call('open', 'survivor');
    const gw = await childReg(gone, gh.handle);
    c.set(survivor.handle); assert.equal(await childState(gone, gw), 'signaled');
    await gone.call('create', 'assigned-disconnect-marker');
    const goneExit = once(gone.p, 'exit'); gone.p.kill('SIGKILL'); await goneExit;
    for (let i = 0; ; i++) {
      try { const probe = c.open('assigned-disconnect-marker'); c.close(probe.handle); }
      catch (e) { assert.equal(e.code, 'ENOENT'); break; }
      assert.ok(i < 100); await sleep(10);
    }
    assert.equal(c.acquire(survivor.handle), false, 'disconnect after assignment cannot refund a committed wake');
    pass('SIGKILL/EOF and connected-socket shutdown cancel pending waits, preserve surviving references/signals');

    const broken = client(a, { timeoutMs: 100 });
    const bh = broken.open('survivor'); const bw = reg(broken, bh.handle);
    await broken.worker.terminate();
    assert.throws(() => broken.waitStatus(bw.waitId), { code: 'ETIMEDOUT' });
    assert.throws(() => broken.waitStatus(bw.waitId), { code: 'ECLOSED' });
    const dying = reg(c, survivor.handle);
    await a.close();
    assert.throws(() => c.waitStatus(dying.waitId), { code: 'ECONNECTION' });
    assert.throws(() => c.waitStatus(dying.waitId), { code: 'ECLOSED' });
    pass('bridge and authority loss fail closed; no status replay or replacement authority');
    await bounds();
  }

  async function bounds() {
    const a = authority(), peers = [];
    for (let n = 0; n < 16; n++) {
      const p = await raw(a); peers.push(p);
      p.h = await p.call({ op: 'create', name: 'bounded', manualReset: true, initialState: false });
      const clock = await p.call({ op: 'waitClock' });
      p.ids = [];
      for (let i = 0; i < 256; i++) {
        const w = await p.call({ op: 'registerWait', handle: p.h.handle, timeoutMs: 60000, clock });
        assert.equal(w.state, 'pending'); p.ids.push(w.waitId);
      }
      await assert.rejects(p.call({ op: 'registerWait', handle: p.h.handle, timeoutMs: 60000, clock }), { code: 'ENOSPC' });
    }
    const extra = await raw(a), h = await extra.call({ op: 'open', name: 'bounded' });
    const register = async () => extra.call({ op: 'registerWait', handle: h.handle, timeoutMs: 60000, clock: await extra.call({ op: 'waitClock' }) });
    await assert.rejects(register(), { code: 'ENOSPC' });
    const fullSignal = await extra.call({ op: 'create', name: 'full-signal', manualReset: false, initialState: true });
    await assert.rejects(extra.call({ op: 'registerWait', handle: fullSignal.handle, timeoutMs: 60000, clock: await extra.call({ op: 'waitClock' }) }), { code: 'ENOSPC' });
    assert.equal(await extra.call({ op: 'acquire', handle: fullSignal.handle }), true, 'exhaustion cannot consume signal');
    await extra.call({ op: 'set', handle: h.handle });
    await extra.call({ op: 'reset', handle: h.handle });
    for (const p of peers) assert.equal((await p.call({ op: 'waitStatus', waitId: p.ids[0] })).state, 'signaled');
    await assert.rejects(register(), { code: 'ENOSPC' }); // All 4096 terminal results still count.
    const p = peers[0], id = p.ids[0];
    await p.call({ op: 'cancelWait', waitId: id });
    await assert.rejects(register(), { code: 'ENOSPC' }); // Terminals still count.
    await p.call({ op: 'forgetWait', waitId: id });
    const replacement = await register(); assert.equal(replacement.state, 'pending');
    await assert.rejects(register(), { code: 'ENOSPC' });
    // One dead session reclaims pending and terminal capacity. Observe EOF via
    // a private reference before testing capacity, not via a lucky delay.
    await peers[1].call({ op: 'create', name: 'capacity-marker', manualReset: false, initialState: false });
    peers[1].socket.destroy();
    for (let i = 0; ; i++) {
      try { const r = await extra.call({ op: 'open', name: 'capacity-marker' }); await extra.call({ op: 'close', handle: r.handle }); }
      catch (e) { assert.equal(e.code, 'ENOENT'); break; }
      assert.ok(i < 100); await sleep(10);
    }
    assert.equal((await register()).state, 'pending');
    // Shutdown drops all remaining records before acknowledgement.
    for (let n = 0; n < peers.length; n++) if (n !== 1) await peers[n].call({ op: 'shutdown' });
    await extra.call({ op: 'cancelWait', waitId: replacement.waitId });
    await extra.call({ op: 'shutdown' });
    pass('256/session and 4096/global pending+result bounds, ENOSPC, forget/EOF/shutdown reclamation');
  }

  const watchdog = setTimeout(() => { console.error('test deadline'); process.exit(1); }, 60000);
  normal().then(() => console.log(`PASS wake reservation suite: ${groups} groups`)).catch(e => {
    console.error(e); process.exitCode = 1;
  }).finally(async () => {
    for (const p of children) if (p.exitCode === null && p.signalCode === null) p.kill();
    for (const s of rawSockets) s.destroy();
    for (const c of clients) { try { c.shutdown(); } catch {} }
    await Promise.all(authorities.map(a => a.close())); clearTimeout(watchdog);
  });
}

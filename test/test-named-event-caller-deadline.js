'use strict';
// Standalone timing acceptance. Real transports; source copies only for clock,
// delay and mutation controls. No production test hooks or patched supplied tests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { fork, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { Worker, isMainThread, workerData, parentPort } = require('node:worker_threads');
const provider = process.env.PROVIDER || path.resolve(__dirname, '../lib/named-event-authority.js');
const { NamedEventAuthority, NamedEventClient } = require(provider);
const mode = process.argv[2] || 'suite';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const block = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

if (mode === 'actor' || workerData?.deadlineActor) {
  const c = new NamedEventClient(isMainThread ? JSON.parse(process.argv[3]) : workerData.endpoint);
  const port = isMainThread ? process : parentPort;
  const send = v => isMainThread ? process.send(v) : port.postMessage(v);
  port.on('message', ({ op, args }) => {
    try { send({ value: op === 'sample' ? process.hrtime.bigint().toString() : c[op](...args) }); }
    catch (e) { send({ error: e.code || e.message }); }
  });
  send({ ready: true });
} else if (mode === 'suite') {
  const out = process.env.EVIDENCE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'caller-deadline-'));
  fs.mkdirSync(out, { recursive: true });
  const source = fs.readFileSync(provider, 'utf8');
  const replace = (s, a, b) => { assert.equal(s.split(a).length, 2, a); return s.replace(a, b); };
  const save = (name, s) => { const p = path.join(out, name + '.js'); fs.writeFileSync(p, s); return p; };
  const delay = 'Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 180);';
  const inbound = s => replace(s, 'const tick = now();', `if (request.op === 'waitClock') { ${delay} } const tick = now();`);
  let clock = replace(source, 'const origin = process.hrtime.bigint();', 'const origin = 1000000000n;');
  clock = replace(clock, 'const now = () => process.hrtime.bigint() - origin;', 'let fakeTick = 2000000000n; const now = () => fakeTick - origin;');
  clock = replace(clock, 'const entry = process.hrtime.bigint();', 'const entry = global.__callerTick;');
  clock = replace(clock, "if (stopped) throw fault('ECLOSED');", "if (stopped) throw fault('ECLOSED'); if (request.op === '__tick') { fakeTick = BigInt(request.tick); socket.write(JSON.stringify({ value: true }) + '\\n'); return; }");
  const cases = [
    ['real-peers', 'peers', provider, 0],
    ['inbound', 'delay', save('inbound', inbound(source)), 0],
    ['response', 'delay', save('response', replace(source, "socket.write(JSON.stringify({ value }) + '\\n');", `if (request.op === 'waitClock') { ${delay} } socket.write(JSON.stringify({ value }) + '\\n');`)), 0],
    ['registration', 'delay', save('registration', replace(source, 'const tick = now();', `if (request.op === 'registerWait') { ${delay} } const tick = now();`)), 0],
    ['late-observation', 'late-observation', save('late-observation', replace(source, "socket.write(JSON.stringify({ value }) + '\\n');", `if (request.op === 'registerWait') { ${delay} } socket.write(JSON.stringify({ value }) + '\\n');`)), 0],
    ['boundary', 'boundary', save('clock', clock), 0],
    ['reject-extension', 'boundary', save('extension', replace(clock, 'tick: entry.toString(), callerClock: clock', 'tick: (entry + 1000000n).toString(), callerClock: clock')), 1],
    ['reject-early-expiry', 'boundary', save('early-expiry', replace(clock, 'tick: entry.toString(), callerClock: clock', 'tick: (entry - 1000000n).toString(), callerClock: clock')), 1],
    ['reject-unrelated-domain', 'scope', save('foreign-domain', replace(source, 'clock.domain !== callerClockDomain()', 'false')), 1],
    ['scope', 'scope', provider, 0],
    ['lost-clock-reply', 'lost-clock-reply', save('lost-clock-reply', replace(source, "socket.write(JSON.stringify({ value }) + '\\n');", "if (request.op === 'waitClock') return; socket.write(JSON.stringify({ value }) + '\\n');")), 0],
  ];
  if (process.env.OLD_PROVIDER) {
    const old = save('old-inbound', inbound(fs.readFileSync(process.env.OLD_PROVIDER, 'utf8')));
    cases.push(['old-reproducer', 'old-reproducer', old, 0], ['reject-old', 'delay', old, 1]);
    cases.push(['mixed-version', 'mixed-version', provider, 0]);
    cases.push(['reject-silent-fallback', 'mixed-version', save('silent-fallback', replace(source,
      "if (callerEntry && (stamp?.callerClock?.domain !== callerClock.domain ||\n        stamp?.callerClock?.tick !== callerClock.tick)) throw fault('ECLOCKSCOPE');", '')), 1]);
  }
  const results = [];
  for (const [name, testMode, input, expected] of cases) {
    const r = spawnSync(process.execPath, [__filename, testMode], { env: { ...process.env, PROVIDER: input }, encoding: 'utf8', timeout: 30000 });
    const log = (r.stdout || '') + (r.stderr || '');
    fs.writeFileSync(path.join(out, name + '.log'), log);
    results.push({ name, mode: testMode, provider: input, expected, exit: r.status });
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    assert.equal(r.status, expected, name + '\n' + log);
    if (expected) assert.match(log, /AssertionError/, name);
    console.log('PASS', name, 'exit', r.status);
  }
} else {
  const actors = [];
  const Authority = mode === 'mixed-version' ? require(process.env.OLD_PROVIDER).NamedEventAuthority : NamedEventAuthority;
  const a = new Authority(), c = new NamedEventClient(a.endpoint);
  async function peer(thread) {
    const p = thread ? new Worker(__filename, { workerData: { deadlineActor: true, endpoint: a.endpoint } })
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
    if (mode === 'mixed-version') {
      assert.throws(() => c.waitClock({ callerEntry: true }), { code: 'ECLOCKSCOPE' });
      assert.ok(c.waitClock(), 'legacy compatibility with old authority');
      return;
    }
    if (mode === 'lost-clock-reply') {
      const d = new NamedEventClient(a.endpoint);
      try {
        const h = c.create('lost-clock', false, true), dh = d.open('lost-clock');
        c.timeoutMs = 120;
        assert.throws(() => c.waitClock({ callerEntry: true }), { code: 'ETIMEDOUT' });
        assert.equal(c.closed, true);
        assert.throws(() => c.registerWait(h.handle, 50, {}), { code: 'ECLOSED' });
        await sleep(180);
        assert.equal(d.acquire(dh.handle), true, 'stamp request cannot reserve or consume');
        d.set(dh.handle); await sleep(180);
        assert.equal(d.acquire(dh.handle), true, 'no replay consumes a newer signal');
      } finally { d.shutdown(); }
      return;
    }
    if (['delay', 'old-reproducer', 'late-observation'].includes(mode)) {
      const h = c.create('delay', false, true), start = process.hrtime.bigint();
      const clock = c.waitClock({ callerEntry: true });
      const w = c.registerWait(h.handle, 50, clock);
      const elapsed = Number(process.hrtime.bigint() - start) / 1e6;
      console.log(JSON.stringify({ mode, elapsed, state: w.state }));
      assert.ok(elapsed >= 150, elapsed);
      const success = mode !== 'delay';
      assert.equal(w.state, success ? 'signaled' : 'timed-out', 'caller budget must include inbound transport');
      assert.equal(c.acquire(h.handle), !success, 'expired registration must preserve auto signal');
      assert.equal(c.waitStatus(w.waitId).state, w.state, 'late observation retains committed result');
      return;
    }
    if (mode === 'scope') {
      const clock = c.waitClock({ callerEntry: true });
      assert.equal(typeof clock.tick, 'string');
      assert.throws(() => c._call({ op: 'waitClock', callerClock: { domain: 'unrelated-boot-or-namespace', tick: process.hrtime.bigint().toString() } }), { code: 'ECLOCKSCOPE' });
      const readlink = fs.readlinkSync;
      try {
        fs.readlinkSync = () => { throw new Error('proc unavailable'); };
        assert.throws(() => c.waitClock({ callerEntry: true }), { code: 'ECLOCKSCOPE' });
      } finally { fs.readlinkSync = readlink; }
      const version = Object.getOwnPropertyDescriptor(process.versions, 'node');
      try {
        Object.defineProperty(process.versions, 'node', { value: 'unqualified' });
        assert.throws(() => c.waitClock({ callerEntry: true }), { code: 'ECLOCKSCOPE' });
      } finally { Object.defineProperty(process.versions, 'node', version); }
      assert.ok(c.waitClock(), 'legacy still available');
      assert.equal(c.closed, false, 'explicit rejection is not an ambiguous operation');
      return;
    }
    if (mode === 'boundary') {
      for (const offset of [-1n, 0n, 1n]) {
        const start = 2000000000n + (offset + 1n) * 100000000n;
        global.__callerTick = start;
        c._call({ op: '__tick', tick: String(start) });
        const h = c.create('boundary' + offset), clock = c.waitClock({ callerEntry: true });
        // Allow both +/-1ms stamp mutants past syntactic future-stamp checks;
        // require behavioral rejection at the actual deadline boundary.
        c._call({ op: '__tick', tick: String(start + 2000000n) });
        const w = c.registerWait(h.handle, 10, clock);
        assert.equal(w.state, 'pending');
        c._call({ op: '__tick', tick: String(start + 10000000n + offset) });
        c.set(h.handle); c.reset(h.handle);
        assert.equal(c.waitStatus(w.waitId).state, offset < 0n ? 'signaled' : 'timed-out', 'Set eligibility at ' + offset);
        c.set(h.handle);
        const immediate = c.registerWait(h.handle, 10, clock);
        assert.equal(immediate.state, offset < 0n ? 'signaled' : 'timed-out', 'registration eligibility at ' + offset);
        assert.equal(c.acquire(h.handle), offset >= 0n, 'expired registration preserves signal');
        c._call({ op: '__tick', tick: String(start + 50000000n) });
        assert.equal(c.waitStatus(w.waitId).state, offset < 0n ? 'signaled' : 'timed-out');
        c.forgetWait(w.waitId); c.forgetWait(immediate.waitId);
      }
      return;
    }
    assert.equal(mode, 'peers');
    const p = await peer(false), t = await peer(true);
    for (const [kind, call] of [['subprocess', p], ['Worker', t]]) {
      const brackets = [];
      for (let i = 0; i < 12; ++i) {
        const before = process.hrtime.bigint(), sample = BigInt(await call('sample')), after = process.hrtime.bigint();
        assert.ok(before <= sample && sample <= after, `${kind}: unrelated epoch`);
        brackets.push({ before: String(before), sample: String(sample), after: String(after) });
      }
      console.log(JSON.stringify({ kind, brackets }));
      const h = await call('create', 'expired-' + kind, false, true);
      const clock = await call('waitClock', { callerEntry: true });
      await sleep(80);
      assert.equal((await call('registerWait', h.handle, 50, clock)).state, 'timed-out');
      assert.equal(await call('acquire', h.handle), true);
    }
    for (const manual of [true, false]) {
      const h = c.create('pulse-' + manual, manual), ph = await p('open', 'pulse-' + manual), th = await t('open', 'pulse-' + manual);
      const pc = await p('waitClock', { callerEntry: true }), tc = await t('waitClock', { callerEntry: true });
      c.set(h.handle); c.reset(h.handle); // stamps reserve nothing
      const wp = await p('registerWait', ph.handle, 1000, pc), wt = await t('registerWait', th.handle, 1000, tc);
      assert.equal(wp.state, 'pending'); assert.equal(wt.state, 'pending');
      c.set(h.handle); c.reset(h.handle);
      const states = [(await p('waitStatus', wp.waitId)).state, (await t('waitStatus', wt.waitId)).state];
      assert.equal(states.filter(s => s === 'signaled').length, manual ? 2 : 1);
      await p('cancelWait', wp.waitId); await t('cancelWait', wt.waitId);
      await p('forgetWait', wp.waitId); await t('forgetWait', wt.waitId);
    }
    // A successful reservation remains successful when the caller resumes late.
    const h = c.create('late'), clock = c.waitClock({ callerEntry: true });
    const w = c.registerWait(h.handle, 100, clock);
    c.set(h.handle); c.reset(h.handle); block(180);
    assert.equal(c.waitStatus(w.waitId).state, 'signaled');
  }
  run().then(() => console.log('PASS', mode)).catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
    for (const p of actors) { if (p instanceof Worker) await p.terminate(); else { p.kill(); await once(p, 'exit'); } }
    c.shutdown(); await a.close();
  });
}

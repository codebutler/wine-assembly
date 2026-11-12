'use strict';
// Independent caller-contract tests. No production hooks; mutation copies live
// outside the checkout. Execute with EVIDENCE_DIR set to a fresh directory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { fork, spawnSync } = require('node:child_process');
const { Worker, isMainThread, workerData, parentPort } = require('node:worker_threads');
const { once } = require('node:events');
const provider = process.env.PROVIDER || path.resolve(__dirname, '../lib/named-event-authority.js');
const { NamedEventAuthority, NamedEventClient } = require(provider);
const block = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const mode = process.argv[2] || 'suite';

function delayedLookup(c) {
  const read = fs.readFileSync;
  const before = process.hrtime.bigint();
  try {
    fs.readFileSync = function (p, ...args) {
      if (p === '/proc/sys/kernel/random/boot_id') block(180);
      return read.call(this, p, ...args);
    };
    const stamp = c.waitClock({ callerEntry: true });
    const after = process.hrtime.bigint();
    assert.ok(BigInt(stamp.callerClock.tick) >= before);
    assert.ok(BigInt(stamp.callerClock.tick) <= after);
    return stamp;
  } finally { fs.readFileSync = read; }
}

if (mode === 'actor' || workerData?.independentActor) {
  const endpoint = isMainThread ? JSON.parse(process.argv[3]) : workerData.endpoint;
  const c = new NamedEventClient(endpoint);
  try {
    const h = c.create('independent-' + (isMainThread ? 'process' : 'thread'), false, true);
    const stamp = delayedLookup(c);
    const result = c.registerWait(h.handle, 50, stamp);
    assert.equal(result.state, 'timed-out', 'domain lookup belongs to caller budget');
    assert.equal(c.acquire(h.handle), true, 'expiry must preserve signal');
    c.forgetWait(result.waitId);
    const output = { kind: isMainThread ? 'subprocess' : 'Worker', stamp, state: result.state };
    if (isMainThread) process.send(output); else parentPort.postMessage(output);
  } finally { c.shutdown(); }
} else if (mode === 'suite') {
  const out = process.env.EVIDENCE_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'caller-independent-'));
  fs.mkdirSync(out, { recursive: true });
  const source = fs.readFileSync(provider, 'utf8');
  function copy(name, from, to) {
    assert.equal(source.split(from).length, 2, 'unique mutation anchor');
    const p = path.join(out, name + '.js');
    fs.writeFileSync(p, source.replace(from, to));
    return p;
  }
  const entry = 'const entry = process.hrtime.bigint();';
  const cases = [
    ['transport', provider, 0], ['malformed', provider, 0], ['qualification', provider, 0],
    ['reject-late-entry', copy('late-entry', entry + '\n    const callerClock = callerEntry ? { domain: callerClockDomain(), tick: entry.toString() } : undefined;',
      'const domain = callerEntry ? callerClockDomain() : undefined; ' + entry + '\n    const callerClock = callerEntry ? { domain, tick: entry.toString() } : undefined;'), 1, 'transport'],
    ['ack-tick', copy('ack-tick', 'callerClock: clock };', 'callerClock: { ...clock, tick: String(BigInt(clock.tick) + 1n) } };'), 0, 'ack'],
    ['ack-domain', copy('ack-domain', 'callerClock: clock };', "callerClock: { ...clock, domain: 'foreign' } };"), 0, 'ack'],
    ['ack-missing', copy('ack-missing', 'callerClock: clock };', 'callerClock: undefined };'), 0, 'ack'],
  ];
  if (process.env.OLD_PROVIDER) cases.push(['legacy', provider, 0]);
  const results = [];
  for (const [name, input, expected, testMode = name] of cases) {
    const r = spawnSync(process.execPath, [__filename, testMode], {
      env: { ...process.env, PROVIDER: input }, encoding: 'utf8', timeout: 15000,
    });
    const log = (r.stdout || '') + (r.stderr || '');
    fs.writeFileSync(path.join(out, name + '.log'), log);
    results.push({ name, expected, exit: r.status, provider: input });
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(results, null, 2));
    assert.equal(r.status, expected, name + '\n' + log);
    if (expected) assert.match(log, /AssertionError/);
    console.log('PASS', name, r.status);
  }
} else {
  const a = new NamedEventAuthority();
  const c = new NamedEventClient(a.endpoint);
  async function run() {
    if (mode === 'legacy') {
      const OldClient = require(process.env.OLD_PROVIDER).NamedEventClient;
      const old = new OldClient(a.endpoint);
      try {
        const h = old.create('old-client', false, false);
        const other = c.open('old-client');
        const stamp = old.waitClock();
        assert.equal(stamp.callerClock, undefined);
        const wait = old.registerWait(h.handle, 1000, stamp);
        assert.equal(wait.state, 'pending');
        c.set(other.handle); c.reset(other.handle);
        assert.equal(old.waitStatus(wait.waitId).state, 'signaled');
        old.forgetWait(wait.waitId);
        assert.equal(old.acquire(h.handle), false);
      } finally { old.shutdown(); }
      return;
    }
    if (mode === 'transport') {
      for (const thread of [false, true]) {
        const p = thread ? new Worker(__filename, { workerData: { independentActor: true, endpoint: a.endpoint } })
          : fork(__filename, ['actor', JSON.stringify(a.endpoint)], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
        // Observe exit as well as payload: a failed actor must not hang the test.
        const done = once(p, 'exit');
        let payload;
        p.on('message', value => { payload = value; });
        const [code] = await done;
        assert.equal(code, 0, 'actor failed');
        assert.ok(payload, 'actor completed assertions');
        console.log(JSON.stringify(payload));
      }
      return;
    }
    const h = c.create('validation', false, true);
    if (mode === 'ack') {
      assert.throws(() => c.waitClock({ callerEntry: true }), { code: 'ECLOCKSCOPE' });
      assert.equal(c.closed, false, 'explicit incompatibility has no unknown operation');
      const w = c.registerWait(h.handle, 1000, c.waitClock());
      assert.equal(w.state, 'signaled', 'legacy remains usable after explicit rejection');
      c.forgetWait(w.waitId);
      return;
    }
    if (mode === 'qualification') {
      for (const [object, key, value] of [[process, 'platform', 'win32'], [process.versions, 'node', '24.18.0'], [process.versions, 'uv', '1.52.0']]) {
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        try {
          Object.defineProperty(object, key, { value });
          assert.throws(() => c.waitClock({ callerEntry: true }), { code: 'ECLOCKSCOPE' });
          assert.ok(c.waitClock().epoch);
        } finally { Object.defineProperty(object, key, descriptor); }
      }
      for (const method of ['readFileSync', 'readlinkSync']) {
        const old = fs[method];
        try {
          fs[method] = () => 'malformed';
          assert.throws(() => c.waitClock({ callerEntry: true }), { code: 'ECLOCKSCOPE' });
        } finally { fs[method] = old; }
      }
      assert.equal(c.acquire(h.handle), true);
      assert.equal(c.closed, false);
      return;
    }
    assert.equal(mode, 'malformed');
    const first = c.waitClock({ callerEntry: true });
    const second = c.waitClock({ callerEntry: true });
    const origin = BigInt(first.callerClock.tick) - BigInt(first.tick);
    assert.equal(BigInt(second.callerClock.tick) - BigInt(second.tick), origin, 'actual authority origin is stable');
    const wire = callerClock => c._call({ op: 'waitClock', callerClock });
    for (const tick of [null, true, 1, '', '-1', '1.0', ' 1', '1e9', '1'.repeat(25), String(origin - 1n), String(process.hrtime.bigint() + 100000000000n)]) {
      assert.throws(() => wire({ domain: first.callerClock.domain, tick }), { code: 'EINVAL' }, String(tick));
    }
    for (const clock of [null, {}, { domain: 'foreign', tick: first.callerClock.tick }, { domain: first.callerClock.domain.replace('time:[', 'time:[9'), tick: first.callerClock.tick }]) {
      assert.throws(() => wire(clock), { code: 'ECLOCKSCOPE' });
    }
    // Options currently follow JS destructuring/truthiness, not strict schema validation.
    assert.throws(() => c.waitClock(null), TypeError);
    for (const options of [false, 1, 'bad', {}, { callerEntry: 0 }, { typo: true }]) {
      assert.equal(c.waitClock(options).callerClock, undefined);
    }
    assert.ok(c.waitClock({ callerEntry: 'truthy' }).callerClock);
    for (const stamp of [null, {}, { ...first, epoch: 'other' }, { ...first, tick: '-1' }, { ...first, tick: 3 }, { ...first, tick: '9'.repeat(24) }]) {
      assert.throws(() => c.registerWait(h.handle, 50, stamp), { code: 'EINVAL' });
    }
    for (const timeout of [0, -1, 1.1, null, '50', 0xffffffff, NaN]) {
      assert.throws(() => c.registerWait(h.handle, timeout, first), { code: 'EINVAL' });
    }
    assert.equal(c.closed, false, 'validation errors are not ambiguous');
    // An old, valid same-origin stamp is accepted but cannot replenish its budget.
    block(70);
    const stale = wire(first.callerClock);
    assert.equal(stale.tick, first.tick);
    const expired = c.registerWait(h.handle, 50, stale);
    assert.equal(expired.state, 'timed-out');
    c.forgetWait(expired.waitId);
    assert.equal(c.acquire(h.handle), true, 'all rejected inputs preserve signal');
    assert.equal(c.acquire(h.handle), false);
    // No hidden reservations or results leaked by failures: exceed one session quota sequentially.
    for (let i = 0; i < 260; i++) {
      const w = c.registerWait(h.handle, 50, stale);
      assert.equal(w.state, 'timed-out');
      c.forgetWait(w.waitId);
    }
    console.log(JSON.stringify({ origin: String(origin), first, second, malformedAndCleanup: 'PASS' }));
  }
  run().then(() => console.log('PASS', mode)).catch(e => { console.error(e); process.exitCode = 1; })
    .finally(async () => { c.shutdown(); await a.close(); });
}

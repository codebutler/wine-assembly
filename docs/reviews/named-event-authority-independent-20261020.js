'use strict';
// Independent public-API probes. PROVIDER permits isolated behavioral mutations.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const provider = process.env.PROVIDER || path.resolve(__dirname, '../../lib/named-event-authority.js');
const { NamedEventAuthority, NamedEventClient } = require(provider);
const mode = process.argv[2] || 'normal';
const pause = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
if (mode === 'child') {
  const c = new NamedEventClient(JSON.parse(process.argv[3]));
  const h = c.open('owner-blocked');
  assert.equal(c.acquire(h.handle), true);
  assert.equal(c.acquire(h.handle), false);
  c.set(h.handle);
  // Abrupt exit without shutdown also tests EOF cleanup.
  c.create('child-only');
  process.exit(0);
}
if (mode === 'raw-shutdown') {
  // Keep the socket alive after shutdown: EOF must not mask missing release
  // before acknowledgement. This speaks only the submitted JSON protocol.
  const endpoint = JSON.parse(process.argv[3]);
  const socket = require('node:net').createConnection(endpoint.path);
  const observer = new NamedEventClient(endpoint);
  let stage = 0, pending = '';
  socket.setEncoding('utf8');
  socket.on('connect', () => socket.write(JSON.stringify({ op: 'hello', token: endpoint.token }) + '\n'));
  socket.on('data', chunk => {
    pending += chunk;
    let end;
    while ((end = pending.indexOf('\n')) >= 0) {
      const response = JSON.parse(pending.slice(0, end)); pending = pending.slice(end + 1);
      assert.equal(response.error, undefined);
      if (stage++ === 0) socket.write(JSON.stringify({ op: 'create', name: 'raw-shutdown', manualReset: false, initialState: false }) + '\n');
      else if (stage === 2) socket.write('{"op":"shutdown"}\n');
      else {
        assert.equal(response.value, true);
        assert.throws(() => observer.open('raw-shutdown'), { code: 'ENOENT' });
        observer.shutdown(); socket.destroy(); process.exit(0);
      }
    }
  });
  socket.on('error', e => { throw e; });
} else {
async function main() {
  const a = new NamedEventAuthority();
  const clients = [];
  const client = options => { const c = new NamedEventClient(a.endpoint, options); clients.push(c); return c; };
  try {
    const c = client(), d = client();
    if (mode === 'lost-response' || mode === 'disconnect-response') {
      const h = c.create('lost-response'), k = d.open('lost-response');
      c.timeoutMs = 150;
      assert.throws(() => c.set(h.handle), { code: mode === 'lost-response' ? 'ETIMEDOUT' : 'ECONNECTION' });
      assert.equal(d.acquire(k.handle), true, 'set committed before its response was withheld');
      assert.equal(d.acquire(k.handle), false);
      assert.throws(() => c.acquire(h.handle), { code: 'ECLOSED' });
      console.log('PASS committed request / ' + mode + ' / poisoned client');
      return;
    }
    let callbackRan = false;
    setImmediate(() => { callbackRan = true; });
    const h = c.create('owner-blocked', false, true);
    const result = spawnSync(process.execPath, [__filename, 'child', JSON.stringify(a.endpoint)], { timeout: 6000, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || String(result.error));
    assert.equal(callbackRan, false, 'owner JS stayed blocked for subprocess lifetime');
    assert.equal(c.acquire(h.handle), true);
    assert.equal(c.acquire(h.handle), false);
    for (let i = 0; ; i++) {
      try { const r = c.open('child-only'); c.close(r.handle); }
      catch (e) { assert.equal(e.code, 'ENOENT'); break; }
      assert.ok(i < 100, 'EOF must eventually release child-only reference'); pause(10);
    }
    console.log('PASS owner and child JS blocked; auto-reset; normal process-exit reclamation');

    const name = 'é'.repeat(512), edge = c.create(name, true, true);
    assert.equal(d.open(name).generation, edge.generation);
    for (const bad of ['', 'x\0y', name + 'a', null, 42]) assert.throws(() => c.open(bad), { code: 'EINVAL' });
    assert.throws(() => c.create('bad-mode', 1), { code: 'EINVAL' });
    const exact = c.create('Exact'), lower = c.create('exact');
    assert.notEqual(exact.generation, lower.generation);
    assert.equal(c.acquire(edge.handle), true, 'validation errors do not poison the session');
    console.log('PASS UTF-8 byte boundary, exact names, validation failure recovery');

    const q = client(), refs = [];
    for (let i = 0; i < 4096; i++) refs.push(q.create('quota', false, false));
    assert.throws(() => q.open('quota'), { code: 'ENOSPC' });
    q.close(refs.pop().handle);
    const extra = q.open('quota');
    assert.equal(extra.generation, refs[0].generation);
    q.shutdown(); q.shutdown();
    assert.throws(() => d.open('quota'), { code: 'ENOENT' });
    const fresh = d.create('quota');
    assert.notEqual(fresh.generation, extra.generation);
    console.log('PASS session reference cap, recovery after close, idempotent shutdown and recreation');

    const raw = spawnSync(process.execPath, [__filename, 'raw-shutdown', JSON.stringify(a.endpoint)], { timeout: 6000, encoding: 'utf8' });
    assert.equal(raw.status, 0, raw.stderr || String(raw.error));
    console.log('PASS shutdown releases before acknowledgement without relying on EOF');

    const survivor = d.open('owner-blocked');
    c.shutdown();
    assert.equal(d.set(survivor.handle), true);
    assert.equal(d.acquire(survivor.handle), true);
    assert.throws(() => d.acquire(h.handle), { code: 'EBADHANDLE' });
    console.log('PASS session shutdown preserves other owned references');

    const bridge = client(); bridge.create('bridge-only');
    await bridge.worker.terminate();
    bridge.timeoutMs = 100;
    assert.throws(() => bridge.open('owner-blocked'), { code: 'ETIMEDOUT' });
    assert.throws(() => bridge.open('owner-blocked'), { code: 'ECLOSED' });
    console.log('PASS dead transport worker yields bounded failure and poisons client');

    const directory = a.directory;
    const closing = a.close(); assert.equal(a.close(), closing); await closing;
    assert.equal(fs.existsSync(directory), false);
    assert.throws(() => d.set(survivor.handle), { code: 'ECONNECTION' });
    assert.throws(() => d.set(survivor.handle), { code: 'ECLOSED' });
    assert.throws(() => new NamedEventClient(a.endpoint), { code: 'ECONNECTION' });
    console.log('PASS owner shutdown, filesystem cleanup, disconnect and refused connection');
  } finally {
    for (const c of clients) { try { c.shutdown(); } catch {} }
    await a.close();
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
}

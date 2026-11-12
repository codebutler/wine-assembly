'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const { fixtureMap, validate, budget, submit, secondsFor, eligibleIdle, descendants, serverFor } = require('./silver-control-comparison');
test('bounded600s configuration and submission reject late requests and preserve world observation reserve', () => {
  assert.equal(secondsFor({}), 300); assert.equal(secondsFor({ seconds: 600 }), 600);
  assert.throws(() => secondsFor({ seconds: 601 })); assert.throws(() => secondsFor({ seconds: 0 }));
  assert.throws(() => budget({ action: 'mark-world' }, 60000, 1), /at least60/);
  assert.doesNotThrow(() => budget({ action: 'mark-world' }, 60000, 0));
  assert.throws(() => budget({ purpose: 'ground' }, 25000, 1), /at least25/);
  assert.throws(() => budget({ action: 'shot' }, 5000, 5000), /deadline passed/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'silver-deadline-'));
  try {
    const s = fs.readFileSync('/proc/' + process.pid + '/stat', 'utf8');
    const startTicks = s.slice(s.lastIndexOf(')') + 2).split(' ')[19];
    const state = { closing: false, deadlineAt: 1000, driver: { pid: process.pid, startTicks } };
    fs.writeFileSync(path.join(dir, 'control-state.json'), JSON.stringify(state));
    assert.throws(() => submit(dir, 0, { action: 'shot', name: 'late' }, 1001), /deadline passed/);
    assert(!fs.existsSync(path.join(dir, 'command-0.json')), 'Late request must not appear queued');
    assert.doesNotThrow(() => submit(dir, 0, { action: 'shot', name: 'early' }, 999));
    assert.throws(() => submit(dir, 0, { action: 'shot', name: 'duplicate' }, 999), /already exists/);
    fs.writeFileSync(path.join(dir, 'control-state.json'), JSON.stringify({ ...state, closing: true }));
    assert.throws(() => submit(dir, 1, { action: 'shot' }, 999), /already closed/);
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test('failed idle integrity and reused parent PID cannot qualify a baseline or descendant', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'silver-idle-'));
  const save = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value));
  try {
    save('preflight.json', { fingerprint: 'paired' }); save('errors.json', []);
    save('world-checkpoint.json', { readiness: 'Observed house' });
    const cleanup = { mode: 'idle', code: 0, survivors: [], postflightPassed: false };
    save('cleanup-supervisor.json', cleanup);
    assert.throws(() => eligibleIdle(dir, 'paired'), /Idle postflight integrity/);
    save('cleanup-supervisor.json', { ...cleanup, postflightPassed: true });
    assert.doesNotThrow(() => eligibleIdle(dir, 'paired'));
    assert.throws(() => eligibleIdle(dir, 'different'));
    const parent = { pid: 2, ppid: 1, startTicks: 'old' }, owned = new Map([[2, parent]]);
    descendants([{ ...parent, startTicks: 'reused' }, { pid: 3, ppid: 2, startTicks: 'child' }], owned, 1);
    assert(!owned.has(3), 'Unrelated child of reused parent must not be adopted');
    descendants([parent, { pid: 3, ppid: 2, startTicks: 'child' }, { pid: 4, ppid: 3, startTicks: 'grandchild' }], owned, 1);
    assert(owned.has(3) && owned.has(4));
  } finally { fs.rmSync(dir, { recursive: true }); }
});
test('idle rejects world actions; review hash and exact Start hold are required', () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'silver-contract-'));
  try {
    const bytes = Buffer.from('review-fixture-only'); fs.writeFileSync(path.join(out, 'screen.png'), bytes);
    const review = { name: 'screen', scene: 'world', description: 'fixture checkpoint', sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
    const ground = { action: 'left-hold', purpose: 'ground', x: 410, y: 330, holdMs: 1000, review };
    assert.throws(() => validate(ground, 'idle', 'world', out), /Idle session/);
    assert.throws(() => validate(ground, 'input', 'started', out), /Mark\/review/);
    assert.doesNotThrow(() => validate(ground, 'input', 'world', out));
    assert.throws(() => validate({ ...ground, holdMs: 80 }, 'input', 'world', out), /one-second/);
    assert.throws(() => validate({ ...ground, review: { ...review, sha256: 'bad' } }, 'input', 'world', out), /actual captured image/);
    assert.throws(() => validate({ ...ground, action: 'key' }, 'input', 'world', out));
    const start = { ...ground, x: 320, y: 362, purpose: 'start', review: { ...review, scene: 'menu' } };
    assert.doesNotThrow(() => validate(start, 'idle', 'menu', out));
    assert.doesNotThrow(() => validate({ ...start, action: 'relative', dx: 0, dy: 112 }, 'input', 'menu', out));
    assert.throws(() => validate({ ...start, action: 'relative', dx: 0, dy: 0 }, 'input', 'menu', out));
    assert.throws(() => validate({ action: 'mark-world', review, readiness: '' }, 'idle', 'started', out));
  } finally { fs.rmSync(out, { recursive: true }); }
});
test('original mixed-case native DLL paths and ZIP ranges are served without fallback DLLs', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silver-route-'));
  let server;
  try {
    const fixture = path.join(root, 'fixture'); fs.mkdirSync(fixture);
    fs.writeFileSync(path.join(fixture, 'Mss32.dll'), 'original-native');
    const zip = path.join(root, 'source.zip'); fs.writeFileSync(zip, '0123456789');
    const map = fixtureMap([{ path: 'Mss32.dll' }]);
    assert.throws(() => fixtureMap([{ path: 'Mss32.dll' }, { path: 'mss32.dll' }]), /Case-colliding/);
    server = serverFor({ root, fixture, zip }, map);
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port;
    const native = await fetch(base + '/fixture/mss32.dll'); assert.equal(await native.text(), 'original-native');
    assert.equal(native.headers.get('cross-origin-embedder-policy'), 'require-corp');
    const range = await fetch(base + '/SilverDemo.zip', { headers: { Range: 'bytes=2-5' } });
    assert.equal(range.status, 206); assert.equal(await range.text(), '2345'); assert.equal(range.headers.get('content-range'), 'bytes 2-5/10');
    const invalid = await fetch(base + '/SilverDemo.zip', { headers: { Range: 'bytes=15-' } }); assert.equal(invalid.status, 416);
    assert.equal((await fetch(base + '/test/binaries/dlls/mss32.dll')).status, 404);
    assert.equal((await fetch(base + '/src/main.watx')).status, 404);
    assert.equal((await fetch(base + '/fixture/missing.dll')).status, 404);
  } finally { server?.closeAllConnections(); if (server) await new Promise(r => server.close(r)); fs.rmSync(root, { recursive: true }); }
});

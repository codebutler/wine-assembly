#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const source = require('node:path').resolve(process.argv[2] || require('node:path').join(__dirname, '../lib/vfs-persistence.js'));
const { createIndexedDbStorage } = require(source);

// Drive the public default adapter with independently scheduled IDB events.
// No options.adapter, extracted implementation, or replacement getAll is used.
const tick = async () => { for (let i = 0; i < 6; i++) await new Promise(setImmediate); };
function track(promise) {
  const state = { outcome: 'pending', deliveries: 0 };
  promise.then(value => Object.assign(state, { outcome: 'fulfilled', value, deliveries: state.deliveries + 1 }),
    error => Object.assign(state, { outcome: 'rejected', error, deliveries: state.deliveries + 1 }));
  return state;
}
async function setup(failureStage) {
  const sentinel = new Error('synchronous ' + failureStage);
  const calls = [], reports = [];
  let opens = 0;
  const database = {
    transaction(store, mode) {
      assert.equal(store, 'files');
      if (failureStage === mode) throw sentinel;
      const request = {};
      const tx = { mode, error: null, advances: 0, operations: [] };
      const storeObject = {
        openCursor() { if (failureStage === 'cursor') throw sentinel; return request; },
        put(value, key) { tx.operations.push(['put', key, value]); return {}; },
        delete(key) { tx.operations.push(['delete', key]); return {}; },
      };
      tx.objectStore = name => {
        assert.equal(name, 'files');
        if (failureStage === 'store') throw sentinel;
        return storeObject;
      };
      tx.row = (key, value) => {
        request.result = { key, value, continue() { tx.advances++; } };
        request.onsuccess({ target: request });
      };
      tx.end = () => { request.result = null; request.onsuccess({ target: request }); };
      tx.event = (type, error) => {
        tx.error = error;
        if (tx['on' + type]) tx['on' + type]({ target: tx, type });
      };
      calls.push(tx);
      return tx;
    },
  };
  global.indexedDB = {
    open(name, version) {
      assert.equal(name, 'wine-vfs-persist'); assert.equal(version, 1); opens++;
      const request = { result: database };
      setImmediate(() => request.onsuccess({ target: request }));
      return request;
    },
  };
  const state = track(createIndexedDbStorage({ onError: text => reports.push(text) }));
  await tick();
  return { state, calls, reports, sentinel, opens: () => opens, clearFailure: () => { failureStage = null; } };
}
const cases = [];
const test = (name, body) => cases.push([name, body]);
for (const errorKind of ['object', 'null', 'undefined']) {
  test('partial unexhausted cursor abort: ' + errorKind, async () => {
    const { state, calls, reports, opens } = await setup();
    const tx = calls[0];
    assert.equal(tx.mode, 'readonly');
    tx.row('first', 'partial'); tx.row('second', 'also partial');
    await tick(); assert.equal(state.outcome, 'pending'); assert.equal(tx.advances, 2);
    const error = errorKind === 'object' ? Object.freeze({ name: 'AbortError', message: 'identity sentinel' }) : errorKind === 'null' ? null : undefined;
    tx.event('abort', error); await tick();
    assert.equal(state.outcome, 'rejected');
    if (error) assert.equal(state.error, error);
    else { assert.ok(state.error instanceof Error); assert.equal(state.error.message, 'indexedDB transaction aborted'); }
    assert.equal(state.value, undefined); assert.equal(state.deliveries, 1);
    assert.deepEqual(reports, []); assert.equal(opens(), 1);
    // Adversarial late notifications cannot change a settled promise.
    const rejected = state.error;
    tx.end(); tx.event('complete', null); tx.event('error', new Error('late'));
    await tick(); assert.equal(state.outcome, 'rejected'); assert.equal(state.error, rejected); assert.equal(state.deliveries, 1);
  });
}
for (const sequence of [['error', 'abort', 'complete'], ['abort', 'error', 'complete'], ['abort', 'complete', 'error'], ['complete', 'error', 'abort']]) {
  test('first terminal event wins: ' + sequence.join('/'), async () => {
    const { state, calls } = await setup();
    const tx = calls[0]; tx.row('saved', 'committed only on complete'); tx.end();
    await tick(); assert.equal(state.outcome, 'pending');
    const first = new Error('first ' + sequence[0]);
    tx.event(sequence[0], first); await tick();
    for (const type of sequence.slice(1)) { tx.event(type, new Error('later ' + type)); await tick(); }
    assert.equal(state.deliveries, 1);
    if (sequence[0] === 'complete') {
      assert.equal(state.outcome, 'fulfilled'); assert.equal(state.value.getItem('saved'), 'committed only on complete');
    } else { assert.equal(state.outcome, 'rejected'); assert.equal(state.error, first); assert.equal(state.value, undefined); }
  });
}
for (const failure of ['readonly', 'store', 'cursor']) {
  test('synchronous initial failure rejects: ' + failure, async () => {
    const { state, sentinel, reports, opens } = await setup(failure);
    assert.equal(state.outcome, 'rejected'); assert.equal(state.error, sentinel);
    assert.equal(state.value, undefined); assert.equal(state.deliveries, 1);
    assert.deepEqual(reports, []); assert.equal(opens(), 1);
  });
}
for (const operation of ['put', 'delete']) {
  test('synchronous write construction failure drains and recovers: ' + operation, async () => {
    const env = await setup('readwrite'); const tx = env.calls[0];
    tx.row('existing', 'old'); tx.end(); tx.event('complete', null); await tick();
    assert.equal(env.state.outcome, 'fulfilled');
    const storage = env.state.value;
    if (operation === 'put') storage.setItem('existing', 'new'); else storage.removeItem('existing');
    const done = track(storage.settled()); await tick();
    assert.equal(done.outcome, 'fulfilled');
    assert.deepEqual(env.reports, ['IndexedDB ' + (operation === 'put' ? 'write' : 'delete') + ' existing: synchronous readwrite']);
    assert.equal(storage.getItem('existing'), operation === 'put' ? 'new' : null);
    env.clearFailure(); storage.setItem('next', 'ok');
    const next = track(storage.settled()); await tick();
    assert.equal(next.outcome, 'pending'); assert.equal(env.calls.length, 2);
    assert.deepEqual(env.calls[1].operations, [['put', 'next', 'ok']]);
    env.calls[1].event('complete', null); await tick();
    assert.equal(next.outcome, 'fulfilled'); assert.equal(env.opens(), 1);
  });
}
(async () => {
  const descriptor = Object.getOwnPropertyDescriptor(global, 'indexedDB');
  let failed = 0;
  try {
    for (const [name, body] of cases) {
      try { await body(); console.log('PASS ' + name); }
      catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
    }
  } finally {
    if (descriptor) Object.defineProperty(global, 'indexedDB', descriptor); else delete global.indexedDB;
  }
  console.log(`${cases.length - failed} PASS ${failed} FAIL`); process.exitCode = failed ? 1 : 0;
})();

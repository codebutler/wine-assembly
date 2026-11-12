#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { createIndexedDbStorage } = require(process.env.VFS_PERSISTENCE_SOURCE || '../lib/vfs-persistence');

// Event-controlled IndexedDB surface, not an adapter replacement. The production
// open/cursor/transaction handlers and write queue run for every case.
function fakeIndexedDB() {
  const transactions = [];
  let opens = 0;
  const database = {
    transaction(name, mode) {
      assert.strictEqual(name, 'files');
      const cursor = {};
      const tx = {
        mode, error: null, continued: 0, operations: [],
        objectStore(store) {
          assert.strictEqual(store, 'files');
          return {
            openCursor: () => cursor,
            put(value, key) { tx.operations.push(['put', key, value]); return {}; },
            delete(key) { tx.operations.push(['delete', key]); return {}; },
          };
        },
        row(key, value) {
          cursor.result = { key, value, continue() { tx.continued++; } };
          cursor.onsuccess();
        },
        exhausted() { cursor.result = null; cursor.onsuccess(); },
        complete() { if (tx.oncomplete) tx.oncomplete(); },
        fail(error) { tx.error = error; if (tx.onerror) tx.onerror(); },
        abort(error = null) { tx.error = error; if (tx.onabort) tx.onabort(); },
      };
      transactions.push(tx);
      return tx;
    },
  };
  return {
    transactions,
    get opens() { return opens; },
    open(name, version) {
      assert.strictEqual(name, 'wine-vfs-persist');
      assert.strictEqual(version, 1);
      opens++;
      const request = { result: database };
      queueMicrotask(() => request.onsuccess());
      return request;
    },
  };
}

// Fixed turns, no race against wall time and no unbounded await of the promise
// under test. A missing event handler deterministically leaves state pending.
async function turns() {
  for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve));
}
function observe(promise) {
  const state = { status: 'pending' };
  promise.then(value => Object.assign(state, { status: 'fulfilled', value }),
    error => Object.assign(state, { status: 'rejected', error }));
  return state;
}
async function start() {
  const idb = fakeIndexedDB();
  global.indexedDB = idb;
  const errors = [];
  const state = observe(createIndexedDbStorage({ onError: error => errors.push(error) }));
  await turns();
  assert.strictEqual(idb.transactions.length, 1);
  assert.strictEqual(idb.transactions[0].mode, 'readonly');
  assert.strictEqual(state.status, 'pending');
  return { idb, tx: idb.transactions[0], state, errors };
}

const cases = [];
const test = (name, body) => cases.push([name, body]);
test('successful empty read waits for transaction completion', async () => {
  const { tx, state } = await start();
  tx.exhausted(); await turns();
  assert.strictEqual(state.status, 'pending');
  tx.complete(); await turns();
  assert.strictEqual(state.status, 'fulfilled');
  assert.strictEqual(state.value.length, 0);
});
test('successful rows retain conversion, order and default adapter', async () => {
  const { tx, state, idb } = await start();
  tx.row(12, 34); tx.row('save', 'payload'); tx.exhausted();
  await turns(); assert.strictEqual(state.status, 'pending');
  tx.complete(); await turns();
  assert.strictEqual(state.status, 'fulfilled');
  assert.strictEqual(state.value.length, 2);
  assert.strictEqual(state.value.key(0), '12');
  assert.strictEqual(state.value.getItem('12'), '34');
  assert.strictEqual(state.value.getItem('save'), 'payload');
  assert.strictEqual(tx.continued, 2);
  assert.strictEqual(idb.opens, 1);
});
for (const withError of [true, false]) {
  test(`read error ${withError ? 'preserves error' : 'uses fallback'}`, async () => {
    const { tx, state } = await start();
    const error = withError ? new Error('read sentinel') : null;
    tx.fail(error); await turns();
    assert.strictEqual(state.status, 'rejected');
    if (error) assert.strictEqual(state.error, error);
    else assert.strictEqual(state.error.message, 'indexedDB read failed');
  });
  for (const partial of [false, true]) {
    test(`explicit read abort error=${withError} partial=${partial}`, async () => {
      const { tx, state, errors, idb } = await start();
      if (partial) { tx.row('save', 'uncommitted'); tx.exhausted(); }
      await turns(); assert.strictEqual(state.status, 'pending');
      const error = withError ? new Error('abort sentinel') : null;
      // Explicit abort alone: IndexedDB need not dispatch an error event.
      tx.abort(error); await turns();
      assert.strictEqual(state.status, 'rejected', 'abort must settle restore by rejection');
      if (error) assert.strictEqual(state.error, error);
      else assert.strictEqual(state.error.message, 'indexedDB transaction aborted');
      assert.strictEqual(state.value, undefined, 'partial storage must never escape');
      assert.deepStrictEqual(errors, [], 'initial restore rejection belongs to caller');
      assert.strictEqual(idb.opens, 1, 'abort must not invent a reopen policy');
    });
  }
}
test('read error then abort keeps first rejection', async () => {
  const { tx, state } = await start();
  const error = new Error('first error');
  tx.fail(error); tx.abort(new Error('later abort')); await turns();
  assert.strictEqual(state.status, 'rejected');
  assert.strictEqual(state.error, error);
});
for (const operation of ['put', 'delete']) {
  for (const withError of [true, false]) {
    test(`write ${operation} abort error=${withError} drains queue and reports`, async () => {
      const { tx, state, idb, errors } = await start();
      tx.exhausted(); tx.complete(); await turns();
      assert.strictEqual(state.status, 'fulfilled');
      const storage = state.value;
      if (operation === 'put') storage.setItem('save', 'value');
      else storage.removeItem('save');
      const settled = observe(storage.settled());
      await turns();
      const write = idb.transactions[1];
      assert.strictEqual(write.mode, 'readwrite');
      assert.strictEqual(write.operations[0][0], operation);
      assert.strictEqual(settled.status, 'pending');
      write.abort(withError ? new Error('write sentinel') : null); await turns();
      assert.strictEqual(settled.status, 'fulfilled');
      assert.deepStrictEqual(errors, [`IndexedDB ${operation === 'put' ? 'write' : 'delete'} save: ${withError ? 'write sentinel' : 'indexedDB transaction aborted'}`]);
      storage.setItem('next', 'ok'); await turns();
      const nextSettled = observe(storage.settled());
      idb.transactions[2].complete(); await turns();
      assert.strictEqual(nextSettled.status, 'fulfilled');
      assert.strictEqual(idb.opens, 1);
    });
  }
}

(async () => {
  const original = Object.getOwnPropertyDescriptor(global, 'indexedDB');
  let failed = 0;
  try {
    for (const [name, body] of cases) {
      try { await body(); console.log(`PASS ${name}`); }
      catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
    }
  } finally {
    if (original) Object.defineProperty(global, 'indexedDB', original);
    else delete global.indexedDB;
  }
  console.log(`${cases.length - failed} PASS ${failed} FAIL`);
  process.exitCode = failed ? 1 : 0;
})();

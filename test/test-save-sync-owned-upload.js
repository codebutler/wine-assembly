#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { VirtualFS } = require('../lib/filesystem');
const saveBundle = require('../lib/save-bundle');
const saveSync = require('../lib/save-sync');

const appId = 'owned_upload';
const bundle = (day, id = appId) => saveBundle.exportBundle({
  appId: id, vfs: new VirtualFS(), patterns: [], store: {},
  createdAt: `2026-10-${day}T00:00:00.000Z`,
});
const ok = { status: 200, ok: true };
const missing = { status: 404, ok: false };
const meta = { ...ok, text: async () => '{"updatedAt":"server-time"}' };
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function input(kind, bytes) {
  if (kind === 'Uint8Array') return bytes.slice();
  const backing = kind === 'Buffer' ? Buffer.alloc(bytes.length + 12, 0xa5)
    : new Uint8Array(bytes.length + 12).fill(0xa5);
  const view = backing.subarray(5, 5 + bytes.length);
  view.set(bytes);
  return view;
}
const equalBytes = (actual, expected) => assert.ok(
  actual.length === expected.length && actual.every((byte, i) => byte === expected[i]),
  'transmitted bytes equal the complete invocation snapshot');

for (const kind of ['Uint8Array', 'subarray', 'Buffer']) {
  test(`push owns ${kind} before asynchronous transport consumes it`, async () => {
    const expected = bundle('20');
    const caller = input(kind, expected);
    const consume = deferred();
    let body;
    let sent;
    let validated;
    let validations = 0;
    const checkingBundle = { readBundle(bytes, options) {
      validations++;
      validated = bytes;
      return saveBundle.readBundle(bytes, options);
    } };
    const pending = saveSync.push({ appId, bundle: caller, saveBundle: checkingBundle,
      fetchImpl: async (url, init) => {
      assert.equal(url, '/api/data/wine-saves-owned_upload');
      assert.equal(init.method, 'POST');
      assert.equal(init.credentials, 'same-origin');
      assert.equal(init.headers['content-type'], 'application/zip');
      body = init.body;
      await consume.promise;
      sent = Uint8Array.from(body);
      return ok;
    } });
    caller.fill(0); // The injected transport has received, but not consumed, its body.
    consume.resolve();
    assert.equal((await pending).bytes, expected.length);
    equalBytes(sent, expected);
    assert.notEqual(body.buffer, caller.buffer);
    assert.equal(body, validated);
    assert.equal(validations, 1);
    assert.equal(saveBundle.readBundle(sent).manifest.appId, appId);
  });

  for (const route of ['no-metadata', 'missing-record', 'older-remote']) {
    test(`sync owns ${kind} across delayed ${route}`, async () => {
      const expected = bundle('20');
      const caller = input(kind, expected);
      const replacement = bundle('01');
      assert.equal(replacement.length, caller.length);
      const remote = bundle('10');
      const metadataReady = deferred();
      const pullReady = deferred();
      const pullStarted = deferred();
      const consume = deferred();
      const writeStarted = deferred();
      let sent;
      let validated;
      let validations = 0;
      const checkingBundle = { readBundle(bytes, options) {
        const parsed = saveBundle.readBundle(bytes, options);
        if (++validations === 1) validated = bytes;
        return parsed;
      } };
      const pending = saveSync.sync({ appId, bundle: caller, saveBundle: checkingBundle,
        fetchImpl: async (url, init) => {
          if (init.method === 'POST') {
            writeStarted.resolve(init.body);
            await consume.promise;
            sent = Uint8Array.from(init.body);
            return ok;
          }
          if (url.endsWith('/metadata')) {
            await metadataReady.promise;
            return route === 'no-metadata' ? missing : meta;
          }
          pullStarted.resolve();
          await pullReady.promise;
          return route === 'missing-record' ? missing
            : { ...ok, arrayBuffer: async () => remote.slice().buffer };
        } });
      caller.set(replacement); // Still a valid bundle, but now older than the remote.
      metadataReady.resolve();
      if (route !== 'no-metadata') {
        await pullStarted.promise;
        caller.fill(0); // A second mutation while pull is suspended.
        pullReady.resolve();
      }
      // Release consumption even if a regression rejects before writing.
      consume.resolve();
      const result = await pending;
      assert.equal(result.action, 'pushed');
      const body = await writeStarted.promise;
      equalBytes(sent, expected);
      assert.notEqual(body.buffer, caller.buffer);
      assert.equal(body, validated, 'validate and upload the same owned bytes');
      assert.equal(validations, route === 'older-remote' ? 2 : 1,
        'local snapshot is validated once, plus the remote bundle when present');
      if (route === 'older-remote') {
        assert.equal(result.manifest.createdAt, '2026-10-20T00:00:00.000Z');
        assert.equal(result.updatedAt, 'server-time');
      }
    });
  }
}

test('invalid invocation bytes never write even if caller immediately repairs them', async () => {
  const valid = bundle('20');
  for (const method of ['push', 'sync']) {
    for (const original of [new Uint8Array(valid.length), bundle('20', 'other_app')]) {
      let requests = 0;
      const pending = saveSync[method]({ appId, bundle: original, fetchImpl: async () => {
        requests++;
        return missing;
      } });
      original.set(valid.subarray(0, original.length));
      await assert.rejects(pending);
      assert.equal(requests, 0);
    }
  }
});

test('snapshot preserves remote-newer and equal timestamp policy', async () => {
  for (const day of ['20', '21']) {
    const local = bundle('20');
    const remote = bundle(day);
    let writes = 0;
    const result = await saveSync.sync({ appId, bundle: local, fetchImpl: async (url, init) => {
      if (init.method === 'POST') { writes++; return ok; }
      if (url.endsWith('/metadata')) return meta;
      return { ...ok, arrayBuffer: async () => remote.slice().buffer };
    } });
    assert.equal(result.action, day === '20' ? 'in-sync' : 'pulled');
    assert.equal(writes, 0);
    if (day === '21') equalBytes(result.bytes, remote);
  }
});

test('owned upload preserves method override and signed-out errors', async () => {
  for (const method of ['push', 'sync']) {
    let writes = 0;
    const pending = saveSync[method]({ appId, bundle: bundle('20'), method: 'PUT',
      endpoint: 'https://example.invalid', fetchImpl: async (url, init) => {
        if (url.endsWith('/metadata')) return missing;
        writes++;
        assert.equal(init.method, 'PUT');
        assert.equal(init.credentials, 'same-origin');
        return { status: 401, ok: false };
      } });
    await assert.rejects(pending, error => error.authRequired === true
      && error.loginUrl === 'https://example.invalid/api/auth/login');
    assert.equal(writes, 1);
  }
});

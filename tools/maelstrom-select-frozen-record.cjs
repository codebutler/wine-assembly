'use strict';
// Host-boundary consumer of the unchanged, instance-owned diagnostic latch.
// This module neither executes guest code nor authenticates arbitrary exports.
const hook = require('./maelstrom-select-completion-hook.cjs');
const { isProxy } = require('node:util').types;
const owners = new WeakSet(), sources = new WeakSet();
const disabled = Object.freeze({ start() {}, observe() { return null; } });
const freeze = x => {
  if (x && typeof x === 'object') {
    for (const v of Object.values(x)) freeze(v);
    Object.freeze(x);
  }
  return x;
};
function createAdapter(instance, options = {}) {
  if (options.enabled !== true) return disabled;
  // The caller must supply the actual instantiated module, never a JSON record.
  const exports = instance.exports;
  if (!exports || isProxy(exports) || owners.has(instance) || sources.has(exports))
    throw Error('duplicate/invalid diagnostic owner');
  const descriptor = Object.getOwnPropertyDescriptor(exports, 'msc_start');
  if (!descriptor || typeof descriptor.value !== 'function' || isProxy(descriptor.value))
    throw Error('own diagnostic start required');
  const persist = options.persist;
  if (typeof persist !== 'function') throw Error('record persistence required');
  const readLive = options.readLive || (() => null), now = options.now || Date.now;
  const oracle = hook.createOracle(instance, exports);
  owners.add(instance); sources.add(exports);
  let started = false, closed = false, last = null;
  function fail(message) { closed = true; throw Error(message); }
  return Object.freeze({
    start() {
      if (started || closed) return fail('diagnostic start already used/closed');
      started = true; // A failed start cannot be retried or reset.
      try {
        const s = hook.snapshot(exports);
        if (hook.FIELDS.some(k => s[k] !== 0)) return fail('diagnostic source is not pristine');
        Reflect.apply(descriptor.value, exports, []);
      } catch (e) { closed = true; throw e; }
    },
    observe(batch) {
      if (!started) return fail('diagnostic start required');
      if (closed) return null;
      try {
        if (!Number.isSafeInteger(batch) || batch < 0) return fail('observation batch required');
        const s = hook.snapshot(exports);
        // A safe return need not contain an attempt. Repeated unchanged parks
        // are polls, not new attempts; only authentic snapshots reach this path.
        if (s.started === 1 && hook.FIELDS.every(k => k === 'started' || s[k] === 0)) return null;
        if (last && hook.FIELDS.every(k => last[k] === s[k])) return null;
        const accepted = oracle.accept(instance, s);
        if (accepted.kind === 'rejected') return fail('select record rejected (identity/counter gap)');
        last = { ...s };
        if (accepted.kind !== 'completion') return null;
        closed = true; // Persist once, even when the sink fails; never replay.
        const event = freeze({
          schema: 'maelstrom-select-frozen-record/v1',
          historicalCompletion: {
            observation: 'historical in-handler observation after real result store',
            attempt: accepted.attempt, result: accepted.result, identity: accepted.identity,
          },
          liveHostObservation: {
            observation: 'later live host state at ordinary run return; not completion-time state',
            batch, timeMs: now(), state: JSON.parse(JSON.stringify(readLive())),
          },
        });
        persist(event);
        return event;
      } catch (e) { closed = true; throw e; }
    },
  });
}
module.exports = { createAdapter };

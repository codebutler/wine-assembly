'use strict';
// Optional companion to the accepted observer. No runtime is loaded here.
const base = require('./maelstrom-event-boundary-observer.cjs');

// Self-contained for serialization into the pinned runner. One call identity,
// constant-size aggregates, one output record. No API-result inference.
function createObserver(emit, options = {}) {
  const { enabled = false } = options;
  // Disabled options are unused: do not read their getters or enumerate them.
  const { startBatch = 36164, endBatch = 36180,
    maxInvocations = 512, maxBytes = 4096 } = enabled ? options : {};
  if (typeof enabled !== 'boolean' || enabled && (!Number.isSafeInteger(startBatch) || startBatch < 0 ||
      !Number.isSafeInteger(endBatch) || endBatch < startBatch || endBatch - startBatch > 4096 ||
      !Number.isInteger(maxInvocations) || maxInvocations < 1 || maxInvocations > 4096 ||
      !Number.isInteger(maxBytes) || maxBytes < 3072 || maxBytes > 8192 ||
      Object.keys(options).some(k => !['enabled', 'startBatch', 'endBatch', 'maxInvocations', 'maxBytes'].includes(k))))
    throw Error('select lifecycle: invalid configuration');
  let batch = null, calls = 0, finished = false, capped = false, closed = false;
  let identity = null, first = null, last = null, arrival = null, previousTick = null;
  let parked = 0, retries = 0, guards = 0, uncleared = 0, unrelated = 0, unknown = 0;
  let progressing = 0, frozen = 0, backwards = 0, missingTicks = 0, returnCandidates = 0;
  let bytes = 0, records = 0, failure = null;
  const unavailable = 'unavailable';
  const get = (e, name, ...args) => {
    try { return typeof e[name] === 'function' ? e[name](...args) >>> 0 : unavailable; }
    catch (_) { return unavailable; }
  };
  function snapshot(e, memory) {
    const s = {};
    for (const k of ['eip', 'esp', 'eax', 'yield_reason', 'last_run_halt', 'tick_count'])
      s[k] = get(e, 'get_' + k);
    s.meta = unavailable; s.stack = unavailable;
    const lo = get(e, 'get_thunk_base'), hi = get(e, 'get_thunk_end');
    if ([s.eip, lo, hi].every(Number.isInteger) && s.eip >= lo && s.eip + 8 <= hi && (s.eip - lo) % 8 === 0)
      s.meta = [get(e, 'thunk_word', s.eip, 0), get(e, 'thunk_word', s.eip, 1)];
    // Only the original select thunk needs a stack read. Never call g2w or
    // guest_read*: their slow paths can mutate emulator state.
    if (s.eip !== 0x075040f8 || !Array.isArray(s.meta) || s.meta[0] !== 0x80000012 || s.meta[1] !== 934) return s;
    const image = get(e, 'get_image_base'), addr = s.esp;
    if (![image, addr].every(Number.isInteger) || addr === 0 || addr + 24 > 0x100000000) return s;
    const start = (addr - image + 0x12000) >>> 0;
    if (start < 0x12000 || start + 24 > 0x08000000) return s;
    try {
      const buffer = memory.buffer;
      if (start + 24 > buffer.byteLength) return s;
      const v = new DataView(buffer);
      s.stack = Array.from({ length: 6 }, (_, i) => v.getUint32(start + i * 4, true));
    } catch (_) { /* explicitly unavailable */ }
    return s;
  }
  const target = s => s.eip === 0x075040f8 && Array.isArray(s.meta) &&
    s.meta[0] === 0x80000012 && s.meta[1] === 934 && Array.isArray(s.stack) && s.stack[0] === 0x7a3362;
  const key = s => [s.eip, s.esp, ...s.meta, ...s.stack].join(':');
  const same = s => target(s) && identity !== null && key(s) === identity.key;
  function note(s, phase, invocation) {
    const point = { batch, windowInvocation: invocation, phase, eip: s.eip, esp: s.esp,
      reason: s.yield_reason, halt: s.last_run_halt, tick: s.tick_count };
    if (!first) first = point;
    last = point;
    if (!identity && !closed && target(s) && s.yield_reason === 8) {
      identity = { key: key(s), thunk: s.eip, esp: s.esp, returnAddress: s.stack[0], apiId: 934 };
      arrival = point; // window may begin after the real arrival
    }
    if (closed || !identity) {
      if (s.yield_reason === 8 && !target(s)) unrelated++;
      return;
    }
    if (same(s) && s.yield_reason === 8) {
      parked++;
      if (previousTick !== null) {
        if (!Number.isInteger(previousTick) || !Number.isInteger(s.tick_count)) missingTicks++;
        else {
          const d = (s.tick_count - previousTick) | 0;
          if (d > 0) progressing++; else if (d === 0) frozen++; else backwards++;
        }
      }
      previousTick = s.tick_count;
    } else if (!(same(s) && s.yield_reason === 0)) {
      if (s.yield_reason === 8) unrelated++;
      // Even this exact boundary tuple could follow callbacks or later code.
      if (s.eip === identity.returnAddress && s.esp === identity.esp + 24 && s.yield_reason === 0)
        returnCandidates++;
      unknown++; closed = true;
    }
  }
  function wrapInstance(instance, memory) {
    if (!enabled) return instance;
    const e = instance.exports, original = e.run;
    if (typeof original !== 'function') throw Error('select lifecycle: missing run');
    const descriptors = Object.getOwnPropertyDescriptors(e);
    let facade;
    descriptors.run = { ...descriptors.run, value: function (...args) {
      const receiver = this === facade ? e : this;
      if (finished || capped || failure || batch === null || batch < startBatch || batch > endBatch)
        return Reflect.apply(original, receiver, args);
      calls++;
      let before;
      try { before = snapshot(e, memory); note(before, 'before', calls); }
      catch (_) { failure = 'snapshot-failure'; }
      let threw = true;
      try { const value = Reflect.apply(original, receiver, args); threw = false; return value; }
      finally {
        if (!failure) try {
          const after = snapshot(e, memory);
          if (!closed && same(before) && same(after) && after.yield_reason === 8) {
            if (!threw && before.yield_reason === 0 && after.last_run_halt !== 4) retries++;
            else if (!threw && before.yield_reason === 8 && after.last_run_halt === 4) guards++;
            else uncleared++;
          }
          note(after, 'after', calls);
          if (threw) { unknown++; closed = true; }
        } catch (_) { failure = 'snapshot-failure'; }
        if (calls >= maxInvocations) capped = true;
      }
    } };
    facade = Object.defineProperties(Object.create(Object.getPrototypeOf(e)), descriptors);
    return new Proxy(instance, { get(t, k) { return k === 'exports' ? facade : Reflect.get(t, k, t); } });
  }
  function finish() {
    if (!enabled || finished) return;
    finished = true;
    const row = { kind: 'select-lifecycle-summary', window: { startBatch, endBatch, maxInvocations },
      calls, first, last, arrival, arrivalEvidence: !arrival ? unavailable : arrival.phase === 'before' ?
        'first-observed-parked; onset-unobserved' : 'post-invocation-arrival', identity,
      parkedSnapshots: parked, observedRetryPairs: retries,
      pendingGuardPairs: guards, otherParkedPairs: uncleared, tickComparisons: { progressing, frozen, backwards, unavailable: missingTicks },
      unrelatedNetWaitSnapshots: unrelated, unknownTransitions: unknown, returnCandidates,
      witnessedReturns: 0, apiCompletion: 'unobserved', apiResult: unavailable, selectDeadline: unavailable,
      hostTickAtSelect: unavailable, tickSource: 'cached exported tick_count; not select host_get_ticks',
      stop: failure || (capped ? 'observation-cap' : batch !== null && batch > endBatch ? 'window-ended' : 'partial-window'),
      coverage: arrival ? 'one select identity; invocation boundaries only' : 'no-qualified-hit; invocation boundaries only',
      limitation: 'Deduplicated records cannot establish stall. EIP/ESP/EAX snapshots cannot prove API return/result; exact dispatch return hook required.' };
    const line = '[MAELSTROM-SELECT] ' + JSON.stringify(row) + '\n';
    const n = Buffer.byteLength(line);
    if (n > maxBytes) { failure = 'byte-cap'; return; }
    bytes = n; records = 1;
    try { emit(line); } catch (_) { failure = 'sink-failure'; }
  }
  return { wrapInstance, setBatch: b => { batch = Number.isSafeInteger(b) && b >= 0 ? b : null; }, finish,
    stats: () => ({ calls, capped, records, bytes, failure }) };
}

function transform(source, options = {}) {
  const { enabled = false } = options;
  if (!enabled) return source;
  const { lifecycle = {} } = options;
  createObserver(() => {}, { ...lifecycle, enabled: true }); // reject before runner/guest execution
  const transformed = base.transform(source, { enabled: true,
    exportsSource: options.exportsSource, schedulerSource: options.schedulerSource });
  return transformed.replace('  const maelstromEvents =',
    `  const maelstromSelect = (${createObserver.toString()})(line => process.stderr.write(line), ${JSON.stringify({ ...lifecycle, enabled: true })});\n  const maelstromEvents =`)
    .replace('maelstromEvents.wrapInstance(await WebAssembly.instantiate(wasmModule, imports), memory)',
      'maelstromEvents.wrapInstance(maelstromSelect.wrapInstance(await WebAssembly.instantiate(wasmModule, imports), memory), memory)')
    .replace('    maelstromEvents.setBatch(batch);', '    maelstromEvents.setBatch(batch);\n    maelstromSelect.setBatch(batch);')
    .replace('  maelstromEvents.finish();', '  maelstromEvents.finish();\n  maelstromSelect.finish();');
}
module.exports = { createObserver, transform };
if (require.main === module) {
  const fs = require('fs'), path = require('path');
  const [mode, input, exportsPath, schedulerPath, output] = process.argv.slice(2);
  if (!['--enable-lifecycle', '--disabled'].includes(mode) || !output || process.argv.length !== 7)
    throw Error('usage: --enable-lifecycle|--disabled RUN_JS EXPORTS_WAT THREAD_MANAGER_JS NEW_ADJACENT_RUN_JS');
  if (path.resolve(input) === path.resolve(output) || path.dirname(path.resolve(input)) !== path.dirname(path.resolve(output)))
    throw Error('select lifecycle: output must be new and adjacent to runner');
  const enabled = mode === '--enable-lifecycle';
  const source = fs.readFileSync(input, 'utf8');
  const options = enabled ? { enabled, exportsSource: fs.readFileSync(exportsPath, 'utf8'),
    schedulerSource: fs.readFileSync(schedulerPath, 'utf8') } : { enabled: false };
  fs.writeFileSync(output, transform(source, options), { flag: 'wx' });
}

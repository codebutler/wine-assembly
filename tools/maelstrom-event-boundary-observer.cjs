'use strict';
// Offline opt-in transform. This file never loads a module or launches a guest.
const fs = require('fs'), crypto = require('crypto'), path = require('path');
const { RUNNER, EXPORTS } = require('./maelstrom-head-yield-observer.cjs');
const SCHEDULER = 'f0a2f006b0eb992bcdb904f10128167b06bfe143ac05661b82f9586d9755bf40';
const MODULE = '8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686';
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const anchors = {
  parse: "const countAddrs = COUNT_SPEC ? COUNT_SPEC.split(',').map(s => parseInt(s, 16)) : [];",
  instance: '  const instance = await WebAssembly.instantiate(wasmModule, imports);',
  module: '    wasmBytes = fs.readFileSync(WASM_PATH);',
  loop: '  for (let batch = 0; batch < MAX_BATCHES && !stopped; batch++) {',
  end: '  traceGateBatch = -1; // back outside the loop: the exit summary is never windowed',
};
function validateConfig(c) {
  if (!c.noBuild || !c.wasmPinned) throw Error('event observer: explicit prebuilt --no-build --wasm required');
  if (c.workerThreads || c.watch) throw Error('event observer: unsupported worker-thread/watch configuration');
  if (c.counts.length !== 2 || c.counts[0] !== 0x7a3362 || c.counts[1] !== 0x7a3366)
    throw Error('event observer: counts must be head,interior in that order');
}
// Serialized into the pinned runner. Only getters and bounded direct reads.
function createObserver(emit, options = {}) {
  const maxRecords = options.maxRecords === undefined ? 16 : options.maxRecords;
  const maxBytes = options.maxBytes === undefined ? 8192 : options.maxBytes;
  if (!Number.isInteger(maxRecords) || maxRecords < 0 || maxRecords > 16 ||
      !Number.isInteger(maxBytes) || maxBytes < 0 || maxBytes > 8192) throw Error('event observer: limits');
  let records = 0, bytes = 0, stopped = false, invocation = 0, batch = null, finished = false;
  const seen = new Set();
  const unavailable = 'unavailable';
  function write(row) {
    if (stopped) return;
    const line = '[MAELSTROM-EVENT] ' + JSON.stringify(row) + '\n';
    const n = Buffer.byteLength(line);
    if (records >= maxRecords || bytes + n > maxBytes) { stopped = true; return; }
    records++; bytes += n;
    // An observer sink failure must not replace a guest exception or skip run.
    // External process/file guards remain in force; no stream is replaced.
    try { emit(line); } catch (_) { stopped = true; }
  }
  function get(e, name, ...args) {
    if (typeof e[name] !== 'function') return unavailable;
    try { return e[name](...args) >>> 0; } catch (_) { return unavailable; }
  }
  function state(e) {
    const s = {};
    for (const k of ['eip', 'edi', 'eax', 'ebp', 'esp', 'yield_reason', 'yield_flag',
      'last_run_halt', 'bp_addr', 'cache_stores', 'cache_clears', 'cache_invals', 'tick_count'])
      s[k] = get(e, 'get_' + k);
    s.entries = [get(e, 'get_count', 0), get(e, 'get_count', 1)];
    // The pinned exports do not expose vsock_sel_deadline. Never guess a getter.
    s.selectDeadline = unavailable;
    return s;
  }
  function thunk(e, ip) {
    const base = get(e, 'get_thunk_base'), end = get(e, 'get_thunk_end');
    if ([ip, base, end].includes(unavailable)) return unavailable;
    if (ip < base || ip + 8 > end || (ip - base) % 8) return 'out-of-range';
    return [get(e, 'thunk_word', ip, 0), get(e, 'thunk_word', ip, 1)];
  }
  function words(e, memory, addr, count) {
    if (addr === unavailable) return unavailable;
    if (addr === 0) return 'NULL';
    if (!Number.isInteger(addr) || addr < 0 || addr + count * 4 > 0x100000000) return 'out-of-range';
    const image = get(e, 'get_image_base');
    if (!memory || !memory.buffer || image === unavailable) return unavailable;
    // Pinned g2w-fast direct window only (03-registers.wat). NEVER call g2w:
    // its slow/miss paths can materialize GPU data, raise SEH or write a
    // sentinel. GUEST_BASE and DIRECT_WINDOW are frozen ABI spans. Reject
    // the complete span before decoding; sparse/DIB addresses are unsupported.
    const buffer = memory.buffer, length = count * 4;
    const start = (addr - image + 0x12000) >>> 0;
    if (start < 0x12000 || start + length > 0x08000000 ||
        start + length > buffer.byteLength) return 'out-of-range';
    try {
      const v = new DataView(buffer), out = [];
      for (let i = 0; i < count; i++) out.push(v.getUint32(start + i * 4, true));
      return out;
    } catch (_) { return unavailable; }
  }
  function detail(e, memory, s, meta) {
    const stack = words(e, memory, s.esp, 6); // return, nfds, read, write, except, timeout
    const d = { thunkWords: meta, stack };
    if (!Array.isArray(meta) || meta[1] !== 934 || !Array.isArray(stack)) return d;
    d.fdSets = stack.slice(2, 5).map(addr => {
      const n = words(e, memory, addr, 1);
      if (!Array.isArray(n)) return n;
      if (n[0] > 64) return 'out-of-range'; // pinned Winsock FD_SETSIZE
      return { count: n[0], prefix: words(e, memory, addr + 4, Math.min(n[0], 2)), truncated: n[0] > 2 };
    });
    d.timeval = words(e, memory, stack[5], 2);
    return d;
  }
  function triggers(e, s) {
    const out = [];
    if (s.eip === 0x7a3362) out.push('head');
    if (s.eip === 0x7a3366) out.push('interior');
    if (s.yield_reason === 8) {
      const meta = thunk(e, s.eip);
      if (Array.isArray(meta) && meta[1] === 934) out.push('select-net-wait');
      else if (s.eip === 0x075040f8 && (meta === unavailable ||
        (Array.isArray(meta) && meta[1] === unavailable))) out.push('select-address-net-wait-unverified');
    }
    return out.filter(k => !seen.has(k));
  }
  function record(e, memory, before, after, context, phase, events, threw) {
    for (const k of events) seen.add(k);
    const s = phase === 'before' ? before : after;
    // Halt 4 is the pinned pre-dispatch blocking-reason guard. Entry counters
    // increment earlier. Do not infer dispatch/API completion from their delta.
    const pending = phase !== 'before' && !threw && after.last_run_halt === 4 &&
      [1, 5, 7, 8, 9, 10, 12, 13, 14, 15, 16, 18].includes(before.yield_reason) &&
      after.eip === before.eip && after.yield_reason === before.yield_reason;
    write({ kind: phase, ...context, events, before, ...(after ? { after } : {}),
      observation: pending ? 'pending-reason-guard-before-dispatch' : 'boundary-only',
      apiCompletion: 'unobserved', apiResult: 'unattributed', movCallExecuted: pending ? false : 'UNKNOWN',
      threw, detail: detail(e, memory, s, thunk(e, s.eip)) });
  }
  function wrapInstance(instance, memory) {
    const e = instance.exports;
    if (typeof e.run !== 'function') throw Error('event observer: missing run');
    const descriptors = Object.getOwnPropertyDescriptors(e), original = e.run;
    let facade;
    const observe = f => { try { return f(); } catch (_) { stopped = true; return null; } };
    descriptors.run = { ...descriptors.run, value: function (...args) {
      if (stopped) return Reflect.apply(original, this === facade ? e : this, args);
      const context = { invocation: ++invocation, batch, runArgs: args };
      const before = observe(() => state(e));
      const events = before ? observe(() => triggers(e, before)) : null;
      if (events && events.length) observe(() => record(e, memory, before, null, context, 'before', events, false));
      let threw = true;
      try {
        const result = Reflect.apply(original, this === facade ? e : this, args);
        threw = false; return result;
      } finally {
        if (!stopped && before) observe(() => {
          const after = state(e), arrivals = triggers(e, after);
          if (arrivals.length || (events && events.length))
            record(e, memory, before, after, context, 'after', arrivals, threw);
        });
      }
    } };
    facade = Object.defineProperties(Object.create(Object.getPrototypeOf(e)), descriptors);
    // Proxy the INSTANCE, not the immutable WASM export object: substituting a
    // frozen export's run through a Proxy get trap violates JS invariants.
    return new Proxy(instance, { get(t, key) { return key === 'exports' ? facade : Reflect.get(t, key, t); } });
  }
  return { wrapInstance, setBatch: b => { batch = b; },
    finish: () => { if (finished) return; finished = true; write({ kind: 'summary', recordsBeforeSummary: records, bytesBeforeSummary: bytes,
      seen: [...seen], coverage: 'main invocation boundaries only; internal visits unobserved',
      apiCompletion: 'unobserved', movCallExecuted: 'UNKNOWN' }); },
    stats: () => ({ records, bytes, stopped }) };
}
function transform(source, { enabled = false, exportsSource, schedulerSource } = {}) {
  if (!enabled) return source;
  if (sha(source) !== RUNNER) throw Error('event observer: runner pin');
  if (!exportsSource || sha(exportsSource) !== EXPORTS) throw Error('event observer: exports pin');
  if (!schedulerSource || sha(schedulerSource) !== SCHEDULER) throw Error('event observer: scheduler pin');
  for (const [key, value] of Object.entries(anchors))
    if (source.split(value).length !== 2) throw Error('event observer: anchor ' + key);
  source = source.replace(anchors.parse, anchors.parse + `\n(${validateConfig.toString()})({
    noBuild: NO_BUILD, wasmPinned: WASM_PINNED,
    workerThreads: WORKER_THREADS, watch: WATCH_SPEC || WATCH_BYTE || WATCH_WORD, counts: countAddrs });
if (require('crypto').createHash('sha256').update(require('fs').readFileSync(
    require('path').join(__dirname, '../lib/thread-manager.js'))).digest('hex') !== '${SCHEDULER}')
  throw Error('event observer: installed scheduler pin');`);
  source = source.replace(anchors.module, anchors.module + `
    if (require('crypto').createHash('sha256').update(wasmBytes).digest('hex') !== '${MODULE}')
      throw Error('event observer: module pin');`);
  source = source.replace(anchors.instance, `  const maelstromEvents = (${createObserver.toString()})(line => process.stderr.write(line));
  const instance = maelstromEvents.wrapInstance(await WebAssembly.instantiate(wasmModule, imports), memory);`);
  source = source.replace(anchors.loop, anchors.loop + '\n    maelstromEvents.setBatch(batch);');
  return source.replace(anchors.end, '  maelstromEvents.finish();\n' + anchors.end);
}
module.exports = { createObserver, transform, validateConfig, anchors, RUNNER, EXPORTS, SCHEDULER, MODULE };
if (require.main === module) {
  const [mode, input, exportsPath, schedulerPath, output] = process.argv.slice(2);
  if (!['--enable', '--disabled'].includes(mode) || !output || process.argv.length !== 7)
    throw Error('usage: --enable|--disabled RUN_JS EXPORTS_WAT THREAD_MANAGER_JS NEW_ADJACENT_RUN_JS');
  if (path.resolve(input) === path.resolve(output) || path.dirname(path.resolve(input)) !== path.dirname(path.resolve(output)))
    throw Error('event observer: output must be new and adjacent to runner');
  fs.writeFileSync(output, transform(fs.readFileSync(input, 'utf8'), { enabled: mode === '--enable',
    exportsSource: fs.readFileSync(exportsPath, 'utf8'), schedulerSource: fs.readFileSync(schedulerPath, 'utf8') }), { flag: 'wx' });
}

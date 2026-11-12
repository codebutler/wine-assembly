'use strict';
function installEmissionObserver(host, getOwner, emit, clock = () => performance.timeOrigin + performance.now()) {
  const originals = { glide_submit: host.glide_submit, get_key_down_state: host.get_key_down_state, log: host.log };
  if (Object.values(originals).some(f => typeof f !== 'function')) throw Error('real import missing');
  let armedAt = null, events = 0, swaps = 0, closed = false, overflow = false, drawEntries = 0, drawsSinceSwap = 0, drawErrors = 0;
  const report = record => { try { emit(record); } catch (_) {} };
  function readGuest(ex, memory, pureG2w, imageBase, address, size) {
    if (!Number.isInteger(address) || address < 256 || address + size > 0x100000000) return { absent: 'invalid guest range' };
    const buffer = memory.buffer, bytes = new Uint8Array(buffer), out = [], mappings = [];
    for (let i = 0; i < size; i++) {
      const wa = pureG2w(address + i, imageBase, buffer) >>> 0;
      if (wa < 256 || wa >= bytes.length) return { absent: 'unmapped guest byte', address: address + i };
      mappings.push(wa); out.push(bytes[wa]);
    }
    if (memory.buffer !== buffer || (ex.get_image_base() >>> 0) !== imageBase) return { absent: 'mapping identity changed' };
    for (let i = 0; i < size; i++) if ((pureG2w(address + i, imageBase, buffer) >>> 0) !== mappings[i]) return { absent: 'mapping changed during read' };
    return { address, hex: out.map(v => v.toString(16).padStart(2, '0')).join('') };
  }
  function snapshot(op, ptr, length) {
    const { ex, memory, slot, pureG2w } = getOwner();
    if (!ex || !memory || typeof pureG2w !== 'function' || !Number.isInteger(slot)) throw Error('unattributed owning instance');
    const regs = {};
    for (const n of ['get_current_thread_id', 'get_eip', 'get_esp', 'get_image_base']) regs[n] = ex[n]() >>> 0;
    if (!regs.get_eip || !regs.get_esp) throw Error('inactive owning instance');
    if (![op, ptr, length].every(v => Number.isInteger(v) && v >= 0 && v <= 0xffffffff) || length > 1048576 || ptr + length > memory.buffer.byteLength) throw Error('packet bounds');
    const packet = new Uint8Array(memory.buffer, ptr, length), view = new DataView(memory.buffer, ptr, length);
    const hex = (start, size) => Array.from(packet.subarray(start, start + size), b => b.toString(16).padStart(2, '0')).join('');
    const counts = {}, records = []; let offset = 0, count = 0;
    if (op === 0) while (offset < length) {
      if (++count > 4096 || length - offset < 8) throw Error('record cap/truncated header');
      const kind = view.getUint32(offset, true), n = view.getUint32(offset + 4, true), padded = Math.ceil(n / 4) * 4;
      if (padded > length - offset - 8) throw Error('truncated record');
      counts[kind] = (counts[kind] || 0) + 1;
      if (records.length < 24) records.push({ offset, kind, bytes: n, statePrefixHex: hex(offset + 8, Math.min(n, 256)), payloadHex: n <= 516 ? hex(offset + 8, n) : null });
      offset += 8 + padded;
    }
    return { slot, regs, flushStack: readGuest(ex, memory, pureG2w, regs.get_image_base, regs.get_esp, 192), code: readGuest(ex, memory, pureG2w, regs.get_image_base, regs.get_eip, 48), opcode: op, packetWa: ptr, packetBytes: length, counts, recordCount: count, records, directPrefixHex: op === 0 ? null : hex(0, Math.min(length, 256)), attribution: 'actual emitting instance; batch stack is flush caller only; raw stack words are not authenticated returns' };
  }
  function key(...args) {
    const value = Reflect.apply(originals.get_key_down_state, this, args);
    try { if (!closed && armedAt === null && (args[0] & 255) === 32 && (value & 0x8000)) { armedAt = clock(); report({ kind: 'arm', at: armedAt, reason: 'actual guest observed ordinary Space down' }); } } catch (_) { report({ kind: 'observer-error', error: 'arm clock failed' }); }
    return value;
  }
  function submit(...args) {
    let record;
    try { if (!closed && armedAt !== null && swaps < 8 && clock() - armedAt < 3000) {
      if (events < 40) {
        events++;
        try { record = { kind: 'emission', ordinal: events, at: clock(), ...snapshot(...args) }; }
        catch (e) { record = { kind: 'observer-error', ordinal: events, error: String(e) }; }
      } else if (!overflow) { overflow = true; report({ kind: 'cap', events }); }
    }
    } catch (_) { report({ kind: 'observer-error', error: 'capture clock failed' }); }
    try { const result = Reflect.apply(originals.glide_submit, this, args); if (record) { record.result = result; try { record.endAt = clock(); } catch (_) { record.clockError = true; } report(record); } if (armedAt !== null && args[0] === 4) { swaps++; drawsSinceSwap = 0; } return result; }
    catch (e) { if (record) { record.originalError = String(e); report(record); } throw e; }
  }
  function log(...args) {
    const result = Reflect.apply(originals.log, this, args);
    try {
      if (closed || armedAt === null || swaps >= 8 || events >= 40 || drawEntries >= 32 || clock() - armedAt >= 3000) return result;
      const { memory } = getOwner(), [ptr, len] = args;
      if (!Number.isInteger(ptr) || !Number.isInteger(len) || ptr < 256 || len < 1 || len > 96 || ptr + len > memory.buffer.byteLength) return result;
      const name = String.fromCharCode(...new Uint8Array(memory.buffer, ptr, len));
      if (!/^_?grDraw(?:Triangle|VertexArray|VertexArrayContiguous|Point|Line)(?:@\d+)?$/.test(name)) return result;
      if (++drawsSinceSwap > 4) return result;
      drawEntries++;
      report({ ...snapshot(0, 0, 0), kind: 'draw-entry', api: name, drawEntry: drawEntries, afterSwap: swaps, at: clock(), attribution: 'actual API-entry owner before handler, stack first word is candidate guest return; authenticate against exact binary' });
    } catch (e) { if (drawErrors++ < 8) report({ kind: 'draw-observer-error', error: String(e) }); }
    return result;
  }
  host.get_key_down_state = key; host.glide_submit = submit; host.log = log;
  return { close() { if (closed) return; closed = true; for (const [n, f] of Object.entries({ glide_submit: submit, get_key_down_state: key, log })) { if (host[n] === f) host[n] = originals[n]; else report({ kind: 'cleanup-error', name: n, error: 'foreign replacement preserved' }); } }, summary() { return { armedAt, events, swaps, drawEntries, overflow, closed }; } };
}
/**
 * Validate a JSON measurement receipt, not the authenticity of its evidence.
 * This emission observer's capped swaps/arm timestamps are NOT a frame counter.
 *
 * Receipt contract (see focused tests for a complete synthetic example):
 * source: nonempty capture/evidence reference; environment: 'browser';
 * moduleSha256: exact tested module's 64-hex digest;
 * clock: {kind:'host-monotonic', api:'performance.now', unit:'ms',
 *         synthetic:false, origin:<stable clock-domain ID>, source:<reference>};
 * counter: {kind:'logical-game-frame', address:0x43f610, source:<reference>,
 *           exeSha256:<64 hex>, liveCodeVerified:true};
 * coverage: {continuous:true, resetFree:true, enabledThroughout:true,
 *            source:<reference>};
 * gameplay: {continuous:true, ordinaryInput:true, source:<review reference>};
 * samples (>=2): {hostMs, count, enabled:true, generation:<reset epoch>,
 *                owner:{instance:<stable ID>, thread:<integer>},
 *                clockOrigin:<clock.origin>, swaps?:<cumulative Glide swaps>}.
 *
 * Capture count/time together at each boundary in one real host clock domain,
 * with live enable state and reset/owner lifecycle coverage for the FULL interval.
 * Do not derive hostMs from batches, guest ticks, CPU time or requested duration.
 * Zero enabled logical frames is a valid zero rate, not a missing counter.
 * Swaps are optional diagnostics, never divided by two or used as logical frames.
 * Historical 99 callbacks/196 swaps are not an exact 2:1 interval; title/loading
 * also swap without the callback (docs/re-notes/hype.md, 2026-10-10).
 *
 * Actual browser prerequisite: authorized ordinary-input gameplay capture with
 * exact EXE/module identities, authenticated live callback, continuous enabled
 * owner counter/reset coverage, same-domain performance.now boundaries and a
 * continuous gameplay review. This source-only validator performs no capture.
 */
function validateHypeMeasurement(input) {
  // structuredClone preserves raw numeric values (including NaN/Infinity) for
  // callers; the executable accepts JSON and echoes its exact parsed values.
  const raw = structuredClone(input);
  const reasons = [], bad = reason => { if (!reasons.includes(reason)) reasons.push(reason); };
  const text = value => typeof value === 'string' && value.trim().length > 0;
  const count = value => Number.isSafeInteger(value) && value >= 0;
  const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/i.test(value);
  const w = raw || {};
  if (!text(w.source)) bad('missing measurement source');
  if (w.environment !== 'browser') bad('not an actual browser interval');
  const clock = w.clock || {}, counter = w.counter || {};
  if (clock.kind !== 'host-monotonic' || clock.api !== 'performance.now' ||
      clock.unit !== 'ms' || clock.synthetic !== false || !text(clock.origin) || !text(clock.source))
    bad('real monotonic host clock provenance missing');
  if (counter.kind !== 'logical-game-frame' || counter.address !== 0x43f610 ||
      !text(counter.source) || !hash(counter.exeSha256) || counter.liveCodeVerified !== true)
    bad('authenticated Hype logical frame counter missing');
  if (!hash(w.moduleSha256)) bad('actual module identity missing');
  if (w.coverage?.continuous !== true || w.coverage?.resetFree !== true ||
      w.coverage?.enabledThroughout !== true || !text(w.coverage?.source))
    bad('continuous enabled reset-free counter coverage missing');
  if (w.gameplay?.continuous !== true || w.gameplay?.ordinaryInput !== true || !text(w.gameplay?.source))
    bad('continuous ordinary-input gameplay review missing');
  const samples = Array.isArray(w.samples) ? w.samples : [];
  if (samples.length < 2) bad('at least two paired samples required');
  const first = samples[0] || {}, last = samples.at(-1) || {};
  let previous = null;
  const hasSwaps = samples.some(s => s && Object.hasOwn(s, 'swaps'));
  for (const s of samples) {
    if (!s || typeof s !== 'object') { bad('invalid sample'); continue; }
    if (!Number.isFinite(s.hostMs) || s.hostMs < 0 || s.clockOrigin !== clock.origin)
      bad('invalid host timestamp or changed clock domain');
    if (!count(s.count)) bad('missing or invalid logical count');
    if (s.enabled !== true) bad('logical counter disabled or enable state unknown');
    if (!text(s.generation) || s.generation !== first.generation) bad('counter reset epoch missing or changed');
    if (!text(s.owner?.instance) || !count(s.owner?.thread) ||
        s.owner.instance !== first.owner?.instance || s.owner.thread !== first.owner?.thread)
      bad('counter owner missing or changed');
    if (hasSwaps && !count(s.swaps)) bad('missing or invalid swap count');
    if (previous) {
      if (Number.isFinite(s.hostMs) && Number.isFinite(previous.hostMs) &&
          !(s.hostMs > previous.hostMs)) bad('non-monotonic or zero host interval');
      if (count(s.count) && count(previous.count) && s.count < previous.count) bad('logical counter reset or wrap');
      if (hasSwaps && count(s.swaps) && count(previous.swaps) && s.swaps < previous.swaps) bad('swap counter reset or wrap');
    }
    previous = s;
  }
  // Do not coerce malformed JSON objects during rejection: an object with
  // null valueOf/toString properties cannot be converted to a primitive.
  const durationMs = Number.isFinite(last.hostMs) && Number.isFinite(first.hostMs) ? last.hostMs - first.hostMs : NaN;
  const logicalFrames = count(last.count) && count(first.count) ? last.count - first.count : NaN;
  const swaps = hasSwaps ? (count(last.swaps) && count(first.swaps) ? last.swaps - first.swaps : NaN) : null;
  if (!Number.isFinite(durationMs) || durationMs <= 0) bad('invalid host duration');
  const fps = logicalFrames * 1000 / durationMs;
  const swapRate = swaps === null ? null : swaps * 1000 / durationMs;
  if (!Number.isFinite(fps) || (hasSwaps && !Number.isFinite(swapRate))) bad('non-finite rate');
  const accepted = reasons.length === 0;
  return {
    accepted, reasons, source: w.source ?? null, raw,
    metric: 'wall-clock-logical-gameplay-fps',
    fps: accepted ? fps : null,
    durationMs: accepted ? durationMs : null,
    logicalFrames: accepted ? logicalFrames : null,
    glideSwaps: accepted ? swaps : null,
    glideSwapsPerSecond: accepted ? swapRate : null,
    displayedFps: null,
    limitation: 'Validates supplied evidence contract; does not authenticate files or measure displayed frames. No swap-to-frame conversion.'
  };
}
module.exports={installEmissionObserver,validateHypeMeasurement};

if (require.main === module) {
  const fs = require('node:fs');
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node tools/hype-glide-emission-observer.js RECEIPT.json\nValidate a browser wall-clock logical FPS receipt. Exit 0 accepted, 1 rejected, 2 invalid input.\nSee validateHypeMeasurement contract and test/test-hype-glide-emission-observer.js for the schema.\nRequires an authorized real-browser gameplay capture; this command only validates supplied JSON.');
  } else {
    try {
      if (args.length !== 1) throw Error('expected one receipt JSON path');
      const result = validateHypeMeasurement(JSON.parse(fs.readFileSync(args[0], 'utf8')));
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.accepted ? 0 : 1;
    } catch (error) {
      console.error(String(error));
      process.exitCode = 2;
    }
  }
}

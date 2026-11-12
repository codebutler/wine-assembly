// Eval'd inside run.js (ctl eval). Patches the D3D command queue prototype's
// _retire so the FIRST failed draw's payload is written to OUT before _retire
// nulls entry.command (docs/re-notes/black-white-2.md, "Capturing the draw
// that gets -1"). Format = tools/d3d9-replay-payload.js input: typed arrays as
// {$:ctor,b:base64}; textures over 64 KiB keep dims + one texel only.
(() => {
  const OUT = '__OUT__';
  const fs = process.mainModule.require('fs');
  const b = ctx.d3d9Bridge, first = b.devices.values().next().value;
  if (!first) return 'no device yet';
  const proto = Object.getPrototypeOf(first.queue);
  if (proto.__bw2RetireHook) return 'already hooked';
  const enc = (v, depth) => {
    if (v === null || typeof v !== 'object') return typeof v === 'bigint' ? String(v) : v;
    if (ArrayBuffer.isView(v)) return { $: v.constructor.name, b: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64') };
    if (v instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && v instanceof SharedArrayBuffer)) return { elidedBuffer: v.byteLength };
    if (depth > 8) return '[depth]';
    if (Array.isArray(v)) return v.map(x => enc(x, depth + 1));
    const o = {};
    for (const k of Object.keys(v)) o[k] = enc(v[k], depth + 1);
    return o;
  };
  const texture = t => {
    if (!t || typeof t !== 'object') return t;
    const px = t.pixels;
    if (px && ArrayBuffer.isView(px) && px.byteLength > 65536) {
      const { pixels, levels, ...rest } = t;
      return { ...enc(rest, 1), elided: px.byteLength, texel: Array.from(new Uint8Array(px.buffer, px.byteOffset, 4)),
        levelCount: Array.isArray(levels) ? levels.length : undefined };
    }
    return enc(t, 1);
  };
  const state = ctx.bw2RetireHook = { captured: 0, failures: 0, first: null };
  const orig = proto._retire;
  proto.__bw2RetireHook = true;
  proto._retire = function (entry, error) {
    try {
      if (error && !entry.retired && entry.command) {
        state.failures++;
        if (!state.captured) {
          const c = entry.command, p = c.payload || {};
          const payload = { ...p };
          if (Array.isArray(p.textures)) payload.textures = p.textures.map(texture);
          const record = { message: String(error && error.message || error), stack: String(error && error.stack || ''),
            sequence: entry.sequence, submitted: this.submitted, code: c.code ?? c.opcode, wallMs: Date.now(),
            batch: tickState.batch, eip: exports.get_eip() >>> 0, commandKeys: Object.keys(c), payload: enc(payload, 0) };
          fs.writeFileSync(OUT, JSON.stringify(record));
          state.captured = 1; state.first = { message: record.message, sequence: record.sequence, code: record.code };
        }
      }
    } catch (e) { state.hookError = String(e && e.stack || e); }
    return orig.call(this, entry, error);
  };
  return 'hooked ' + b.devices.size + ' device(s)';
})()

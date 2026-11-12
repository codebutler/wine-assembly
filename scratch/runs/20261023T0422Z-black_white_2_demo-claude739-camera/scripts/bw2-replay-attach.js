#!/usr/bin/env node
'use strict';
// Scratch variant of tools/d3d9-replay-payload.js for one B&W2 capture: keeps
// the draw's real attachments (color resource + D24X8 depth) and creates the
// sampled render-target resource, instead of dropping them. Key-resident
// textures become a 1x1 white texel as in the stock tool.
// Usage: node bw2-replay-attach.js REPO PAYLOAD [--fill=gradient|zero] [--target=800x600]
const fs = require('fs'), path = require('path');
const [repo, file] = process.argv.slice(2);
const opt = n => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').slice(n.length + 3);
const TYPED = { Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array };
const revive = v => {
  if (v === null || typeof v !== 'object') return v;
  if (typeof v.$ === 'string' && typeof v.b === 'string') { const b = Buffer.from(v.b, 'base64'); return new TYPED[v.$](b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
  if (Array.isArray(v)) return v.map(revive);
  return Object.fromEntries(Object.keys(v).map(k => [k, revive(v[k])]));
};
(async () => {
  const record = JSON.parse(fs.readFileSync(file, 'utf8')), payload = revive(record.payload);
  const { bootRenderHarness } = require(path.join(repo, 'test', 'render-helper'));
  const { Device } = require(path.join(repo, 'lib', 'd3d9-software-backend'));
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });
  const [tw, th] = (opt('target') || '800x600').split('x').map(Number);
  const device = new Device({ width: tw, height: th, getExports: () => e, getMemory: () => memory.buffer });
  const made = new Set();
  const make = r => {
    if (!r || made.has(r.id)) return; made.add(r.id);
    const bpp = r.format === 23 ? 2 : 4, px = new Uint8Array(r.width * r.height * bpp);
    if (opt('fill') !== 'zero') for (let i = 0; i < px.length; i++) px[i] = (i * 37 + (i >> 9)) & 255;
    device.createColor({ id: r.id, width: r.width, height: r.height, format: r.format }, px, r.width * bpp);
    console.log(`created color resource ${r.id} ${r.width}x${r.height} fmt${r.format}`);
  };
  make(payload.colorAttachment);
  payload.textures = (payload.textures || []).map((t, stage) => {
    if (!t) return null;
    if (t.levels && t.levels.some(l => l.resource)) { t.levels.forEach(l => make(l.resource)); return t; }
    if (t.key || t.levels?.some(l => typeof l.key === 'string')) {
      console.log(`stage${stage}: key texture ${t.width}x${t.height} -> 1x1 white`);
      return { width: 1, height: 1, sampler: t.sampler, pixels: Uint8Array.from([255, 255, 255, 255]) };
    }
    return t;
  });
  console.log('color', JSON.stringify(payload.colorAttachment), 'depth', JSON.stringify(payload.depthAttachment));
  try {
    device.clear([0, 0, 0, 1], 1);
    device.draw(payload);
    console.log('result: drew without error');
  } catch (error) {
    console.log('result: REFUSED --', error && error.message || error);
    process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exit(2); });

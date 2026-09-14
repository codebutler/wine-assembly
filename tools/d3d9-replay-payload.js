#!/usr/bin/env node
// Replay one captured D3D9 draw payload against the software backend.
//
//   node tools/d3d9-replay-payload.js <payload.json> [--png=out.png] [--repeat=N]
//     [--width=W] [--height=H] [--describe] [--json]
//
// A draw that the software rasterizer refuses inside a live guest is expensive
// to study: reaching it takes a full app drive, and the refusal is a single
// integer returned from WAT. This runs the captured draw on its own, in
// process, in about a second -- so the question "which of the rasterizer's
// failure paths is this" can be asked repeatedly instead of once per drive.
//
// The payload format is whatever the capture probe wrote: the draw descriptor
// as plain JSON, with every typed array encoded as {$:'Uint8Array', b:<base64>}
// and each texture reduced to its dimensions plus one texel (a refusal in the
// clipper is about geometry, and real texel arrays are hundreds of KB each).
// Elided textures are rebuilt as a solid 1x1 of the recorded texel, which is
// enough for the draw to execute; --describe reports what was elided so a
// result that actually depends on texture content is not read as ground truth.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--'));
const flag = (name, fallback) => {
  const hit = args.find(a => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
};
const has = name => args.includes(`--${name}`);
if (!file) {
  console.error('usage: d3d9-replay-payload.js <payload.json> [--png=out.png] [--repeat=N]');
  process.exit(2);
}

// Typed arrays come back by constructor name; anything else is passed through.
const TYPED = { Int8Array, Uint8Array, Uint8ClampedArray, Int16Array, Uint16Array,
  Int32Array, Uint32Array, Float32Array, Float64Array };
const revive = value => {
  if (value === null || typeof value !== 'object') return value;
  if (typeof value.$ === 'string' && typeof value.b === 'string') {
    const Ctor = TYPED[value.$];
    if (!Ctor) throw new Error(`unknown typed array ${value.$}`);
    const bytes = Buffer.from(value.b, 'base64');
    return new Ctor(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  }
  if (Array.isArray(value)) return value.map(revive);
  const out = {};
  for (const key of Object.keys(value)) out[key] = revive(value[key]);
  return out;
};

const record = JSON.parse(fs.readFileSync(file, 'utf8'));
const payload = revive(record.payload || record);
const elided = [];
payload.textures = (payload.textures || []).map((t, stage) => {
  if (!t) return null;
  if (t.pixels && t.pixels.length >= 4) return t;
  // A capture keeps one texel; rebuild it as a solid 1x1 so the draw runs.
  elided.push(`stage${stage} ${t.width}x${t.height} (${t.elided} bytes elided)`);
  return { width: 1, height: 1, format: t.format,
    sampler: t.sampler || { min: 1, mag: 1, mip: 0 },
    pixels: Uint8Array.from(t.texel || [255, 255, 255, 255]) };
});

const describe = () => {
  const lines = [];
  if (record.message) lines.push(`message:   ${record.message}`);
  if (record.sequence !== undefined) lines.push(`sequence:  ${record.sequence}`
    + (record.submitted === undefined ? '' : ` of ${record.submitted} submitted`));
  lines.push(`primitive: ${payload.primitive}  count=${payload.primitiveCount}  stride=${payload.stride}`);
  lines.push(`vertices:  ${payload.vertices ? payload.vertices.byteLength : 0} bytes`
    + `  indices=${payload.indices ? payload.indices.length : 0}`);
  lines.push(`attributes: ` + (payload.attributes || []).map(a =>
    `r${a.register}/u${a.usage}.${a.usageIndex}/t${a.type}@${a.offset}`).join(' '));
  lines.push(`shaders:   vs=${payload.vertexShader ? 'yes' : 'no'} ps=${payload.pixelShader ? 'yes' : 'no'}`
    + `  fixedFunction=${payload.fixedFunction ? 'yes' : 'no'}`);
  const clip = payload.userClipPlanes;
  lines.push(`clip:      ${clip ? `mask=0x${(clip.mask >>> 0).toString(16)}` : 'none'}`);
  lines.push(`viewport:  ${payload.viewport ? JSON.stringify(payload.viewport) : 'default'}`);
  if (elided.length) lines.push(`elided:    ${elided.join(', ')}`);
  return lines.join('\n');
};

// $d3d_software_step collapses every refusal into a single -1, so the message
// says nothing about which of the rasterizer's failure paths fired. The context
// itself does: its counters sit at fixed offsets, and they are only written at
// the END of a successful clip slice, so after a failure they describe the
// state at the start of the slice that failed. Read them -- and the raw
// post-vertex-shading vertices the clipper was working on -- instead of adding
// a diagnostic store to src/09ah-d3d-software.wat (which carries another
// agent's uncommitted work).
//
// Context layout, from src/09ah-d3d-software.wat:
//   ctx+36/+48  emitted vertex count      ctx+140 status     ctx+160 setup
//   ctx+200     raw vertices, 144 bytes each, position xyzw first
//   setup+8 vertex cursor  setup+48 triangle cursor  setup+52 user clip mask
//   setup+60 capacity
function bisect(device, payload, exports, memory) {
  const draw = device.prepare(payload, true);
  const u32 = () => new Uint32Array(memory.buffer);
  const f32 = () => new Float32Array(memory.buffer);
  let status = 1, slices = 0, last = 0;
  try {
    while (status === 1) {
      if (draw.context) last = draw.context;
      // One primitive per step once rastering, so the failing triangle is
      // named exactly rather than to within a 256-primitive window.
      status = device.step(draw);
      // step() allocates the context on its first call, so a draw that fails
      // in the very first setup slice has none recorded above.
      if (draw.context) last = draw.context;
      slices++;
      if (slices > 2000000) throw new Error('bisect step limit');
    }
    if (status === 0) { console.log(`bisect:    completed in ${slices} steps`); return; }

    const ctx = last >>> 0, words = u32(), floats = f32();
    const setup = words[(ctx + 160) >> 2] >>> 0;
    const emitted = words[(ctx + 48) >> 2] | 0;
    console.log(`\nbisect:    step returned ${status} after ${slices} steps`);
    console.log(`  ctx=0x${ctx.toString(16)} status@140=${words[(ctx + 140) >> 2] | 0}`
      + ` emitted@48=${emitted} emitted@36=${words[(ctx + 36) >> 2] | 0}`);
    console.log(`  flags@100=0x${(words[(ctx + 100) >> 2] >>> 0).toString(16)}`);
    if (setup) {
      const triangle = words[(setup + 48) >> 2] | 0;
      const mask = words[(setup + 52) >> 2] >>> 0;
      console.log(`  setup=0x${setup.toString(16)} vertexCursor@8=${words[(setup + 8) >> 2] | 0}`
        + ` triangleCursor@48=${triangle} userClipMask@52=0x${mask.toString(16)}`
        + ` capacity@60=${words[(setup + 60) >> 2] | 0}`);
      // The two whole-draw bounds the clipper enforces, against what it reached.
      const indices = payload.indices ? payload.indices.length : payload.primitiveCount * 3;
      console.log(`  bounds:  emitted cap 8192, per-draw cap ${indices * (mask ? 13 : 7)}`
        + ` (indices ${indices} x ${mask ? 13 : 7}); post-clip vertex slots ${mask ? 16 : 12},`
        + ` fan bound ${mask ? 15 : 9}`);
    }
    const raw = words[(ctx + 200) >> 2] >>> 0;
    if (raw) {
      // The first few post-vertex-shading positions. A w at or below zero, or
      // a non-finite coordinate, is visible here and nowhere else.
      const show = Math.min(6, payload.primitiveCount * 3 || 6);
      for (let i = 0; i < show; i++) {
        const at = (raw + i * 144) >> 2;
        console.log(`  v${i}: x=${floats[at]} y=${floats[at + 1]} z=${floats[at + 2]} w=${floats[at + 3]}`);
      }
    }
    throw new Error(`native raster execution failed (${status})`);
  } finally { device.release(draw); }
}

(async () => {
  if (has('describe')) { console.log(describe()); return; }
  // The harness lives under test/ and boots the real WAT exports.
  const { bootRenderHarness } = require(path.join(__dirname, '..', 'test', 'render-helper'));
  const { Device } = require(path.join(__dirname, '..', 'lib', 'd3d9-software-backend'));
  const { exports: e, memory } = await bootRenderHarness({ fonts: 'none' });

  // Default the target to whatever the capture's own attachments say, so the
  // viewport transform the draw was built for still applies.
  const attachment = payload.colorAttachment || payload.depthAttachment || {};
  const width = Number(flag('width', attachment.width || 800));
  const height = Number(flag('height', attachment.height || 600));
  const device = new Device({ width, height,
    getExports: () => e, getMemory: () => memory.buffer });

  // Attachments are references to resources that live in the capturing
  // device's own table, and nothing here can resolve them ('invalid color
  // resource'). Their SIZE is what the draw's viewport transform was built
  // for, and that has already been taken above; drop the references and render
  // to this device's own target instead. Reported, because a draw whose
  // refusal depended on the real attachment would then be replayed wrong.
  const dropped = ['colorAttachment', 'depthAttachment']
    .filter(key => payload[key]).map(key => `${key}=${payload[key].width}x${payload[key].height}`);
  for (const key of ['colorAttachment', 'depthAttachment']) if (payload[key]) payload[key] = null;
  if (dropped.length) console.log(`dropped:   ${dropped.join(' ')} (rendering to this device's target)`);

  console.log(describe());
  console.log(`target:    ${width}x${height}`);

  const repeat = Number(flag('repeat', 1));
  let failure = null;
  try {
    device.clear([0, 0, 0, 1], 1);
    if (has('bisect')) bisect(device, payload, e, memory);
    else for (let i = 0; i < repeat; i++) device.draw(payload);
    console.log(`\nresult:    drew ${repeat} time(s) without error`);
  } catch (error) {
    failure = error;
    console.log(`\nresult:    REFUSED -- ${error && error.message || error}`);
  }

  const png = flag('png', null);
  if (png && !failure) {
    const frame = device.present();
    // pngjs, same as every other tool here.
    const { PNG } = require('pngjs');
    const image = new PNG({ width: frame.width, height: frame.height });
    image.data.set(frame.pixels);
    fs.writeFileSync(png, PNG.sync.write(image));
    console.log(`png:       ${png}`);
  }
  device.destroy();
  if (has('json')) console.log(JSON.stringify({ refused: !!failure,
    message: failure ? String(failure.message || failure) : null }));
  process.exit(failure ? 1 : 0);
})().catch(error => { console.error(error); process.exit(2); });

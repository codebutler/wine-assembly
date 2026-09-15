// Preload for test/run.js: print the OpenGL transport counters while a
// --headless-gl run is going, without editing run.js.
//
//   node -r ./tools/gl-stats-preload.js test/run.js --app=simgolf_demo \
//     --headless-gl --quiet-api --max-batches=100000000 --max-seconds=240
//
// Every GL_STATS_EVERY_MS (default 10000) it prints one `[gl-stats]` line with
// the DELTA since the previous line, per frame, and once more at exit with the
// whole-run totals. A frame is one glFlush or SwapBuffers reaching the
// executor (frontFlushes + presents); SimGolf ends frames with glFlush.
//
// The counters are module-level in lib/gl-command-stream.js and
// lib/gl-compat.js, so they are the same objects run.js's host imports use:
// require() caches one instance per process. All values are counts, so they
// are load-immune. Columns:
//   calls    guest gl*/wgl* calls that crossed wasm->JS
//   spans    glBegin/glEnd spans closed
//   enq      packed spans handed to the executor
//   draws    WebGL draws actually issued (enq/draws = how well spans merge)
//   verts    vertices drawn
'use strict';

const stream = require('../lib/gl-command-stream.js');
const compat = require('../lib/gl-compat.js');

const EVERY_MS = parseInt(process.env.GL_STATS_EVERY_MS || '10000', 10);
const snap = () => ({
  calls: stream.stats.calls, spans: stream.stats.spans,
  byOpcode: Array.from(stream.stats.byOpcode),
  enq: compat.stats.enqueued, draws: compat.stats.draws,
  verts: compat.stats.drawVertices,
  frames: compat.stats.frontFlushes + compat.stats.presents,
});

const line = (label, now, then) => {
  const frames = now.frames - then.frames;
  const per = v => (frames ? (v / frames).toFixed(1) : '-');
  const d = k => now[k] - then[k];
  const ops = [];
  for (let i = 0; i < now.byOpcode.length; i++) {
    const n = now.byOpcode[i] - then.byOpcode[i];
    if (n) ops.push([compat.CALLS[i] || `op${i}`, n]);
  }
  ops.sort((a, b) => b[1] - a[1]);
  const top = ops.slice(0, 8).map(([name, n]) => `${name}=${per(n)}`).join(' ');
  const merge = d('draws') ? (d('enq') / d('draws')).toFixed(2) : '-';
  console.log(`[gl-stats] ${label} frames=${frames} per-frame: calls=${per(d('calls'))}`
    + ` spans=${per(d('spans'))} enq=${per(d('enq'))} draws=${per(d('draws'))}`
    + ` verts=${per(d('verts'))} spans/draw=${merge}`);
  if (top) console.log(`[gl-stats] ${label} top calls/frame: ${top}`);
};

// Reachable from a --control session's `eval`, so a stepped/frozen run can
// snapshot the counters at exactly the moment it chooses:
//   node tools/ctl.js eval 'JSON.stringify(globalThis.__glStats.snap())'
globalThis.__glStats = { snap, stream, compat };

const start = snap();
let previous = start;
const began = Date.now();
const timer = setInterval(() => {
  const now = snap();
  line(`t=${Math.round((Date.now() - began) / 1000)}s`, now, previous);
  previous = now;
}, EVERY_MS);
timer.unref();
process.on('exit', () => line('whole-run', snap(), start));

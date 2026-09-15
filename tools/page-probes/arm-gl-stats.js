// Page probe: snapshot the OpenGL transport counters a while after launch, so
// tools/page-probes/read-gl-stats.js can report a gameplay window rather than
// the whole run. Pair them the same way as the handler-histogram probes:
//
//   node tools/profile-web-frames.js --app=simgolf_demo --headful \
//     --warmup=250 --seconds=20 \
//     --after-launch="window.__glStatsArmDelay=230000;$(cat tools/page-probes/arm-gl-stats.js)" \
//     --report-eval="$(cat tools/page-probes/read-gl-stats.js)"
//
// The counters live in lib/gl-command-stream.js (encoder: guest calls, spans,
// packed records, flushes) and lib/gl-compat.js (executor: enqueued spans,
// WebGL draws, presents). Both are plain counts, so they are load-immune.
setTimeout(function () {
  try {
    var s = window.GLCommandStream.stats, c = window.OpenGLCompat.stats;
    window.__glStatsArm = {
      at: performance.now(),
      stream: { calls: s.calls, byOpcode: Array.from(s.byOpcode), spans: s.spans,
        packedRecords: s.packedRecords, packedVertices: s.packedVertices,
        flushes: s.flushes },
      compat: { enqueued: c.enqueued, draws: c.draws, drawVertices: c.drawVertices,
        presents: c.presents, frontFlushes: c.frontFlushes },
    };
  } catch (err) { window.__glStatsArmError = String(err); }
}, window.__glStatsArmDelay || 230000), 'gl stats armed';

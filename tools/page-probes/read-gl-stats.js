// Page probe: difference the OpenGL transport counters against the snapshot
// tools/page-probes/arm-gl-stats.js took, and report them per frame. A frame
// here is one glFlush or SwapBuffers reaching the executor (frontFlushes +
// presents) -- SimGolf ends frames with glFlush and never swaps.
(function () {
  var arm = window.__glStatsArm;
  if (!arm) return JSON.stringify({ error: window.__glStatsArmError || 'gl stats were never armed' });
  var s = window.GLCommandStream.stats, c = window.OpenGLCompat.stats;
  var names = window.OpenGLCompat.CALLS || [];
  var d = function (now, then) { return now - then; };
  var frames = d(c.frontFlushes, arm.compat.frontFlushes) + d(c.presents, arm.compat.presents);
  var per = function (v) { return frames ? +(v / frames).toFixed(1) : null; };
  var ops = [];
  for (var i = 0; i < s.byOpcode.length; i++) {
    var n = s.byOpcode[i] - arm.stream.byOpcode[i];
    if (n) ops.push([names[i] || ('op' + i), n, per(n)]);
  }
  ops.sort(function (a, b) { return b[1] - a[1]; });
  var calls = d(s.calls, arm.stream.calls), spans = d(s.spans, arm.stream.spans);
  var enq = d(c.enqueued, arm.compat.enqueued), draws = d(c.draws, arm.compat.draws);
  return JSON.stringify({
    windowMs: Math.round(performance.now() - arm.at),
    frames: frames,
    perFrame: {
      guestGlCalls: per(calls), spans: per(spans),
      packedRecords: per(d(s.packedRecords, arm.stream.packedRecords)),
      packedVertices: per(d(s.packedVertices, arm.stream.packedVertices)),
      encoderFlushes: per(d(s.flushes, arm.stream.flushes)),
      enqueuedSpans: per(enq), webglDraws: per(draws),
      drawVertices: per(d(c.drawVertices, arm.compat.drawVertices)),
    },
    totals: { calls: calls, spans: spans, enqueued: enq, draws: draws },
    spansPerDraw: draws ? +(enq / draws).toFixed(2) : null,
    topOpcodes: ops.slice(0, 20),
  });
})();

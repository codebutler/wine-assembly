// Page probe: start a memory time series for a browser run, so "is it leaking?"
// is answered by a slope instead of by an opinion.
//
// Pass as --before-load to tools/profile-web-frames.js and read it back with
// tools/page-probes/read-memory-series.js as --report-eval. It samples every
// SAMPLE_MS from the moment the page script runs, so the series covers app
// load as well as steady state -- a leak that only shows during load is
// invisible to a sampler armed after launch.
//
// WHAT IS SAMPLED AND WHY EACH ONE IS HERE:
//   wasmBytes  the guest's linear memory. It is declared
//              (memory 8192 16384 shared) -- 512MB floor, and it CAN GROW to
//              1GB. A run that climbs here is the sparse/extension arena
//              taking more address space, which is not the same thing as a
//              JS-side leak and has to be told apart from one.
//   jsHeap     performance.memory.usedJSHeapSize. Chrome only, and it is
//              quantised and lags real allocation, so read the trend across
//              many samples and never a single delta.
//   canvases   document.querySelectorAll('canvas').length. A per-window
//              back-canvas that is never released shows up here long before
//              it shows up in the heap number, because the bitmap lives off
//              the JS heap.
//   apps       runningApps.length, to attribute a step change to a launch.
//
// runningApps is a MODULE-SCOPE binding in host.js, not a property of
// globalThis, so it can only be reached by bare name and only inside a
// try/catch -- referencing it before host.js has run is a ReferenceError that
// would kill the sampler on its first tick.
(function () {
  var SAMPLE_MS = 2000;
  var MAX_SAMPLES = 4000;
  var series = [];
  var t0 = 0;
  try { t0 = performance.now(); } catch (_) {}

  function sample() {
    var row = { t: 0, wasmBytes: 0, jsHeap: 0, jsTotal: 0, canvases: 0, apps: 0 };
    try { row.t = Math.round(performance.now() - t0); } catch (_) {}
    try {
      var m = performance.memory;
      if (m) { row.jsHeap = m.usedJSHeapSize | 0; row.jsTotal = m.totalJSHeapSize | 0; }
    } catch (_) {}
    try { row.canvases = document.querySelectorAll('canvas').length; } catch (_) {}
    try {
      var apps = runningApps;
      row.apps = apps.length;
      var w = apps[0] && apps[0].wine;
      var mem = w && (w.memory || (w.instance && w.instance.exports && w.instance.exports.memory));
      if (mem && mem.buffer) row.wasmBytes = mem.buffer.byteLength;
    } catch (_) {}
    if (series.length < MAX_SAMPLES) series.push(row);
    // Also print each row. --report-eval returns nothing when the page has
    // died, and a run that died of memory pressure is precisely the run this
    // probe was written for -- so the series has to survive in the run log
    // too. Pair with --relay='memseries'.
    try {
      console.log('memseries ' + row.t + ' wasm=' + row.wasmBytes +
        ' js=' + row.jsHeap + ' canvas=' + row.canvases + ' apps=' + row.apps);
    } catch (_) {}
  }

  sample();
  var id = setInterval(sample, SAMPLE_MS);
  window.__memSeries = series;
  window.__memSeriesStop = function () { clearInterval(id); };
  window.__memSeriesArmed = 1;
})()

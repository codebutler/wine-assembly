// Page probe: read back the histogram tools/page-probes/arm-handler-hist.js
// armed, disable it, and return everything tools/browser-handler-hist.js needs
// as one JSON string — per-handler counts, the hot-block table, the module
// bases that turn a block address into module+0xVA, and a WinePerf snapshot so
// one run carries both the profile and the frame numbers it belongs to.
// Only a COOPERATIVE run can use this: with --threads the guest main thread
// lives in a Worker and the page instance's counters stay at zero.
(function(){
  var w = runningApps[0].wine, e = w.instance.exports;
  var mem = w.memory || e.memory;
  var m = new Uint32Array(mem.buffer);
  var hb = e.get_handler_hist_base() >>> 2;
  var slots = (e.get_handler_hist_slots ? e.get_handler_hist_slots() : e.get_handler_hist_count()) | 0;
  var H = [], tot = 0;
  for (var i = 0; i < slots; i++) { var h = m[hb + i] >>> 0; tot += h; if (h) H.push([i, h]); }
  H.sort(function(a, b){ return b[1] - a[1]; });
  var bb = e.get_hot_block_hist_base() >>> 2, bc = e.get_hot_block_hist_count() | 0;
  var B = [], bt = 0;
  for (var j = 0; j < bc; j++) {
    var ad = m[bb + j * 2] >>> 0, hh = m[bb + j * 2 + 1] >>> 0;
    if (ad && hh) { bt += hh; B.push([ad.toString(16), hh]); }
  }
  B.sort(function(a, b){ return b[1] - a[1]; });
  e.set_handler_hist_enabled(0);
  var mods = {};
  var mb = w.moduleBases || {};
  for (var k in mb) { mods[k] = [(mb[k].base || mb[k].loadAddr || 0), (mb[k].origBase || 0)]; }
  var perf = null;
  try { perf = window.WinePerf && window.WinePerf.snapshot ? window.WinePerf.snapshot() : null; } catch (_) {}
  return JSON.stringify({ perf: perf, err: window.__histErr || null, armed: window.__histArmed || 0,
    ops: tot, handlers: H.slice(0, 30), blockHits: bt, distinct: B.length,
    blocks: B.slice(0, 40), mods: mods });
})()

// Page probe: arm the emulator's threaded-handler / hot-block histogram inside
// the BROWSER, a while after launch, so the window covers gameplay rather than
// startup. Pair with tools/page-probes/read-handler-hist.js and feed the JSON
// it returns to tools/browser-handler-hist.js.
//
//   node tools/profile-web-frames.js --app=ID --headful --warmup=240 --seconds=20 \
//     --after-launch="$(cat tools/page-probes/arm-handler-hist.js)" \
//     --report-eval="$(cat tools/page-probes/read-handler-hist.js)"
//
// The delay is measured from --after-launch, which runs once the instance is
// up; set window.__histArmDelay before this (or edit the literal) to move it.
// It must land INSIDE the profiler's warmup so the read at the end of the
// sample still sees a live window. --after-launch evaluates this with
// String(eval(js)), hence the trailing comma expression rather than a return.
setTimeout(function () {
  try {
    var e = runningApps[0].wine.instance.exports;
    e.reset_handler_hist();
    e.set_handler_hist_enabled(1);
    window.__histArmed = Date.now();
  } catch (err) { window.__histErr = String(err); }
}, window.__histArmDelay || 230000), 'hist-arm-scheduled'

#!/usr/bin/env node
'use strict';

// SuspendThread(GetCurrentThread()) on the guest's MAIN thread leaves the
// private yield 11. thread-manager parks and resumes it for cooperative and
// guest-worker threads, but the browser Threads route runs MAIN in a Worker
// too, and host.js's Worker-main slice loop had no branch for it: Baldur's Gate
// chapters 1-2 stopped with "[threads] yield 11 is not supported in worker mode
// yet" (WORKER-MAIN-YIELD11-SELFSUSPEND-20261011).

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'host.js'), 'utf8');
const context = {
  console,
  URLSearchParams,
  performance: { now: () => 0 },
  requestAnimationFrame() { return 1; },
  cancelAnimationFrame() {},
  setTimeout() { return 1; },
  clearTimeout() {},
};
vm.runInNewContext(source + '\n;globalThis.WineAssembly = WineAssembly;', context);

// The Worker-main slice loop: a yield-11 branch ahead of the catch-all that
// stops the app, and runMain's gate before it posts a slice.
const threadedStart = source.indexOf('  _runThreaded(stepsPerSlice) {');
const threadedEnd = source.indexOf('\n  // Schedule the next guest slice.', threadedStart);
const threaded = source.slice(threadedStart, threadedEnd);
const branch = threaded.match(/else if \(r\.yield === 11\) \{([\s\S]*?)\n        \} else if/);
assert(branch, 'guest-main Worker loop handles the self-suspend yield 11');
assert(branch[1].includes('self._workerMainSelfSuspend = r'),
  'yield 11 records the parked slice rather than stopping the app');
assert(threaded.indexOf('r.yield === 11') < threaded.indexOf('is not supported in worker mode yet'),
  'the yield-11 branch precedes the unsupported-yield catch-all');
assert(/const selfSuspended = self\._workerMainSelfSuspend;\s*if \(selfSuspended && await self\._workerMainSelfSuspendParked\(\)\) \{\s*return Object\.assign\(\{\}, selfSuspended, \{ blocks: 0, ms: 0 \}\);/
  .test(threaded), 'runMain returns an empty slice while main is still suspended');
assert(threaded.indexOf('_workerMainSelfSuspendParked()') <
  threaded.indexOf('await self.guestWorker.slice(steps, sliceSync)'),
  'the gate runs before the main slice is posted');

(async () => {
  const wine = Object.create(context.WineAssembly.prototype);
  let suspended = true;
  const calls = [];
  wine.threadManager = { isMainThreadSuspended: () => suspended };
  wine.instance = { exports: {} };
  wine.guestWorker = { callExport: async name => { calls.push(name); } };

  assert.strictEqual(await wine._workerMainSelfSuspendParked(), false,
    'nothing parked: the gate is open');

  const slice = { yield: 11, blocks: 1234 };
  wine._workerMainSelfSuspend = slice;
  assert.strictEqual(await wine._workerMainSelfSuspendParked(), true,
    'still suspended: main stays parked');
  assert.deepStrictEqual(calls, [], 'a suspended main keeps its yield');

  suspended = false;  // another thread called ResumeThread
  assert.strictEqual(await wine._workerMainSelfSuspendParked(), false,
    'resumed: the slice may run');
  assert.deepStrictEqual(calls, ['clear_yield'],
    'the private yield is consumed so main continues after SuspendThread');
  assert.strictEqual(wine._workerMainSelfSuspend, null, 'the park is released once');
  assert.strictEqual(await wine._workerMainSelfSuspendParked(), false);
  assert.deepStrictEqual(calls, ['clear_yield'], 'and never clears twice');

  // A borrowed multimedia-timer callback context may suspend the saved main
  // thread on its way to the matching ResumeThread (_isMainExecutionSuspended).
  suspended = true;
  wine._workerMainSelfSuspend = slice;
  wine.instance = { exports: { is_mm_timer_callback_active: () => 1 } };
  assert.strictEqual(await wine._workerMainSelfSuspendParked(), false,
    'the timer-callback exception matches the cooperative loop');

  console.log('PASS browser guest-main Worker parks a self-suspended main thread until it is resumed');
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

// --input=B:tick-ms:N changes how much guest time a batch is worth from batch
// B on. A run can then boot on the fast default clock and slow it down only
// for the stage that needs it (Morrowind's Bink videos skip frames forever at
// 200ms/batch). The clock itself is covered by test-batch-clock.js; this checks
// the scheduled-input wiring rebases rather than jumps.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const vm = require('vm');
const { createBatchClock } = require('../lib/batch-clock');
const { createGuestClockSource } = require('../lib/guest-clock');
const { createInputConsumptionTrace } = require('./input-consumption-trace');

// Execute the production CLI hook bodies with a small MSG buffer and controlled
// queue, not a native guest. The real clock and trace helper are used unchanged.
// This source-only mode needs neither an EXE nor the 512MiB VM.
function testConsumptionTiming() {
  const source = fs.readFileSync(path.join(__dirname, 'run.js'), 'utf8');
  const slice = (from, to) => {
    const start = source.indexOf(from);
    const end = source.indexOf(to, start);
    assert(start >= 0 && end > start, `production hook markers: ${from}`);
    return source.slice(start, end);
  };
  const setup = slice('  const inputConsumptionTrace = createInputConsumptionTrace({',
    '  // Every OTHER import table');
  const poll = slice('  let lastInputEvent = null;', '  let lastMouseTracePos');
  const dispatch = slice("    if (TRACE_INPUT_DISPATCH && (t === 'DispatchMessageA'",
    '    for (const spec of TRACE_API_MEM)');
  const rawInjection = slice("      } else if (renderer) {\n        renderer.inputQueue.push(inputConsumptionTrace.enqueue(",
    '    if (control) settleLiveInput();');
  const schedule = slice('      const ev = scheduledInput.shift();',
    '      injectedInputThisBatch = true;');
  assert(source.includes('!TRACE_INPUT_DISPATCH && !ESP_DELTA'),
    'quiet-api must keep the dispatch hook enabled for this flag');
  const make = enabled => {
    const batchClock = createBatchClock(200);
    const guestClock = createGuestClockSource({ batchClock });
    const memory = { buffer: new ArrayBuffer(4096) };
    const renderer = { inputQueue: [], checkInput() { return this.inputQueue.shift() || null; } };
    const c = vm.createContext({
      h: {}, logs: [], TRACE_INPUT_DISPATCH: enabled,
      createInputConsumptionTrace, batchClock, guestClock, tickState: batchClock.state,
      inputEvent: null, crossThreadMsgs: [], inputQueue: null, installingFiles: false,
      renderer, inputEventHwnd: require('../lib/host-window').inputEventHwnd,
      memory, translateGuest: n => n,
      instance: { exports: { get_esp: () => 64, get_image_base: () => 0 } },
    });
    vm.runInContext(setup + poll, c);
    return { c, batchClock, guestClock, renderer, dispatch: api => {
      c.t = api;
      vm.runInContext(dispatch, c);
    }, inject: ev => {
      c.scheduledInput = [ev];
      c.batch = batchClock.state.batch;
      // The exact scheduled observation, then the actual raw enqueue branch.
      vm.runInContext('{' + schedule + '\nif (false) {' + rawInjection, c);
    } };
  };
  const run = enabled => {
    const f = make(enabled), { c, batchClock, guestClock, renderer } = f;
    const events = [
      [0x100, 0x41, 0x001e0001], [0x101, 0x41, 0xc01e0001],
      [0x100, 0x41, 0x001e0001], [0x101, 0x41, 0xc01e0001],
      [0x201, 1, 0x8001ffff], [0x202, 0, 0x8001ffff],
      [0x201, 1, 0x8001ffff], [0x202, 0, 0x8001ffff],
    ];
    batchClock.state.batch = 2;
    for (const [msg, wParam, lParam] of events) f.inject({ batch: 2, msg, wParam, lParam });
    assert.strictEqual(renderer.inputQueue.length, 8);
    batchClock.state.batch = 7; // delayed polling, NOT the scheduled batch
    guestClock.ticks(); guestClock.ticks();
    const stateBefore = JSON.stringify(batchClock.state);
    const results = [];
    for (const [msg, wp, lp] of events) {
      const packed = c.h.check_input();
      const hwnd = c.h.check_input_hwnd(0x10001);
      assert.strictEqual(packed, (wp << 16) | msg);
      assert.strictEqual(c.h.check_input_wparam(), wp);
      assert.strictEqual(c.h.check_input_lparam(), lp);
      assert.strictEqual(hwnd, msg < 0x200 ? 0x10001 : 0);
      results.push([packed, hwnd, c.h.check_input_wparam(), c.h.check_input_lparam()]);
    }
    assert.strictEqual(JSON.stringify(batchClock.state), stateBefore, 'observations do not spend ticks');
    const beforeEmpty = c.logs.length;
    assert.strictEqual(c.h.check_input(), 0);
    assert.strictEqual(c.logs.length, beforeEmpty, 'empty poll stays silent');
    // Dispatch two identical guest MSGs much later. Never guess which dequeue
    // they came from, even though the tuples match queued input exactly.
    batchClock.state.batch = 11;
    const dv = new DataView(c.memory.buffer);
    dv.setUint32(68, 128, true);
    for (const [i, n] of [0x10001, 0x100, 0x41, 0x001e0001].entries()) dv.setUint32(128 + i * 4, n, true);
    f.dispatch('DispatchMessageA'); f.dispatch('DispatchMessageW');
    if (enabled) {
      const deq = c.logs.filter(l => l.startsWith('[input-dequeue]'));
      assert.strictEqual(deq.length, 8);
      deq.forEach((l, i) => {
        assert(l.includes(`dequeueId=${i + 1} source=renderer enqueueId=${i + 1} scheduledBatch=2`));
        assert(l.includes('batch=7 guestMs=1400 clock=batch lastGuestTick=1401'));
      });
      assert(c.logs.some(l => l.includes('lParam=0xc01e0001')));
      assert(c.logs.some(l => l.includes('lParam=0x8001ffff')));
      const dispatched = c.logs.filter(l => l.startsWith('[dispatch-input]'));
      assert.strictEqual(dispatched.length, 2);
      for (const l of dispatched) {
        assert(l.includes('batch=11 guestMs=2200 clock=batch'));
        assert(l.includes('correlation=unavailable'));
        assert(!l.includes('dequeueId=') && !l.includes('enqueueId='));
      }
      assert(c.logs.some(l => l.startsWith('[input-schedule] scheduledBatch=2') && l.includes('batch=2 guestMs=400')));
      console.log(c.logs.find(l => l.startsWith('[input-schedule]')));
      console.log(deq[0]); console.log(dispatched[0]);
    }
    return { results, logs: c.logs.filter(l => /^\[check_input(?:_hwnd)?\]/.test(l)) };
  };
  assert.deepStrictEqual(run(true), run(false), 'trace flag changes neither input nor legacy output');

  // Priority, installation suppression, no renderer and explicit routing use
  // the unchanged production check_input branches, including full wParam.
  const f = make(true), c = f.c;
  c.inputEvent = { msg: 0x100, wParam: 0xfedcba98, lParam: 0xc0000001, hwnd: 0x99 };
  c.crossThreadMsgs.push({ msg: 0x111, wParam: 22 });
  c.inputQueue = [33]; c.installingFiles = true;
  f.renderer.inputQueue.push({ msg: 0x101, wParam: 65, lParam: 0xc0000001 });
  assert.strictEqual(c.h.check_input(), (0xfedcba98 << 16) | 0x100);
  assert.strictEqual(c.h.check_input_wparam(), 0xfedcba98);
  assert.strictEqual(c.h.check_input_hwnd(0x123), 0x99);
  assert.strictEqual(c.h.check_input(), (22 << 16) | 0x111);
  const n = c.logs.length;
  assert.strictEqual(c.h.check_input(), 0);
  assert.strictEqual(c.logs.length, n);
  assert.strictEqual(f.renderer.inputQueue.length, 1);
  c.installingFiles = false;
  assert.strictEqual(c.h.check_input(), (33 << 16) | 0x111);
  assert.strictEqual(c.h.check_input(), (65 << 16) | 0x101);
  assert.strictEqual(c.h.check_input_hwnd(0), 0);
  c.renderer = null;
  assert.strictEqual(c.h.check_input(), 0);
  f.inject({ batch: 3, msg: 0x101, wParam: 65, lParam: 0xc0000001 });
  assert.strictEqual(c.h.check_input(), (65 << 16) | 0x101);
  assert(c.logs.some(l => l.includes('source=pending')));
  assert(c.logs.some(l => l.includes('source=cross-thread')));
  assert(c.logs.some(l => l.includes('source=button-queue')));
  assert(c.logs.some(l => l.includes('wParam=0xfedcba98 lParam=0xc0000001')));

  // Clock rebases and pauses come from the real runtime state. A real-clock
  // snapshot uses publish(), not a synthetic schedule-derived time.
  f.batchClock.state.batch = 10;
  f.batchClock.setTickMsPerBatch(5);
  f.batchClock.state.batch = 11;
  f.batchClock.state.pausedMs = 17;
  c.scheduledInput = [{ batch: 1, action: 'mousemove' }];
  vm.runInContext('{' + schedule + '}', c);
  assert(c.logs.at(-1).includes('scheduledBatch=1'));
  assert(c.logs.at(-1).includes('batch=11 guestMs=2022 clock=batch'));
  let wall = 500;
  // Install a fresh production observer for the real clock, as initialization
  // does; replacing the clock on an existing trace would retain its old read.
  c.guestClock = createGuestClockSource({ realTicks: true, clockOrigin: 500, now: () => wall });
  vm.runInContext('{' + setup + 'globalThis.realTrace = inputConsumptionTrace;}', c);
  wall = 623;
  c.realTrace.schedule({ batch: 2, action: 'keyup' });
  assert(c.logs.at(-1).includes('batch=11 guestMs=123 clock=real lastGuestTick=unavailable'));

  // Hard volume cap; disabled trace never even samples the clock.
  const logs = [];
  const cap = createInputConsumptionTrace({ enabled: true, logs, limit: 3,
    snapshot: () => ({ batch: 1, guestMs: 12, clock: 'real', lastGuestTick: 'unavailable' }) });
  for (let i = 0; i < 2000; i++) cap.schedule({ batch: 0 });
  assert.strictEqual(logs.length, 4);
  assert(logs[3].includes('trace limit reached'));
  const quiet = createInputConsumptionTrace({ enabled: false, logs,
    snapshot: () => { throw Error('disabled clock read'); } });
  quiet.schedule({}); quiet.enqueue({}, {}); quiet.dequeue({}, 'renderer');
  quiet.route(1, 2); quiet.dispatch('DispatchMessageA', 1, 0x100, 65, 0);
  assert.strictEqual(logs.length, 4);
  console.log('PASS  source-only production input hooks: delayed dequeue/dispatch, duplicates, balanced keys/mouse, priority, empty polls, quiet compatibility and bounded trace (no native qualification)');
}

testConsumptionTiming();
if (process.argv.includes('--source-only')) process.exit(0);

const ROOT = path.join(__dirname, '..');
const EXE = path.join(__dirname, 'binaries', 'notepad.exe');

if (!fs.existsSync(EXE)) {
  console.log('SKIP  notepad.exe not found at ' + EXE);
  process.exit(0);
}

const r = spawnSync(process.execPath, [
  path.join(__dirname, 'run.js'), '--exe=' + EXE, '--no-build', '--quiet-api',
  '--max-batches=40', '--max-seconds=30',
  '--input=10:tick-ms:5,20:tick-ms:50',
], { cwd: ROOT, encoding: 'utf8', timeout: 60000 });
const out = (r.stdout || '') + (r.stderr || '');

// 10 batches at the default 200ms, then 10 at 5ms.
const first = /\[input\] tick-ms 5 at batch 10 \(guest (\d+)ms\)/.exec(out);
const second = /\[input\] tick-ms 50 at batch 20 \(guest (\d+)ms\)/.exec(out);
assert.ok(first, 'first tick-ms switch was not applied:\n' + out.slice(-2000));
assert.ok(second, 'second tick-ms switch was not applied:\n' + out.slice(-2000));
assert.strictEqual(Number(first[1]), 2000, 'switch at batch 10 keeps 10 x 200ms');
assert.strictEqual(Number(second[1]), 2050, 'batches 10..20 advanced 5ms each');

console.log('PASS  scheduled tick-ms input rebases the headless clock');

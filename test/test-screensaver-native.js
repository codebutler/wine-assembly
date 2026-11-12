#!/usr/bin/env node
'use strict';

// Full production module, USER tables/heap/GDI, software renderer and owned
// host dequeue. Only the separate saver-process launch is observed, not booted.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHash } = require('node:crypto');
const { bootRenderHarness, countUniqueColors } = require('./render-helper');
const { inputEventHwnd } = require('../lib/host-window');

(async () => {
  const launches = [];
  let harness, now = 0;
  const hostSource = fs.readFileSync(path.join(__dirname, '../host.js'), 'utf8');
  const h = {}, ctx = {};
  const self = { processId: 1, _multiApp: false, logToUI() {} };
  vm.runInNewContext(hostSource.slice(hostSource.indexOf('    h.check_input = () => {'),
    hostSource.indexOf('    // Wire thread/event imports')), { h, self, ctx, inputEventHwnd, Object });
  const wasm = process.env.SCREENSAVER_WASM;
  const bytes = wasm ? fs.readFileSync(wasm) : null;
  harness = await bootRenderHarness({
    ...(bytes ? { prebuiltModule: new WebAssembly.Module(bytes) } : {}),
    extraHostOverrides: {
      check_input: (...a) => h.check_input(...a),
      check_input_hwnd: (...a) => h.check_input_hwnd(...a),
      check_input_wparam: (...a) => h.check_input_wparam(...a),
      check_input_lparam: (...a) => h.check_input_lparam(...a),
      shell_execute: (hwnd, verb, file) => {
        const p = new Uint8Array(harness.memory.buffer);
        let end = file; while (p[end]) end++;
        launches.push(Buffer.from(p.subarray(file, end)).toString('latin1'));
        return 33;
      },
    },
  });
  const { exports: e, renderer: r, instance, memory, canvas } = harness;
  ctx.instance = instance;
  Object.assign(self, { renderer: r, instance });
  r.mainWasm = instance; r.mainWasmMemory = memory;
  r._inputNowMs = () => now;
  const pump = () => { now += 100; return e.wat_app_pump(); };
  const count = e.wnd_count_used();
  const hwnd = e.scrsave_open();
  assert.ok(hwnd, 'cold full module opens without a PE');
  assert.equal(e.scrsave_open(), hwnd, 'idempotent open');
  assert.equal(e.scrsave_count(), 19);
  const children = [];
  for (let slot = 0; (slot = e.wnd_next_child_slot(hwnd, slot)) !== -1; slot++)
    children.push(e.wnd_slot_hwnd(slot));
  const byId = id => children.find(c => e.ctrl_get_id(c) === id);
  const list = byId(0x500), preview = byId(1), close = byId(2);
  assert.ok(list && preview && close);
  assert.equal(e.send_message(list, 0x18b, 0, 0), 19);
  pump(); r.repaint();
  assert.ok(countUniqueColors(canvas) > 8, 'native frame and controls paint');
  function point(h, x = 8, y = 8) {
    return [e.wnd_window_screen_x(h) + x, e.wnd_window_screen_y(h) + y];
  }
  function down(h, x, y) { r.handleMouseDown(...point(h, x, y), 1); pump(); }
  function up(h, x, y) { r.handleMouseUp(...point(h, x, y), 1); pump(); pump(); }
  down(list, 8, 36); up(list, 8, 36);
  assert.equal(e.send_message(list, 0x188, 0, 0), 2, 'real hit test selects Architecture');
  down(preview);
  assert.deepEqual(launches, [], 'press alone never launches');
  up(preview);
  assert.deepEqual(launches, ['ARCHITEC.SCR']);
  assert.equal(e.scrsave_last_launched(), 3);
  down(preview); up(preview, -20, -20);
  assert.equal(launches.length, 1, 'capture release outside cancels');
  r.repaint();
  if (process.env.SCREENSAVER_PNG) fs.writeFileSync(process.env.SCREENSAVER_PNG, canvas.toBuffer('image/png'));
  down(close); up(close);
  assert.equal(e.scrsave_window(), 0);
  assert.equal(pump(), 0);
  assert.equal(e.wnd_count_used(), count, 'entire native window tree retired');
  console.log('PASS full module: cold no-PE catalog, GDI paint, renderer hit test/owned dequeue, selection, Preview press/release/cancel, Close/tree retirement',
    { moduleSha256: bytes ? createHash('sha256').update(bytes).digest('hex') : null, launches });
})().catch(error => { console.error(error); process.exitCode = 1; });

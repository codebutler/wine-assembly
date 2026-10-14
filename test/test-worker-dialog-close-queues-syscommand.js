#!/usr/bin/env node
'use strict';

// The title-bar X on a dialog frame used to call the page instance's
// send_message(hwnd, WM_SYSCOMMAND, SC_CLOSE) synchronously. In the browser
// Threads route the guest -- MAIN thread included -- runs in a Worker and the
// page's instance is a shadow without its registers, so a dialog whose
// procedure is guest code (every Win16 DialogBox) trapped there: JezzBall's
// game-over dialogs, user report #42 (USER-JEZZBALL-SYSCOMMAND-TRAP-20261011).
// A Worker-owned dialog's close now goes through the guest's own pump.

const assert = require('assert');
const { installInputHandlers } = require('../lib/renderer-input');

const P = {};
installInputHandlers({ prototype: P });

function renderer(workerOwned) {
  const sent = [];
  const wasm = { exports: {
    send_message: (...args) => { sent.push(args); return 0; },
    get_quit_flag: () => 0,
    modal_cancel_if_hwnd: () => {},
  } };
  const r = Object.create(P);
  r.windows = { 0x10007: { hwnd: 0x10007, isDialog: true } };
  r.inputQueue = [];
  r._guestWorkerWasms = new Set(workerOwned ? [wasm] : []);
  r.wakes = 0;
  r._wakeMessageWait = () => { r.wakes++; };
  r.scheduleRepaint = () => {};
  r.repaint = () => {};
  return { r, wasm, sent };
}

// Threads route: never enter the shadow instance; queue SC_CLOSE for the pump.
{
  const { r, wasm, sent } = renderer(true);
  r._closeWatDialogFrame(0x10007, wasm);
  assert.deepStrictEqual(sent, [], 'no synchronous send into a Worker-owned guest');
  assert.deepStrictEqual(r.inputQueue, [{ type: 'command', hwnd: 0x10007,
    msg: 0x0112, wParam: 0xF060, lParam: 0 }], 'SC_CLOSE is queued for the guest pump');
  assert.strictEqual(r.wakes, 1, 'a parked message wait is woken for it');
}

// Cooperative route: the page instance IS the guest; keep the direct send
// (Calculator posts its quit only from the SC_CLOSE arm).
{
  const { r, wasm, sent } = renderer(false);
  r._closeWatDialogFrame(0x10007, wasm);
  assert.deepStrictEqual(sent[0], [0x10007, 0x0112, 0xF060, 0],
    'cooperative close still sends WM_SYSCOMMAND/SC_CLOSE directly');
  assert.strictEqual(r.inputQueue.length, 0);
}

console.log('PASS  a Worker-owned dialog title-bar close goes through the guest pump, not the page shadow');

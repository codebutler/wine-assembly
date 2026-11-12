'use strict';
// DOM/real LiveRun + Machine.int33 only. No VM construction or execution.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
for (const name of ['Module', 'Memory', 'Instance', 'compile', 'instantiate']) {
  WebAssembly[name] = () => { throw new Error('forbidden Wasm ' + name); };
}
const source = require('../tools/toyvm/live');
const { Machine } = require('../tools/toyvm/dos');
function fixture(api, pointer) {
  const canvas = new EventTarget(), win = new EventTarget(), doc = new EventTarget();
  if (pointer) win.PointerEvent = function () {};
  Object.assign(canvas, { width: 320, height: 200,
    getBoundingClientRect: () => ({ left: 100, top: 50, width: 800, height: 600 }),
    focus() {} });
  const run = new api.LiveRun({ canvas, files: {}, exe: 'never-executed.com' });
  run.machine = Object.assign(Object.create(Machine.prototype), {
    mouse: { x: 160, y: 100, buttons: 0, dx: 0, dy: 0,
      pressed: [0, 0, 0], released: [0, 0, 0], reads: 0 },
    vga: { bpp: 8 }, releaseKeys() {}, audio: {}, exited: false,
  });
  const detach = api.bindInput(canvas, () => run, win, doc);
  const send = (kind, buttons, button, target = canvas) => {
    const e = new Event((pointer ? 'pointer' : 'mouse') + kind, { cancelable: true });
    Object.assign(e, { clientX: 500, clientY: 350, buttons, button,
      ...(pointer ? { pointerType: 'mouse', pointerId: 1 } : {}) });
    target.dispatchEvent(e);
  };
  const poll = (fn = 3, bx = 0) => {
    const regs = { ax: fn, bx };
    assert.strictEqual(run.machine.int33({ get: k => regs[k] || 0,
      set: (k, v) => { regs[k] = v; } }), true);
    return regs;
  };
  return { canvas, win, run, send, poll, detach };
}
function chord(api, pointer, first = 1, added = 2) {
  const f = fixture(api, pointer);
  try {
    const firstButton = first === 1 ? 0 : first === 2 ? 2 : 1;
    const addedButton = added === 1 ? 0 : added === 2 ? 2 : 1;
    f.send('down', first, firstButton);
    assert.strictEqual(f.poll().bx, first);
    // Pointer Events generate pointerdown only on the no-buttons -> some-buttons
    // transition. An additional mouse button generates pointermove (button=2
    // for right, buttons=3 for left+right), even at unchanged coordinates.
    f.send(pointer ? 'move' : 'down', first | added, addedButton);
    assert.strictEqual(f.poll().bx, first | added,
      'INT33/03 must expose the added button during an existing mouse gesture');
    const addedIndex = added === 1 ? 0 : added === 2 ? 1 : 2;
    assert.strictEqual(f.poll(5, addedIndex).bx, 1, 'INT33/05 added-button press count');
    assert.strictEqual(f.poll(5, addedIndex).bx, 0, 'press count clears on read');
    f.send(pointer ? 'move' : 'up', added, firstButton, f.win);
    assert.strictEqual(f.poll().bx, added, 'outside partial release retains other button');
    f.send('up', 0, addedButton, f.win);
    assert.strictEqual(f.poll().bx, 0);
  } finally { f.detach(); }
}
function resumed(api, pointer) {
  const f = fixture(api, pointer);
  try {
    f.send('down', 1, 0);
    f.win.dispatchEvent(new Event('blur'));
    assert.strictEqual(f.poll().bx, 0);
    f.send('move', 1, -1);
    assert.strictEqual(f.poll().bx, 0, 'stale held motion after blur is suppressed');
    f.send('up', 0, 0);
    f.send('down', 2, 2);
    assert.strictEqual(f.poll().bx, 2, 'fresh gesture after release remains usable');
  } finally { f.detach(); }
}
const sandbox = {};
new Function('self', 'atob', fs.readFileSync(path.join(__dirname,
  '../docs/dos-corpus/live/toyvm-bundle.js'), 'utf8'))(sandbox,
  s => Buffer.from(s, 'base64').toString('binary'));
const bundled = sandbox.ToyVM.require('tools/toyvm/live.js');
let failures = 0, passes = 0;
function check(name, fn) {
  try { fn(); passes++; console.log('PASS ' + name); }
  catch (e) { failures++; console.log('FAIL ' + name + ': ' + e.message); }
}
for (const [name, api] of [['source', source], ['bundle', bundled]]) {
  for (const pointer of [true, false]) {
    const mode = pointer ? 'pointer' : 'fallback';
    check(name + ' ' + mode + ' resumed gesture', () => resumed(api, pointer));
    for (const [first, added] of [[1, 2], [2, 1], [1, 4]]) {
      check(`${name} ${mode} chord ${first}+${added}`, () => chord(api, pointer, first, added));
    }
  }
}
console.log(JSON.stringify({ passes, failures, scope: 'DOM/INT33 state only; no browser/guest' }));
process.exitCode = failures ? 1 : 0;

'use strict';
// Binding + LiveRun + INT33 state only: never construct a VM or Machine.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
for (const name of ['Module', 'Memory', 'Instance', 'compile', 'instantiate']) {
  WebAssembly[name] = () => { throw new Error('forbidden Wasm ' + name); };
}
const live = require('../tools/toyvm/live');
const { Machine } = require('../tools/toyvm/dos');
function check(api) {
  const canvas = new EventTarget(), win = new EventTarget(), doc = new EventTarget();
  win.PointerEvent = function () {};
  Object.assign(canvas, { width: 320, height: 200, focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }) });
  const makeRun = () => {
    const r = new api.LiveRun({ canvas, files: {}, exe: 'never-run.com' });
    r.machine = Object.assign(Object.create(Machine.prototype), {
      mouse: { x: 0, y: 0, buttons: 0, dx: 0, dy: 0,
        pressed: [0, 0, 0], released: [0, 0, 0], reads: 0 },
      vga: { bpp: 8 }, releaseKeys() {}, audio: {}, exited: false,
    });
    return r;
  };
  let run = makeRun();
  const detach = api.bindInput(canvas, () => run, win, doc);
  const send = (kind, buttons, button, pointerId = 1, target = canvas) => {
    const e = new Event('pointer' + kind, { cancelable: true });
    Object.assign(e, { pointerType: 'mouse', pointerId, buttons, button, clientX: 10, clientY: 10 });
    target.dispatchEvent(e);
  };
  const poll = (fn = 3, bx = 0) => {
    const regs = { ax: fn, bx };
    run.machine.int33({ get: k => regs[k] || 0, set: (k, v) => { regs[k] = v; } });
    return regs.bx;
  };
  try {
    send('down', 1, 0);
    send('move', 3, -1); // Ordinary held motion cannot invent an edge.
    assert.strictEqual(poll(), 1, 'held hover needs a changed-button edge');
    send('move', 3, 2, 99);
    assert.strictEqual(poll(), 1, 'another pointer cannot join the gesture');
    send('move', 3, 2, 1, win);
    assert.strictEqual(poll(), 3, 'owned outside pointer chord reaches INT33');
    send('move', 3, 2);
    assert.strictEqual(poll(5, 1), 1, 'duplicate edge increments once');
    send('move', 5, 1); // Simultaneous right release / middle press.
    assert.strictEqual(poll(), 5);
    assert.strictEqual(poll(6, 1), 1, 'partial release reaches INT33');
    assert.strictEqual(poll(5, 2), 1, 'middle press reaches INT33');
    const old = run;
    run = makeRun();
    send('move', 7, 2);
    assert.strictEqual(old.machine.mouse.buttons, 0, 'retry releases prior run');
    assert.strictEqual(poll(), 0, 'retry cannot inherit a chord');
    send('down', 1, 0);
    win.dispatchEvent(new Event('blur'));
    send('move', 3, 2);
    assert.strictEqual(poll(), 0, 'even a late button edge after blur is suppressed');
    send('up', 0, 0);
    send('down', 2, 2);
    send('move', 3, 0);
    assert.strictEqual(poll(), 3, 'fresh gesture after blur accepts chord');
  } finally { detach(); }
}
check(live);
console.log('PASS owned chord edges, stale hover, pointer identity, retry, blur and INT33 counters');
const filename = path.resolve(__dirname, '../tools/toyvm/live.js');
const source = fs.readFileSync(filename, 'utf8');
const mutant = source.replace('const chord = pointer &&', 'const chord = false &&');
assert.notStrictEqual(mutant, source);
const mod = { exports: {} };
new Function('require', 'module', 'exports', mutant)(createRequire(filename), mod, mod.exports);
assert.throws(() => check(mod.exports), /owned outside pointer chord/);
console.log('REJECTED chord delivery removal');

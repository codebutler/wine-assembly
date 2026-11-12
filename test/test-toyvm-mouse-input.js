'use strict';

// DOM/state fixture only: no VM, guest, compiler, browser or Wasm allocation.
const assert = require('assert');
const live = require('../tools/toyvm/live');
const { Machine } = require('../tools/toyvm/dos');

function checkMouseInput(pointer = true, api = live) {
  const { LiveRun, bindKeyboard, bindInput } = api;
  // The compatibility export and both updated launchers share one binding.
  if (bindInput) assert.strictEqual(bindInput, bindKeyboard);
  const canvas = new EventTarget(), win = new EventTarget(), doc = new EventTarget();
  if (pointer) win.PointerEvent = function () {};
  canvas.width = 320; canvas.height = 200;
  canvas.getBoundingClientRect = () => ({ left: 100, top: 50, width: 800, height: 600 });
  canvas.focus = () => { canvas.focused = true; };
  function run() {
    const r = new LiveRun({ canvas, files: {}, exe: 'unused.com' });
    // Use the real existing INT33 implementation, without constructing a machine.
    r.machine = Object.assign(Object.create(Machine.prototype), {
      mouse: { x: 160, y: 100, buttons: 0, dx: 0, dy: 0, pressed: [0, 0, 0], released: [0, 0, 0], reads: 0 },
      vga: { bpp: 8 }, releaseKeys() {}, audio: {}, exited: false,
    });
    return r;
  }
  let current = run();
  const detach = bindKeyboard(canvas, () => current, win, doc);
  const prefix = pointer ? 'pointer' : 'mouse';
  function event(target, type, props = {}) {
    const e = new Event(type, { cancelable: true });
    Object.assign(e, { clientX: 500, clientY: 350, buttons: 0, button: 0,
      ...(pointer ? { pointerType: 'mouse', pointerId: 1 } : {}), ...props });
    target.dispatchEvent(e); return e;
  }
  const send = (type, props, target = canvas) => event(target, prefix + type, props);
  const m = () => current.machine.mouse;
  function int33(fn, bx = 0) {
    const regs = { ax: fn, bx };
    assert.strictEqual(current.machine.int33({ get: k => regs[k] || 0, set: (k, v) => { regs[k] = v; } }), true);
    return regs;
  }
  send('move');
  assert.deepStrictEqual([m().x, m().y], [320, 100], 'scaled/offset browser movement must reach INT33 state');
  assert.deepStrictEqual([m().dx, m().dy], [0, 0], 'first absolute sample is not motion from an invented origin');
  send('move', { clientX: 600, clientY: 410 });
  assert.deepStrictEqual([m().x, m().y], [400, 120]);
  assert.deepStrictEqual([int33(0x0B).cx, m().dx], [80, 0], 'real INT33 motion read clears counters');
  send('down', { buttons: 1 });
  assert.strictEqual(m().buttons, 1); assert.strictEqual(m().pressed[0], 1);
  assert.strictEqual(canvas.focused, true);
  send('down', { buttons: 1 }); assert.strictEqual(m().pressed[0], 1, 'duplicate down is not another press');
  send('down', { buttons: 3, button: 2 });
  assert.deepStrictEqual(m().pressed, [1, 1, 0], 'DOM right bit maps to DOS right, not middle');
  send('down', { buttons: 7, button: 1 });
  assert.strictEqual(m().buttons, 7); assert.strictEqual(m().pressed[2], 1);
  assert.strictEqual(int33(5, 1).bx, 1); assert.strictEqual(int33(5, 1).bx, 0);
  send('up', { buttons: 6 }, win);
  assert.deepStrictEqual([m().buttons, m().released[0]], [6, 1], 'outside release reaches original run');
  event(win, 'blur');
  assert.strictEqual(m().buttons, 0); assert.deepStrictEqual(m().released, [1, 1, 1]);
  event(win, 'blur'); assert.deepStrictEqual(m().released, [1, 1, 1], 'release is idempotent');
  assert.strictEqual(int33(6, 2).bx, 1); assert.strictEqual(int33(6, 2).bx, 0);
  send('move', { clientX: -200, clientY: 3000 });
  assert.deepStrictEqual([m().x, m().y], [0, 199], 'outside coordinates clamp to guest limits');
  const negative = int33(0x0B); assert.ok(negative.cx > 0x8000, 'negative motion is returned as signed 16-bit');
  send('down', { buttons: 1 }); event(canvas, 'blur'); assert.strictEqual(m().buttons, 0);
  send('down', { buttons: 1 }); doc.hidden = true; event(doc, 'visibilitychange');
  assert.strictEqual(m().buttons, 0);
  const hidden = JSON.stringify(m()); send('down', { buttons: 1 }); assert.strictEqual(JSON.stringify(m()), hidden);
  doc.hidden = false;
  send('down', { buttons: 1 }); event(win, 'pagehide'); assert.strictEqual(m().buttons, 0);
  send('down', { buttons: 1 });
  if (pointer) {
    send('up', { pointerId: 99 }, win); assert.strictEqual(m().buttons, 1, 'unrelated pointer cannot release gesture');
    send('cancel', { pointerType: 'touch' }); assert.strictEqual(m().buttons, 1);
    send('cancel'); assert.strictEqual(m().buttons, 0);
    send('down', { buttons: 1 }); event(canvas, 'lostpointercapture'); assert.strictEqual(m().buttons, 0);
    const before = JSON.stringify(m());
    assert.strictEqual(send('down', { pointerType: 'touch', buttons: 1 }).defaultPrevented, false,
      'shared binding must leave touch startup behavior to the launcher');
    send('move', { pointerType: 'pen', buttons: 1 });
    assert.strictEqual(JSON.stringify(m()), before, 'touch/pen must retain launcher behavior, not emulate mouse');
    event(canvas, 'mousedown', { buttons: 1 });
    assert.strictEqual(JSON.stringify(m()), before, 'compatibility mouse events cannot duplicate pointer delivery');
  }
  send('down', { buttons: 1 }); const old = current, oldMouse = old.machine.mouse;
  current = run();
  send('move', { buttons: 1 });
  assert.strictEqual(oldMouse.buttons, 0, 'retry releases the previous run');
  assert.strictEqual(m().buttons, 0, 'held movement cannot press a replacement run');
  const oldSnapshot = JSON.stringify(oldMouse);
  send('up', {}, win); assert.strictEqual(JSON.stringify(oldMouse), oldSnapshot, 'late release cannot change stale run');
  send('down', { buttons: 2, button: 2 }); assert.strictEqual(m().buttons, 2);
  current.stop(); assert.strictEqual(m().buttons, 0, 'stop releases mouse');
  const stopped = JSON.stringify(m()); send('move'); send('down', { buttons: 1 });
  assert.strictEqual(JSON.stringify(m()), stopped, 'stopped input remains stopped');
  current = run(); current.machine.exited = true;
  const exited = JSON.stringify(m()); send('down', { buttons: 1 }); send('move');
  assert.strictEqual(JSON.stringify(m()), exited, 'exit accepts no new input');
  current = run(); send('down', { buttons: 1 }); detach();
  assert.strictEqual(m().buttons, 0, 'detach releases buttons');
  const detached = JSON.stringify(m()); send('down', { buttons: 1 }); send('move');
  assert.strictEqual(JSON.stringify(m()), detached, 'detached listeners deliver nothing');
  detach();
  // Text and high-resolution graphics use different guest coordinate grids.
  current = run(); current.machine.vga.bpp = 0; canvas.width = 640; canvas.height = 400;
  const detach2 = bindKeyboard(canvas, () => current, win, doc);
  send('move'); assert.deepStrictEqual([m().x, m().y], [320, 100], 'text mouse grid is 640x200, not glyph pixel height');
  current.machine.vga.bpp = 8; canvas.width = 800; canvas.height = 600;
  send('move'); assert.deepStrictEqual([m().x, m().y], [400, 300]);
  send('down', { buttons: 1 });
  win.document = doc; doc.pointerLockElement = canvas; event(doc, 'pointerlockchange');
  assert.strictEqual(m().buttons, 0, 'entering unsupported pointer lock releases held buttons');
  const locked = JSON.stringify(m()); send('move', { movementX: 30 });
  assert.strictEqual(JSON.stringify(m()), locked, 'pointer lock/relative input is unsupported');
  doc.pointerLockElement = null;
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0 });
  send('move'); assert.strictEqual(JSON.stringify(m()), locked, 'unlaid-out canvas ignored');
  detach2();
  current = null;
  const detach3 = bindKeyboard(canvas, () => current, win, doc);
  send('down', { buttons: 1 }); send('move'); event(win, 'blur'); detach3();
  console.log(`PASS mouse ${prefix}: coordinates/buttons/INT33/deltas/release/retry/detach/stopped/unsupported`);
}

module.exports = { checkMouseInput };
if (require.main === module) {
  // Enforce this fixture's allocation boundary during source and bundle tests.
  for (const name of ['Module', 'Instance', 'Memory', 'compile', 'instantiate']) {
    WebAssembly[name] = () => { throw new Error('forbidden Wasm ' + name); };
  }
  checkMouseInput(); checkMouseInput(false);
  if (process.argv.includes('--bundle')) {
    const fs = require('fs'), path = require('path');
    const sandbox = {};
    new Function('self', 'atob', fs.readFileSync(path.join(__dirname, '../docs/dos-corpus/live/toyvm-bundle.js'), 'utf8'))(
      sandbox, s => Buffer.from(s, 'base64').toString('binary'));
    const api = sandbox.ToyVM.require('tools/toyvm/live.js');
    checkMouseInput(true, api); checkMouseInput(false, api);
    console.log('PASS generated main bundle binding; forbidden Wasm guards armed');
  }
  if (process.argv.includes('--controls')) {
    for (const name of ['mouseInput', 'releaseMouse']) {
      const original = live.LiveRun.prototype[name];
      live.LiveRun.prototype[name] = () => {};
      let rejected = false;
      try { checkMouseInput(); }
      catch (e) { rejected = true; console.log(`REJECTED ${name} removal: ${e.message.split('\n')[0]}`); }
      finally { live.LiveRun.prototype[name] = original; }
      assert.ok(rejected, `must reject ${name} removal`);
    }
  }
}

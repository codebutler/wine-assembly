'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { installInputHandlers } = require('../lib/renderer-input');
class Input {
  constructor() { this.inputQueue = []; this.windows = {}; this.wasm = null; this.mainWasm = null; }
}
installInputHandlers(Input);
const H = 0x8000;
const families = [[16, 'Shift', 160], [17, 'Control', 162], [18, 'Alt', 164]];
const drain = r => { while (r.takeInput()) {} };
const sample = (r, keys, expected) => {
  assert.deepEqual(keys.map(k => r.getAsyncKeyState(k)), expected);
  assert.deepEqual(keys.map(k => r.getAsyncKeyState(k)), expected.map(x => x & H));
};
for (const [vk, name, left] of families) {
  for (const first of ['Left', 'Right']) {
    const other = first === 'Left' ? 'Right' : 'Left';
    const side = first === 'Left' ? left : left + 1;
    const opposite = side === left ? left + 1 : left;
    const keys = [vk, side, opposite];
    const down = (r, which, extra = {}) => r.handleKeyDown(vk, {code: name + which, ...extra});
    const up = (r, which) => r.handleKeyUp(vk, {code: name + which});
    test(`${name}/${first}: polling before, between and after overlap delivery`, () => {
      for (const pollAt of ['before', 'between', 'after']) {
        const r = new Input(); down(r, first); down(r, other);
        if (pollAt === 'before') sample(r, keys, [H|1, H|1, H|1]);
        const a = r.takeInput();
        if (pollAt === 'between') sample(r, keys, [H|1, H|1, 1]);
        const b = r.takeInput();
        sample(r, keys, pollAt === 'after' ? [H|1,H|1,H|1] : [H,H,H]);
        assert.equal(a.wParam, vk); assert.equal(b.wParam, vk);
        assert.equal((a.lParam >>> 30) & 1, 0); assert.equal((b.lParam >>> 30) & 1, 0);
        assert.equal((a.lParam >>> 24) & 1, name !== 'Shift' && first === 'Right' ? 1 : 0);
        assert.equal((b.lParam >>> 16) & 255, name === 'Shift' ? (other === 'Right' ? 54 : 42) : name === 'Control' ? 29 : 56);
      }
    });
    test(`${name}/${first}: release/repress behind stale events cannot recreate consumed presses`, () => {
      const r = new Input(); down(r, first); up(r, first);
      sample(r, keys, [H|1,H|1,0]);
      down(r, first); sample(r, keys, [H|1,H|1,0]);
      for (const held of [true, false, true]) {
        assert.ok(r.takeInput()); sample(r, keys, [held ? H : 0,held ? H : 0,0]);
        assert.equal(r.peekKeyDownState(side), H, 'physical repress survives delivery of old release');
      }
      up(r, first); drain(r); sample(r, keys, [0,0,0]);
      down(r, first); up(r, first); drain(r);
      sample(r, keys, [1,1,0]);
    });
    test(`${name}/${first}: typematic, opposite press and numeric focus release`, () => {
      const r = new Input(); down(r, first); drain(r); sample(r, keys, [H|1,H|1,0]);
      for (const repeat of [false, true]) {
        down(r, first, {repeat}); sample(r, keys, [H,H,0]);
        assert.equal((r.takeInput().lParam >>> 30) & 1, 1);
        sample(r, keys, [H,H,0]);
      }
      down(r, other); sample(r, keys, [H|1,H,H|1]);
      r.handleKeyUp(vk); // Existing lifecycle/focus release route clears all owners.
      assert.deepEqual(keys.map(k => r.peekKeyDownState(k)), [0,0,0]);
      drain(r); sample(r, keys, [0,0,0]);
      down(r, first); drain(r); sample(r, keys, [H|1,H|1,0]);
    });
  }
  test(`${name}: numeric repeat also publishes only the fresh press`, () => {
    const r = new Input(); r.handleKeyDown(vk); sample(r, [vk], [H|1]);
    r.handleKeyDown(vk, {repeat:true}); drain(r); sample(r, [vk], [H]);
    r.handleKeyUp(vk); drain(r); r.handleKeyDown(vk); drain(r); sample(r, [vk], [H|1]);
  });
  test(`${name}: worker delivery and stale release preserve a newer pending press`, () => {
    const r = new Input(); r._keyboardOwnerRunsInGuestWorker = () => true;
    r.handleKeyDown(vk, {code:name+'Left'}); sample(r, [vk,left], [H|1,H|1]);
    r.handleKeyUp(vk, {code:name+'Left'});
    r.handleKeyDown(vk, {code:name+'Left'});
    r.takeInput(); r.takeInput();
    sample(r, [vk,left], [1,1]); // Old release changes only the high bits.
    r.takeInput(); sample(r, [vk,left], [H,H]);
    r.inputQueue.push({type:'key', msg:0x100, wParam:vk, lParam:1});
    r.takeInput(); sample(r, [vk,left], [H|1,H]);
  });
}
for (const vk of [16,17,18,65,121]) {
  test(`raw legacy queue VK ${vk} retains delivery press publication`, () => {
    const r = new Input();
    for (const msg of [0x100,0x104]) {
      const e = {type:'key', hwnd:0, msg, wParam:vk, lParam:0x401e0001};
      r.inputQueue.push(e); sample(r, [vk], [msg === 0x100 ? 0 : H]);
      assert.equal(r.takeInput(), e); sample(r, [vk], [H|1]);
    }
    r.inputQueue.push({type:'key',msg:0x101,wParam:vk,lParam:0xc01e0001});
    r.takeInput(); sample(r, [vk], [0]);
  });
}
for (const worker of [false,true]) for (const vk of [65,121]) {
  test(`ordinary VK ${vk} worker=${worker}: enqueue, delivery, repeat, release`, () => {
    const r = new Input(); r._keyboardOwnerRunsInGuestWorker = () => worker;
    r.handleKeyDown(vk); sample(r, [vk], [H|1]);
    const e = r.takeInput(); assert.equal((e.lParam >>> 30) & 1, 0);
    sample(r, [vk], [H]);
    r.handleKeyDown(vk, {repeat:true}); sample(r, [vk], [H|1]);
    assert.equal((r.takeInput().lParam >>> 30) & 1, 1); sample(r, [vk], [H]);
    r.handleKeyUp(vk); assert.equal((r.takeInput().lParam >>> 31) & 1, 1);
    sample(r, [vk], [0]);
  });
}

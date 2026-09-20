#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_monitor_begin")
      (param $esp i32) (param $hdc i32) (param $clip i32)
      (param $callback i32) (param $data i32)
    (global.set $eip (i32.const 0))
    (i32.store offset=16 (global.get $reg_base) (local.get $esp))
    (call $gs32 (local.get $esp) (i32.const 0))
    (call $handle_EnumDisplayMonitors (local.get $hdc) (local.get $clip)
      (local.get $callback) (local.get $data) (i32.const 0) (i32.const 0)))
`;

(async () => {
  const { exports: e, memory } = await bootRenderHarness({ extraWat, fonts: 'none', width: 800, height: 600 });
  const pe = fs.readFileSync(path.join(__dirname, 'binaries', 'calc.exe'));
  new Uint8Array(memory.buffer).set(pe, e.get_staging());
  assert(e.load_pe(pe.length));
  const out = e.guest_alloc(64), clip = e.guest_alloc(16);
  const stack = 0x07000000;
  const readRect = p => [0, 4, 8, 12].map(i => e.guest_read32(p + i) | 0);
  const putRect = values => values.forEach((v, i) => e.guest_write32(clip + i * 4, v));
  function callback(result) {
    // Record the real stdcall arguments and dereference the guest RECT.
    const code = [0x8b,0x4c,0x24,0x10, 0x8b,0x44,0x24,4, 0x89,1,
      0x8b,0x44,0x24,8, 0x89,0x41,4, 0x8b,0x54,0x24,12, 0x89,0x51,24];
    for (let i = 0; i < 4; i++) code.push(0x8b,0x42,i*4, 0x89,0x41,8+i*4);
    code.push(0xff,0x41,28, 0xb8,result,0,0,0, 0xc2,16,0);
    const p = e.guest_alloc(code.length);
    code.forEach((b, i) => e.guest_write8(p + i, b));
    return p;
  }
  const yes = callback(7), no = callback(0);
  function begin(cb, clipping = 0, esp = stack, hdc = 0) {
    e.guest_write32(out + 28, 0);
    e.guest_write32(esp + 20, 0x1234abcd);
    e.test_monitor_begin(esp, hdc, clipping, cb, out);
  }
  function finish() { for (let i = 0; e.get_eip() && i < 20; i++) e.run(100); assert.strictEqual(e.get_eip(), 0); }
  begin(yes); finish();
  assert.strictEqual(e.guest_read32(out), 0x10000, 'same primary handle as MonitorFromPoint');
  assert.strictEqual(e.guest_read32(out + 4), 0);
  assert.deepStrictEqual(readRect(out + 8), [0, 0, 800, 600], 'live screen dimensions');
  assert.strictEqual(e.guest_read32(out + 28), 1);
  assert.strictEqual(e.get_esp(), stack + 20);
  assert.strictEqual(e.guest_read32(stack + 20), 0x1234abcd, 'caller stack is not scratch');
  assert.strictEqual(e.guest_read32(out + 24), stack + 4, 'RECT lives in this invocation frame');
  assert.strictEqual(e.get_eax(), 1);
  begin(no); finish(); assert.strictEqual(e.get_eax(), 0, 'callback FALSE stops enumeration');
  putRect([-10, 20, 300, 700]); begin(yes, clip); finish();
  assert.deepStrictEqual(readRect(out + 8), [0, 0, 800, 600],
    'NULL-HDC clip selects monitors but callback receives the full monitor RECT');
  for (const r of [[800,0,900,600], [10,10,10,20], [30,30,20,20]]) {
    putRect(r); begin(yes, clip); finish();
    assert.strictEqual(e.guest_read32(out + 28), 0);
    assert.strictEqual(e.get_eax(), 1, 'empty intersection succeeds without callback');
    assert.strictEqual(e.get_esp(), stack + 20);
  }
  begin(0); finish(); assert.strictEqual(e.get_eax(), 0, 'NULL callback rejected');
  begin(yes, 0, stack, 123); finish();
  assert.strictEqual(e.get_eax(), 0, 'unsupported monitor-specific DC must not fabricate success');
  assert.strictEqual(e.guest_read32(out + 28), 0);
  // Suspend an outer call, complete a nested invocation lower on its stack,
  // then resume the outer x86 callback through the real return thunk.
  begin(yes);
  const outerEsp = e.get_esp(), outerRect = e.guest_read32(outerEsp + 12);
  e.guest_write32(outerRect, 123); // simulate the outer callback using its mutable RECT
  putRect([20,30,40,50]); begin(yes, clip, outerEsp - 64); finish();
  assert.deepStrictEqual(readRect(out + 8), [0,0,800,600]);
  assert.deepStrictEqual(readRect(outerRect), [123,0,800,600], 'nested call preserves outer RECT');
  e.set_esp(outerEsp); e.set_eip(yes); finish();
  assert.deepStrictEqual(readRect(out + 8), [123,0,800,600]);
  assert.strictEqual(e.get_esp(), stack + 20);
  console.log('PASS monitor enumeration: real callbacks, geometry, clipping, FALSE, stack restoration and nesting');
})().catch(error => { console.error(error); process.exit(1); });

#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

const extraWat = String.raw`
  (func (export "test_init_common_controls_ex") (param $init i32) (result i32)
    (global.set $esp (i32.const 0x00300000))
    (call $handle_InitCommonControlsEx
      (local.get $init) (i32.const 0) (i32.const 0)
      (i32.const 0) (i32.const 0) (i32.const 0))
    (global.get $eax))
`;

(async () => {
  const { exports: wat } = await bootRenderHarness({ extraWat, fonts: 'none' });
  const init = wat.guest_alloc(8) >>> 0;

  assert.strictEqual(wat.test_init_common_controls_ex(0), 0,
    'a null INITCOMMONCONTROLSEX pointer fails');

  wat.guest_write32(init, 0);
  wat.guest_write32(init + 4, 0x000000ff); // ICC_WIN95_CLASSES
  assert.strictEqual(wat.test_init_common_controls_ex(init), 0,
    'a missing structure size fails');

  wat.guest_write32(init, 4);
  assert.strictEqual(wat.test_init_common_controls_ex(init), 0,
    'a truncated structure fails');

  wat.guest_write32(init, 12);
  assert.strictEqual(wat.test_init_common_controls_ex(init), 0,
    'an incompatible structure size fails');

  wat.guest_write32(init, 8);
  assert.strictEqual(wat.test_init_common_controls_ex(init), 1,
    'the documented two-DWORD structure succeeds');
  assert.strictEqual(wat.guest_read32(init), 8,
    'the input structure remains caller-owned');
  assert.strictEqual(wat.guest_read32(init + 4) >>> 0, 0x000000ff,
    'the requested class mask remains caller-owned');
  assert.strictEqual(wat.get_esp(), 0x00300008,
    'InitCommonControlsEx pops its one argument');

  console.log('PASS InitCommonControlsEx validates its Win98 structure contract');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});

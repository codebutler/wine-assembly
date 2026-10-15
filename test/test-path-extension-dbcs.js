#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { bootRenderHarness } = require('./render-helper');

(async () => {
  const wat = (await bootRenderHarness()).exports;
  const path = 'C:\\Program Files\\AIM\\aim.exe';
  const p = wat.guest_alloc(path.length + 1) >>> 0;
  for (let i = 0; i < path.length; i++) wat.guest_write8(p + i, path.charCodeAt(i));
  wat.guest_write8(p + path.length, 0);
  assert.strictEqual(wat.test_call_PathFindExtensionA(p) >>> 0, p + path.indexOf('.'));
  wat.guest_write8(p + path.indexOf('.'), 0);
  assert.strictEqual(wat.test_call_PathFindExtensionA(p) >>> 0, p + path.indexOf('.'));
  assert.strictEqual(wat.test_call_PathFindExtensionA(0) >>> 0, 0);
  wat.guest_free(p);

  assert.strictEqual(wat.test_call_IsDBCSLeadByteEx(932, 0x81), 1);
  assert.strictEqual(wat.test_call_IsDBCSLeadByteEx(932, 0x80), 0);
  assert.strictEqual(wat.test_call_IsDBCSLeadByteEx(936, 0xFE), 1);
  assert.strictEqual(wat.test_call_IsDBCSLeadByteEx(1252, 0x81), 0);
  console.log('test-path-extension-dbcs: passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

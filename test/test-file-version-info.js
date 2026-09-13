#!/usr/bin/env node

const assert = require('assert');
const path = require('path');
const { createHostImports } = require('../lib/host-imports');
const { buildVersionBlob, buildVersionPe } = require('../tools/pe-version');
const { compileSrcWasm } = require('./compile-src');

async function main() {
  const blob = buildVersionBlob([
    0xFEEF04BD, 0x00010000, 0x00050006,
    0x00070008, 0x0009000A, 0x000B000C,
  ]);
  const pe = buildVersionPe(blob);
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null, resourceJson: {} };
  const imports = createHostImports(ctx);
  imports.host.memory = memory;
  imports.host.create_thread = () => 0;
  imports.host.exit_thread = () => 0;
  imports.host.terminate_thread = () => 0;
  imports.host.create_event = () => 0;
  imports.host.set_event = () => 0;
  imports.host.reset_event = () => 0;
  imports.host.wait_single = () => 0;
  imports.host.wait_multiple = () => 0;
  imports.host.com_create_instance = () => 0x80004002;
  ctx.vfs.files.set('c:\\windows\\temp\\version.dll', {
    data: new Uint8Array(pe), attrs: 0x20,
  });
  const bad = Buffer.from(pe);
  bad.writeUInt32LE(0x7FFFFFF0, 0x200 + 0x48);
  ctx.vfs.files.set('c:\\windows\\temp\\bad.dll', {
    data: new Uint8Array(bad), attrs: 0x20,
  });

  const { instance } = await WebAssembly.instantiate(compileSrcWasm(), imports);
  const e = instance.exports;
  ctx.exports = e;
  const u8 = new Uint8Array(memory.buffer);
  const dv = new DataView(memory.buffer);
  const wa = gp => gp - e.get_image_base() + e.get_guest_base();

  function writeAscii(value) {
    const gp = e.guest_alloc(value.length + 1);
    for (let i = 0; i < value.length; i++) u8[wa(gp) + i] = value.charCodeAt(i);
    u8[wa(gp) + value.length] = 0;
    return gp;
  }

  function writeWide(value) {
    const gp = e.guest_alloc((value.length + 1) * 2);
    for (let i = 0; i < value.length; i++) dv.setUint16(wa(gp) + i * 2, value.charCodeAt(i), true);
    dv.setUint16(wa(gp) + value.length * 2, 0, true);
    return gp;
  }

  const ansiPath = writeAscii('C:\\Windows\\Temp\\Version.dll');
  const widePath = writeWide('C:\\Windows\\Temp\\Version.dll');
  const handleOut = e.guest_alloc(4);
  dv.setUint32(wa(handleOut), 0xDEADBEEF, true);
  assert.strictEqual(e.test_call_GetFileVersionInfoSizeA(ansiPath, handleOut), blob.length);
  assert.strictEqual(dv.getUint32(wa(handleOut), true), 0);
  assert.strictEqual(e.test_call_GetFileVersionInfoSizeW(widePath, 0), blob.length);

  const full = e.guest_alloc(blob.length);
  assert.strictEqual(e.test_call_GetFileVersionInfoA(ansiPath, 0, blob.length, full), 1);
  assert.deepStrictEqual(Buffer.from(u8.subarray(wa(full), wa(full) + blob.length)), blob);

  const shortLen = blob.length - 7;
  const short = e.guest_alloc(blob.length + 4);
  u8.fill(0xA5, wa(short), wa(short) + blob.length + 4);
  assert.strictEqual(e.test_call_GetFileVersionInfoW(widePath, 0, shortLen, short), 1);
  assert.deepStrictEqual(Buffer.from(u8.subarray(wa(short), wa(short) + shortLen)), blob.subarray(0, shortLen));
  assert.deepStrictEqual(Array.from(u8.subarray(wa(short) + shortLen, wa(short) + blob.length + 4)),
    new Array(11).fill(0xA5));

  assert.strictEqual(e.test_call_GetFileVersionInfoSizeA(writeAscii('C:\\missing.dll'), 0), 0);
  assert.strictEqual(e.test_call_GetFileVersionInfoSizeA(writeAscii('C:\\Windows\\Temp\\bad.dll'), 0), 0);
  console.log('PASS file-backed GetFileVersionInfo A/W resource lookup');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});

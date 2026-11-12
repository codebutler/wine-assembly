#!/usr/bin/env node
'use strict';
// Real x86 property-page callbacks call imported GetTickCount and RET 12. Host hooks below
// observe nesting and inject separately labeled ownership faults.
const assert = require('node:assert/strict');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const { pe, BASE } = require('./test-dll-lifecycle-real-pe');
const { BASE: REGION, SIZE } = require('../lib/region-map.generated');
const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
async function main() {
  // Reduce only this family's run-slice budget to exercise real multi-slice and
  // timeout paths cheaply; production caps and branch logic remain unchanged.
  const wasm = compileSrcWasm((file, text) => file === '09a9-comctl32.wat'
    ? text.replace('(call $run (i32.const 1000000))', '(call $run (i32.const 10))')
    : file !== '13-exports.wat' ? text : text + `
    (export "t_page" (func $propsheet_page_callback))
    (export "t_token" (func $invocation_current))
    (export "t_enter" (func $invocation_enter))
    (export "t_leave" (func $invocation_leave))
    (export "t_reset" (func $invocation_process_begin))
    (export "t_clear" (func $clear_cache))
    (func (export "t_depth") (result i32) (global.get $invocation_depth))
    (func (export "t_sync") (result i32) (global.get $sync_msg_depth))
    (func (export "t_completed") (result i32) (global.get $wnd_send_completed))
    (func (export "t_bad_depth")
      (global.set $sync_msg_depth (i32.add (global.get $sync_msg_depth) (i32.const 1))))`,
    { tailCalls: !process.argv.includes('--no-tail-calls') });
  const memory = new WebAssembly.Memory({ initial: 8192, maximum: 8192, shared: true });
  const ctx = { getMemory: () => memory.buffer, renderer: null,
    resourceJson: { menus: {}, dialogs: {}, strings: {}, bitmaps: {} } };
  const imports = createHostImports(ctx); imports.host.memory = memory;
  imports.host.log_i32 = () => {};
  let hook = () => {}; imports.host.get_ticks = () => { hook(); return 17; };
  const { instance } = await WebAssembly.instantiate(wasm, imports);
  const x = ctx.exports = instance.exports, dv = new DataView(memory.buffer);
  // Guest instructions read each stdcall argument before making the API call:
  // mov eax,[esp+disp8]; mov [capture+offset],eax. Separate records survive
  // nested callbacks and prove the argument order, values and guest pointer.
  const callback = (ret, capture = BASE + 0x2300) => [
    ...[4, 8, 12].flatMap((disp, i) =>
      [0x8b, 0x44, 0x24, disp, 0xa3, ...u32(capture + i * 4)]),
    0xb9, ...u32(30), 0x49, 0x75, 0xfd, 0xff, 0x15, ...u32(BASE + 0x1900),
    0xb8, ...u32(73), 0xc2, ret, 0];
  let sp, root, page;
  function begin(ret = 12) {
    hook = () => {};
    const b = pe([[0x2000, [0xc3]], [0x2100, callback(ret)],
      [0x2200, callback(12, BASE + 0x2310)]]);
    const raw = r => r - 0x1000 + 0x200;
    b.writeUInt32LE(0x1a00, raw(0x1900)); b.writeUInt32LE(0, raw(0x1904));
    b.write('GetTickCount\0', raw(0x1a02));
    new Uint8Array(memory.buffer, x.get_staging(), b.length).set(b);
    assert.equal(x.load_pe(b.length), BASE + 0x2000);
    // Production thread reset retires abandoned sync depth/spill pins too.
    x.init_thread(0, x.get_image_base(), x.get_code_start(), x.get_code_end(),
      x.get_thunk_base(), x.get_thunk_end(), x.get_num_thunks(), x.get_rsrc_rva());
    x.t_clear();
    sp = x.guest_alloc(0x10000) + 0xfff0; x.set_esp(sp); x.set_eip(BASE + 0x2000); x.clear_yield();
    page = x.guest_alloc(80);
    x.guest_write32(page + 4, 0x80); x.guest_write32(page + 32, BASE + 0x2100);
    x.guest_write32(page + 44, 0x80); x.guest_write32(page + 72, BASE + 0x2200);
    root = x.t_token(); return root;
  }
  const send = () => x.t_page(page, x.guest_to_wasm(page), 2);
  begin(); const children = []; let nesting = false;
  const argsAt = rva => [0, 4, 8].map(offset => x.guest_read32(BASE + rva + offset) >>> 0);
  hook = () => {
    children.push(x.t_token()); assert.notEqual(x.t_token(), root);
    if (nesting) {
      assert.equal(x.t_depth(), 2);
      assert.deepEqual(argsAt(0x2310), [0, 1, page + 40], 'nested PSPCB_RELEASE arguments');
      return;
    }
    assert.deepEqual(argsAt(0x2300), [0, 2, page], 'outer PSPCB_CREATE arguments');
    const outer = x.t_token(); nesting = true;
    assert.equal(x.t_page(page + 40, x.guest_to_wasm(page + 40), 1), 73);
    assert.deepEqual(argsAt(0x2300), [0, 2, page], 'nested callback preserves outer capture');
    assert.equal(x.t_token(), outer); assert.equal(x.t_depth(), 1); nesting = false;
  };
  for (let i = 0; i < 2; i++) {
    assert.equal(send(), 73); assert.equal(x.t_token(), root);
    assert.equal(x.get_esp() >>> 0, sp); assert.equal(x.get_eip(), BASE + 0x2000);
    assert.equal(x.t_sync(), 0);
  }
  assert.equal(new Set(children).size, 4, 'sibling and nested callbacks have distinct identities');
  hook = () => { throw new Error('must not enter missing window'); };
  x.guest_write32(page + 4, 0); assert.equal(send(), 1); assert.equal(x.t_token(), root);
  x.guest_write32(page + 4, 0x80); x.guest_write32(page + 32, 0);
  assert.equal(send(), 1); assert.equal(x.t_token(), root);
  // Completed but malformed stdcall must not silently restore the old ESP.
  begin(8); assert.throws(send, WebAssembly.RuntimeError);
  assert.equal(x.t_depth(), 1); assert.equal(x.t_sync(), 1); assert.equal(x.get_esp() >>> 0, sp - 4);
  // Ordinary bounded timeout still reports incomplete and restores its parent.
  begin(); x.guest_write32(BASE + 0x2100, 0xfeeb); x.t_clear();
  assert.equal(send(), 0); assert.equal(x.t_token(), root);
  assert.equal(x.t_sync(), 0); assert.equal(x.get_esp() >>> 0, sp);
  // Actual guest trap preserves the abandoned child until explicit reset.
  begin(); x.guest_write32(BASE + 0x2100, 0x0b0f); x.t_clear();
  assert.throws(send, WebAssembly.RuntimeError); assert.equal(x.t_depth(), 1);
  // Controlled host faults during a real guest API: leaked child, same-depth
  // sibling replacement, changed sync depth, retired root, and thrown import.
  for (const fault of ['child', 'sibling', 'depth', 'root', 'throw']) {
    begin(); let faultToken;
    hook = () => {
      if (fault === 'child') faultToken = x.t_enter();
      if (fault === 'sibling') { x.t_leave(x.t_token()); faultToken = x.t_enter(); }
      if (fault === 'depth') x.t_bad_depth();
      if (fault === 'root') x.t_reset();
      if (fault === 'throw') throw new Error('host fault');
    };
    assert.throws(send, fault === 'throw' ? /host fault/ : WebAssembly.RuntimeError);
    if (faultToken !== undefined) assert.equal(x.t_token(), faultToken, 'wrong child is not popped');
    if (fault !== 'root') assert(x.t_sync() > 0, 'no caller-depth restoration on rejection');
  }
  // Allocation failures precede guest frame writes and execution redirection.
  const snapshot = () => ({ esp: x.get_esp(), eip: x.get_eip(), sync: x.t_sync(),
    stack: Buffer.from(new Uint8Array(memory.buffer, x.guest_to_wasm(sp - 32), 32)),
    owners: Buffer.from(new Uint8Array(memory.buffer, REGION.CALLBACK_OWNERSHIP, SIZE.CALLBACK_OWNERSHIP)) });
  begin(); for (let i = 0; i < 63; i++) x.t_enter();
  let before = snapshot(); assert.throws(send, WebAssembly.RuntimeError); assert.deepEqual(snapshot(), before);
  begin(); const seq = dv.getBigUint64(REGION.CALLBACK_OWNERSHIP, true);
  dv.setBigUint64(REGION.CALLBACK_OWNERSHIP, 0xffffffffffffffffn, true);
  before = snapshot(); assert.throws(send, WebAssembly.RuntimeError); assert.deepEqual(snapshot(), before);
  dv.setBigUint64(REGION.CALLBACK_OWNERSHIP, seq, true);
  console.log('property page callback ownership: real x86 nesting/RET, faults and allocation atomicity PASS');
}
main().catch(error => { console.error(error); process.exitCode = 1; });

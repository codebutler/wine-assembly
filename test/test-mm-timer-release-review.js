#!/usr/bin/env node
'use strict';
// Independent additions to the candidate's extraction fixture. No production
// rewrites: compile exact RET, outer dispatcher, inner prefix/continuation arms,
// and run-loop thunk routing together. Unrelated host/resource/cache services
// are explicit stubs; this remains a source-slice test, not full qualification.
const fs = require('node:fs');
const Module = require('node:module');
const assert = require('node:assert/strict');
const filename = require.resolve('./test-mm-timer-ownership.js');
let fixture = fs.readFileSync(filename, 'utf8').split('// Baseline is a concrete')[0];
const additions = `
const alu = read('src/05-alu.wat');
for (const n of ['th_ret_imm','th_ret_guard16','cs_pop']) bodies.push(form(alu, '(func $'+n));
bodies.push(form(dispatcher, '(func $win32_dispatch '));
const inner = dispatcher.slice(dispatcher.indexOf('(func $win32_dispatch_inner '),
  dispatcher.indexOf(';; ── Continuation thunks'));
bodies.push(inner +
  form(dispatcher, '(if (i32.eq (local.get $name_rva) (i32.const 0xCACA003B))') +
  form(dispatcher, '(if (i32.eq (local.get $name_rva) (i32.const 0xCACA000A))') + ')');
const routing = form(ex.slice(ex.indexOf(';; If EIP landed in thunk zone')), '(if (thunk-contains');
bodies.push('(func (export "routeReturn") (local $prev_eip i32) (local $prev_esp i32) (block $main '+routing+'))');
bodies.push('(global $rsrc_api_pins (mut i64) (i64.const 0))');
bodies.push('(export "ret20" (func $th_ret_imm))');
bodies.push('(export "fullDispatch" (func $win32_dispatch))');
bodies.push('(global $event_calls (mut i32) (i32.const 0)) (export "event_calls" (global $event_calls))');
bodies.push('(func $branch_end) (func $host_log_i32 (param i32))');
bodies.push('(defmacro (thunk-contains $target) (i32.and (i32.ge_u $target (i32.const 0x500000)) (i32.lt_u $target (i32.const 0x500200))))');
bodies.push('(func $thunk_patch_changed (param i32) (result i32) (i32.const 0))');
bodies.push('(func $dx_sync_thread_vtables_if_needed) (func $edge_hist_record (param i32 i32))');
bodies.push('(func $spin_is_clock_read (param i32) (result i32) (i32.const 0))');
bodies.push('(func $pop_rsrc_ctx) (func $rsrc_release_api_pins) (func $dll_unload_yield (param i32 i32 i32))');
`;
fixture = fixture.replace("let joined = bodies.join('\\n');", () => additions + "\nlet joined = bodies.join('\\n');");
fixture = fixture.replace('(memory 2 2 shared)', '(import "env" "memory" (memory 2 2 shared))');
fixture = fixture.replace('(func $host_set_event (param i32) (result i32) (i32.const 1))',
  () => '(func $host_set_event (param i32) (result i32) (global.set $event_calls (i32.add (global.get $event_calls) (i32.const 1))) (i32.const 1))');
fixture = fixture.replace('function setup() {', 'function setup(sharedMemory, initialize = true) {');
fixture = fixture.replace('new WebAssembly.Instance(module_).exports',
  'new WebAssembly.Instance(module_, {env:{memory: sharedMemory || new WebAssembly.Memory({initial:2,maximum:2,shared:true})}}).exports');
fixture = fixture.replace('e.invocation_process_begin();', 'if (initialize) e.invocation_process_begin();');
fixture += '\nmodule.exports = {setup};\n';
const m = new Module(filename, module);
m.filename = filename;
m.paths = module.paths;
m._compile(fixture, filename);
const {setup} = m.exports;
let cases = 0;
for (const route of ['timer','dispatch','wave','midi']) {
  const x = setup(), e = x.e, parent = e.invocation_current();
  e.thunk_guest_base.value = 0x500000;
  if (route === 'timer') e.fire_mm_timer();
  else if (route === 'dispatch') x.dispatch();
  else if (route === 'wave') e.fire_wave_out_callback_bound(11,22,0x402000,33);
  else e.fire_midi_out_callback_bound(11,22,0x402000,33,0x3c9);
  // Execute actual production RET20, then the actual run thunk-zone branch,
  // outer dispatcher and inner prefix through the real completion arm.
  e.ret20(20);
  assert.equal(e.eip.value, 0x500000);
  const other = e.invocation_enter();
  x.reject(() => e.fullDispatch(0), 'full outer dispatcher rejects before prefix effects');
  e.invocation_leave(other);
  e.routeReturn();
  assert.equal(e.invocation_current(), parent);
  assert.equal(e.eip.value, route === 'dispatch' ? 0x405555 : 0x401234);
  assert.equal(x.sp(), route === 'dispatch' ? 0x18008 : 0x18000);
  assert.equal(e.api_handler_depth.value, 0);
  assert.equal(e.rsrc_api_scope.value, 0);
  cases++;
}
// Event polling has an observable host effect. Exhausted admission must not
// signal or consume it; valid polling signals once and cancels its child.
{
  const x = setup(), e = x.e, parent = e.invocation_current();
  x.slot(0x11);
  for (let i=0;i<63;i++) e.invocation_enter();
  x.reject(() => e.fire_mm_timer(), 'event timer exhausted admission');
  assert.equal(e.event_calls.value,0);
  for (let i=0;i<63;i++) e.invocation_leave(e.invocation_current());
  assert.equal(e.fire_mm_timer(),0);
  assert.equal(e.event_calls.value,1); assert.equal(x.get(0xb100),0);
  assert.equal(e.invocation_current(),parent); assert.equal(e.mm_callback_depth.value,0);
  assert.equal(e.fire_mm_timer(),0); assert.equal(e.event_calls.value,1);
  cases++;
}
// Real slot retirement in shared memory, rather than only forged root words.
{
  const old = setup(); old.e.fire_mm_timer(); old.ret();
  const fresh = setup(old.e.memory, false);
  fresh.e.invocation_thread_begin(0);
  old.reject(() => old.e.finish(0xcaca000a), 'retired instance after actual slot reuse');
  const parent = fresh.e.invocation_current();
  fresh.e.fire_mm_timer(); fresh.ret(); fresh.e.finish(0xcaca000a);
  assert.equal(fresh.e.invocation_current(), parent);
  cases++;
}
// Last legal thread slot and maximum real nesting: canaries outside retained
// region survive, and the next entry fails before memory/global mutation.
{
  const x = setup(), e = x.e;
  e.current_thread_id.value = 16; e.invocation_thread_begin(15);
  x.put(0x21fc, 0x12345678); x.put(0xa200, 0x87654321);
  const parent = e.invocation_current();
  e.fire_mm_timer();
  for (let i=1;i<63;i++) { x.put(0xb010,x.sp()-8); x.dispatch(); }
  assert.equal(e.mm_callback_depth.value,63);
  x.reject(() => e.dispatchTimer(0xb300), 'actual nesting exhaustion');
  for (let i=0;i<63;i++) { x.ret(); e.finish(0xcaca000a); }
  assert.equal(e.invocation_current(),parent); assert.equal(x.sp(),0x18000);
  assert.equal(x.get(0x21fc),0x12345678); assert.equal(x.get(0xa200),0x87654321);
  cases++;
}
console.log('PASS independent release review: '+cases+' targeted source-slice cases');

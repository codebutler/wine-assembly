'use strict';
// Native production diagnostic and RET forms, with a 64KiB fixture arena.
// Stack translation, RET guard, call-stack bookkeeping and dispatch are seams;
// this does not qualify an original game or retained callback ownership.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {parseSource, compile} = require('../tools/watx');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const render = n => Array.isArray(n) ? `(${n.slice(1).map(render).join(' ')})` : n;
const exportsSource = read('src/13-exports.wat');
const hook = exportsSource.slice(0, exportsSource.indexOf('  ;; End opt-in NULL boundary diagnostic declarations.'));
const alu = parseSource(read('src/05-alu.wat'), 'alu');
const returns = ['$th_ret', '$th_ret_imm'].map(name => {
  const fn = alu.find(n => n[1] === 'func' && n[2] === name);
  assert(fn, name);
  return render(fn);
}).join('\n');
const globalNames = ['eip','reg_base','sync_msg_depth','dlg_pump_hwnd','dlg_ret_addr',
  'dlg_ended','SHARED_DLG_PUMP_HWND','SHARED_DLG_ENDED','sync_msg_ret_thunk','dlg_loop_thunk','ip'];
const wat = `(import "host" "log_eip" (func $host_log_eip (param i32)))
(memory 1 1) (export "memory" (memory 0))
${globalNames.map(n => `(global $${n} (mut i32) (i32.const 0))`).join('\n')}
(global $invocation_root (mut i64) (i64.const 9))
(global $token (mut i64) (i64.const 10))
(func $invocation_current (result i64) (global.get $token))
(func $gl32 (param $a i32) (result i32) (i32.load (local.get $a)))
(func $th_ret_guard16) (func $cs_pop) (func $branch_end)
${hook}
${returns}
(export "ret" (func $th_ret)) (export "retImm" (func $th_ret_imm))
(export "check" (func $null_transfer_check))
(func (export "seed") (param $target i32)
 (global.set $eip (i32.const 0x401000))
 (global.set $token (i64.const 10)) (global.set $invocation_root (i64.const 9))
 (global.set $sync_msg_depth (i32.const 1))
 (i32.store (i32.const 16) (i32.const 1024))
 (i32.store (i32.const 1024) (local.get $target)))
(func (export "invalidate") (param $kind i32)
 (if (i32.eq (local.get $kind) (i32.const 0)) (then (global.set $token (i64.const 11))))
 (if (i32.eq (local.get $kind) (i32.const 1)) (then (global.set $invocation_root (i64.const 12))))
 (if (i32.eq (local.get $kind) (i32.const 2)) (then (global.set $sync_msg_depth (i32.const 2))))
 (if (i32.eq (local.get $kind) (i32.const 3)) (then (i32.store (i32.const 16) (i32.const 2048))))
 (if (i32.eq (local.get $kind) (i32.const 4)) (then (call $null_diag_event (i32.const 1) (i32.const 0) (i32.const 0)))))
(func (export "firstZero")
 (call $null_transfer_check)
 (call $null_diag_event (i32.const 5) (i32.const 0) (i32.const 0)))`;
const built = compile(wat, new Map(), {mode:'production'});
assert(built.success, JSON.stringify(built.diagnostics));
const events = [];
const e = new WebAssembly.Instance(new WebAssembly.Module(built.wasmBinary),
  {host:{log_eip:tag => events.push(tag)}}).exports;
const field = e.null_diag_field;
for (const [method,op,kind,postEsp] of [['ret',0,2,1028],['retImm',12,3,1040]]) {
  e.set_null_diag(2); e.seed(0); e[method](op); e.check();
  assert.equal(field(10),kind);
  assert.equal(field(11),0x401000); assert.equal(field(12),1024);
  assert.equal(field(14),postEsp); assert.equal(field(17),1024); assert.equal(field(18),0);
  assert.throws(() => e.firstZero(), WebAssembly.RuntimeError, 'returning observer must trap');
  assert.equal(events.at(-1),-5); assert.equal(field(8),1);
  for (let invalidation=0; invalidation<5; invalidation++) {
    e.set_null_diag(2); e.seed(0); e[method](op); e.invalidate(invalidation); e.check();
    assert.equal(field(10),0,`${method}: stale provenance ${invalidation}`);
  }
  e.set_null_diag(2); e.seed(0x402000); e[method](op); e.check();
  assert.equal(field(10),0,'nonzero return cannot acquire zero provenance');
  for (const mode of [0,1]) {
    e.set_null_diag(mode); e.seed(0); e[method](op); e.check();
    assert.equal(field(10),0,'only mode 2 records immediate transfer provenance');
  }
}
console.log('PASS Shadow Man native RET/RET-imm provenance, five stale-record boundaries, opt-in modes, and returning-observer trap; ownership pending');

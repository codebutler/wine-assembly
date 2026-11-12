'use strict';
// Cheap production-driver tests only. Does not execute a PE or qualify Pirates.
const assert = require('node:assert/strict');
const loader = require('../lib/dll-loader');
const { ThreadManager } = require('../lib/thread-manager');
function fixture(mode = 'return') {
  const memory = { buffer: new SharedArrayBuffer(65536) };
  const state = { eip: 0x2000, esp: 0xf000, eax: 0x1234, yield: 0, flag: 0 };
  const caller = { ...state }, entries = [];
  let release = false, owner = 2;
  const e = {
    memory, get_image_base: () => 0, guest_to_wasm: address => address,
    get_fs_base: () => 0, get_dll_callback_lock: () => 0x100,
    get_dll_callback_owner: () => owner,
    get_yield_reason: () => state.yield, get_yield_flag: () => state.flag,
    clear_yield() { state.yield = 0; state.flag = 0; },
    set_yield_state(reason, flag) { state.yield = reason; state.flag = flag; },
    get_last_run_halt: () => state.yield === 9 ? 4 : 2,
    get_last_run_blocks: () => 7,
    run(budget) {
      assert.equal(budget, 13);
      entries.push(state.eip);
      assert.equal(Atomics.load(new Int32Array(memory.buffer, 0x100, 2), 0), 2);
      if (state.eip === 0x3000 || (state.eip === 0x5000 && release)) {
        if (mode === 'fault' && state.eip === 0x5000) throw Error('guest fault');
        state.eip = 0;
        if (mode === 'exit' && release) state.yield = 2;
        else { state.esp += 16; state.eax = 0; }
      } else {
        assert.ok([0x4000, 0x5000].includes(state.eip));
        state.eip = 0x5000; state.yield = 9; state.flag = 1;
      }
    },
  };
  for (const name of ['eip', 'esp', 'eax']) {
    e[`get_${name}`] = () => state[name];
    e[`set_${name}`] = value => { state[name] = value; };
  }
  const rows = [{ loadAddr: 0x3000, dllMain: 0x3000 }, { loadAddr: 0x4000, dllMain: 0x4000 }];
  const begin = () => loader.beginDllThreadNotification({ exports: e, memoryBuffer: memory.buffer }, 2, rows);
  return { e, state, caller, entries, begin, rows, memory, release() { release = true; },
    owner(value) { owner = value; }, gate: () => [...new Int32Array(memory.buffer, 0x100, 2)] };
}
for (const mode of ['return', 'fault', 'exit', 'cancel']) {
  const f = fixture(mode), op = f.begin();
  assert.equal(op.advance(13).status, 'quantum');
  assert.equal(op.advance(13).status, 'parked');
  assert.equal(f.state.eip, 0x5000);
  assert.equal(f.state.esp, f.caller.esp - 16);
  assert.deepEqual(f.gate(), [2, 1]);
  f.owner(3); assert.equal(f.begin(), null); assert.throws(() => op.advance(13), /owner/); f.owner(2);
  f.e.clear_yield(); assert.equal(op.advance(13).status, 'parked');
  f.release(); f.e.clear_yield();
  if (mode === 'cancel') {
    assert.equal(op.cancel().status, 'cancelled');
    op.cancel(); assert.equal(f.state.eip, 0x5000);
  } else {
    const result = op.advance(13);
    assert.equal(result.status, mode === 'return' ? 'quantum' : mode === 'exit' ? 'exited' : 'fault');
    if (mode === 'return') {
      assert.equal(op.advance(13).status, 'completed');
      assert.deepEqual(f.state, f.caller);
    } else assert.notEqual(f.state.esp, f.caller.esp);
  }
  assert.deepEqual(f.gate(), [0, 0]);
  assert.equal(f.entries.filter(eip => eip === 0x3000).length, 1);
  assert.equal(f.entries.filter(eip => eip === 0x4000).length, 1);
}
// Use the real scheduler so attach quanta must pass its wait/accounting path.
{
  const f = fixture(), manager = Object.create(ThreadManager.prototype);
  const thread = { instance: { exports: f.e }, state: 'active', tid: 1, waitPolls: 0 };
  Object.assign(manager, { memory: f.memory, mainInstance: { exports: {} },
    _callDllMain: loader.callDllMain, _loadedDlls: f.rows, _quietTM: true,
    threads: new Map([[2, thread]]), _now: () => 1, _waitNow: () => 1,
    _renderSendTargets: new Set(), _audioThreadHotUntil: new Map(),
    _emitThreadEvent() {}, adoptMainGlobals() {}, _log() {} });
  const tick = () => manager.runSlice(13, { quantumSteps: 13 });
  assert.equal(tick().blocks, 7);
  assert.equal(tick().blocks, 7);
  assert.equal(f.state.eip, 0x5000);
  assert.equal(f.state.yield, 0, 'ordinary reason-9 accounting clears wait');
  assert.equal(thread._dllAttachNotified, undefined);
  f.release(); tick(); tick();
  assert.equal(thread._dllAttachNotified, true);
  assert.deepEqual(f.gate(), [0, 0]);
  assert.deepEqual(f.state, f.caller);
}
console.log('PASS cooperative notification mock: retained frame/gate, no replay, cancellation/fault/exit, scheduler accounting');
// Lifecycle ABI mock: quarantine only the unfinished row, release all other
// snapshot pins once. Also drive real unload generator through a parked RET.
function lifecycle(f) {
  const dv = new DataView(f.memory.buffer), base = 0x600, table = 0x800;
  const get = (i, field) => dv.getUint32(base + i * 64 + field, true);
  const set = (i, field, v) => dv.setUint32(base + i * 64 + field, v, true);
  Object.assign(f.e, { get_dll_lifecycle_table: () => base,
    get_dll_lifecycle_stride: () => 64, next_dll_unload_token_locked: () => 1, get_current_thread_id: () => 2, get_dll_table: () => table, get_dll_count: () => 2,
    finish_dll_unload_locked(i) { set(i, 0, 0); return 1; } });
  f.rows.forEach((row, i) => {
    dv.setUint32(table + i * 32, row.loadAddr, true);
    for (const [field, v] of [[0,2],[4,1],[8,1],[24,row.dllMain],[28,i+1],[48,1]]) set(i,field,v);
  });
  return { get, set };
}
for (const mode of ['return', 'fault', 'exit', 'cancel']) {
  const f = fixture(mode), life = lifecycle(f), op = f.begin();
  assert.deepEqual([life.get(0,12), life.get(1,12)], [1,1]);
  op.advance(13); op.advance(13);
  if (mode === 'cancel') op.cancel();
  else {
    f.release(); f.e.clear_yield(); op.advance(13);
    if (mode === 'return') assert.equal(op.advance(13).status, 'completed');
  }
  assert.deepEqual([life.get(0,12), life.get(1,12)], [0,mode === 'return' ? 0 : 1]);
  assert.deepEqual(f.gate(), [0,0]);
}
{
  const f = fixture(), life = lifecycle(f), op = f.begin();
  op.advance(13); op.advance(13); f.release(); f.e.clear_yield(); op.advance(13);
  life.set(1, 8, 0); // final explicit reference released while snapshot pinned
  let entered = false, done = false;
  f.e.run = () => {
    assert.equal(life.get(1,0),3);
    assert.deepEqual(f.gate(),[2,1]);
    if (!entered) { entered = true; f.state.eip = 0x5000; f.state.yield = 9; }
    else { done = true; f.state.eip = 0; f.state.esp += 16; }
  };
  assert.equal(op.advance(13).status,'parked');
  assert.equal(life.get(1,0),3,'parked detach group remains reserved');
  f.e.clear_yield(); assert.equal(op.advance(13).status,'completed');
  assert.ok(done); assert.equal(life.get(1,0),0); assert.deepEqual(f.gate(),[0,0]);
}
console.log('PASS lifecycle mock: generation pins, unfinished quarantine, resumable trailing unload');
{
  const f = fixture();
  let calls = 0;
  f.e.get_last_run_halt = () => 1;
  f.e.run = () => { calls++; f.state.eip = 0x3333; };
  const op = f.begin();
  assert.equal(op.advance(13).status,'parked');
  assert.equal(op.advance(13).status,'parked');
  assert.equal(calls,2,'one guest quantum per scheduler turn');
  assert.equal(f.state.esp,f.caller.esp-16); op.cancel();
}
{
  const f = fixture(), life = lifecycle(f);
  f.e.dll_thread_notifications_enabled = addr => addr !== 0x4000;
  const op = f.begin(); op.advance(13);
  assert.equal(op.advance(13).status,'completed');
  assert.deepEqual(f.entries,[0x3000]);
  assert.deepEqual([life.get(0,12),life.get(1,12)],[0,0]);
}
{
  const f = fixture(), op = f.begin();
  f.e.run = () => { op.cancel(); f.state.eip = 0x3456; };
  assert.equal(op.advance(13).status,'cancelled');
  assert.equal(f.state.eip,0x3456,'forced death during host import never restores caller');
  assert.deepEqual(f.gate(),[0,0]);
}
{
  const f = fixture();
  const outcome = loader.callDllMain(f.e,0x3000,0x3000,null,{reason:2,maxBlocks:13,requireCompletion:true});
  assert.equal(outcome.completed,true); assert.deepEqual(f.state,f.caller);
  assert.deepEqual(f.gate(),[0,0]);
}
console.log('PASS budget/disable/self-cancel and unchanged synchronous callback contract');
{
  const f = fixture(), manager = Object.create(ThreadManager.prototype);
  const thread = { instance:{exports:f.e},state:'active',tid:1,waitPolls:0 };
  let serviced = 0, runs = 0;
  f.e.get_last_run_halt = () => f.state.yield ? 4 : 2;
  f.e.run = () => {
    runs++;
    if (runs === 1) { f.state.eip=0x3500; f.state.yield=5; }
    else { f.state.eip=0; f.state.esp+=16; }
  };
  Object.assign(manager,{memory:f.memory,mainInstance:{exports:{}},
    _callDllMain:loader.callDllMain,_loadedDlls:[f.rows[0]],_quietTM:true,
    threads:new Map([[2,thread]]),_now:()=>1,_waitNow:()=>1,
    _renderSendTargets:new Set(),_audioThreadHotUntil:new Map(),
    _emitThreadEvent(){},adoptMainGlobals(){},_log(){},
    _serviceDllYield(e) {
      serviced++; assert.deepEqual(f.gate(),[2,2]);
      assert.equal(e.get_eip(),0x3500); e.clear_yield(); return true;
    }});
  const tick = () => manager.runSlice(13,{quantumSteps:13});
  tick(); assert.equal(runs,1); tick(); assert.equal(runs,1); assert.equal(serviced,1);
  tick(); tick(); assert.equal(thread._dllAttachNotified,true);
  assert.deepEqual(f.gate(),[0,0]); assert.equal(runs,2);
}
console.log('PASS synchronous nested-load service preserves outer continuation');
{
  const f = fixture(), life = lifecycle(f), manager = Object.create(ThreadManager.prototype);
  const thread = { instance:{exports:f.e},state:'active',tid:1,_dllAttachOperation:f.begin() };
  thread._dllAttachOperation.advance(13); thread._dllAttachOperation.advance(13);
  let exits = 0;
  Object.assign(manager,{threads:new Map([[2,thread]]),_audioThreadHotUntil:new Map(),
    _getVfs:()=>null,_abandonMutexesOwnedBy(){},_emitThreadEvent(){},
    _onThreadExit(){exits++;},_resolveThreadHandle:()=>thread});
  manager.terminateThread(2,7); manager.terminateThread(2,7);
  assert.equal(thread.state,'exited'); assert.equal(thread.exitCode,7);
  assert.equal(thread._dllAttachOperation,null); assert.equal(exits,1);
  assert.deepEqual(f.gate(),[0,0]); assert.deepEqual([life.get(0,12),life.get(1,12)],[0,1]);
  assert.equal(f.state.eip,0x5000,'forced death does not restore or resume callback');
}
console.log('PASS TerminateThread releases notification exactly once and quarantines unfinished image');

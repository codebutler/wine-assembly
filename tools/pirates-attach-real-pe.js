'use strict';
// Prepared real interpreter regression. Run only with the runtime owner's grant.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHostImports } = require('../lib/host-imports');
const loader = require('../lib/dll-loader');
const { ThreadManager } = require('../lib/thread-manager');
function pe(code, api, dll = true) {
  const b = Buffer.alloc(0x600), p = 0x80, o = p + 24, s = o + 0xe0;
  b.writeUInt16LE(0x5a4d, 0); b.writeUInt32LE(p, 0x3c);
  b.writeUInt32LE(0x4550, p); b.writeUInt16LE(0x14c, p + 4);
  b.writeUInt16LE(1, p + 6); b.writeUInt16LE(0xe0, p + 20);
  b.writeUInt16LE(dll ? 0x210e : 0x010e, p + 22);
  b.writeUInt16LE(0x10b, o); b.writeUInt32LE(0x1000, o + 16);
  b.writeUInt32LE(dll ? 0x10000000 : 0x400000, o + 28);
  b.writeUInt32LE(0x1000, o + 32); b.writeUInt32LE(0x200, o + 36);
  b.writeUInt32LE(0x2000, o + 56); b.writeUInt32LE(0x200, o + 60);
  b.writeUInt16LE(2, o + 68); b.writeUInt32LE(0x100000, o + 72);
  b.writeUInt32LE(16, o + 92);
  b.write('.text', s); b.writeUInt32LE(0x400, s + 8);
  b.writeUInt32LE(0x1000, s + 12); b.writeUInt32LE(0x400, s + 16);
  b.writeUInt32LE(0x200, s + 20); b.writeUInt32LE(0xe0000060, s + 36);
  Buffer.from(code).copy(b, 0x200);
  if (api) {
    b.writeUInt32LE(0x1200, o + 104); b.writeUInt32LE(40, o + 108);
    b.writeUInt32LE(0x1100, 0x400); b.writeUInt32LE(0x1280, 0x40c);
    b.writeUInt32LE(0x1100, 0x410); b.writeUInt32LE(0x12a0, 0x300);
    b.write('kernel32.dll\0', 0x480); b.write(api + '\0', 0x4a2);
  }
  return b;
}

const u32 = n => [n & 255, n >>> 8 & 255, n >>> 16 & 255, n >>> 24];
const ret = [0xb8,1,0,0,0,0xc2,12,0];
async function main() {
  const module = await WebAssembly.compile(fs.readFileSync(process.env.WA_TEST_WASM || 'build/wine-assembly.wasm'));
  const memory = new WebAssembly.Memory({ initial:8192, maximum:8192, shared:true });
  async function instance() {
    const ctx = { getMemory: () => memory.buffer,
      resourceJson: { menus:{},dialogs:{},strings:{},bitmaps:{} }, onExit() {} };
    const imports = createHostImports(ctx); imports.host.memory = memory;
    const instance = await WebAssembly.instantiate(module, imports); ctx.exports = instance.exports;
    return instance;
  }
  const primary = await instance(), e = primary.exports;
  const exe = pe([0xeb,0xfe], null, false);
  new Uint8Array(memory.buffer,e.get_staging(),exe.length).set(exe); e.load_pe(exe.length);
  const cs = e.guest_alloc(24) >>> 0, count = e.guest_alloc(16) >>> 0;
  const g32 = addr => new DataView(memory.buffer).getUint32(e.guest_to_wasm(addr) >>> 0,true);
  function load(code, api, name) { return loader.loadDll(e,memory.buffer,pe(code,api),name); }
  function apiCall(api) {
    const row = load([0x8b,0x44,0x24,4,0x68,...u32(cs),0xff,0x90,0,0x11,0,0,...ret],api,api+'.dll');
    const call = () => loader.callDllMain(e,row.loadAddr,row.dllMain,null,{reason:0,requireCompletion:true});
    call.row = row;
    return call;
  }
  const initialize = apiCall('InitializeCriticalSection'), enter = apiCall('EnterCriticalSection'), leave = apiCall('LeaveCriticalSection');
  initialize(); enter();
  // Only THREAD_ATTACH enters the body; PROCESS_ATTACH publishes the DLL.
  function notifyCode(body) { return [0x83,0x7c,0x24,8,2,0x75,body.length,...body,...ret]; }
  const first = load(notifyCode([0xff,0x05,...u32(count)]),null,'first.dll');
  const second = load(notifyCode([0xff,0x05,...u32(count+4),0x8b,0x44,0x24,4,
    0x68,...u32(cs),0xff,0x90,0,0x11,0,0,0xff,0x05,...u32(count+8)]),'EnterCriticalSection','second.dll');
  for (const row of [first,second]) {
    const outcome = loader.callDllMain(e,row.loadAddr,row.dllMain,null,{requireCompletion:true});
    loader.finishDllInitialization(e,memory.buffer,row,outcome);
  }
  async function child(tid) {
    const ins = await instance(), t = ins.exports;
    t.init_thread(tid,e.get_image_base(),e.get_code_start(),e.get_code_end(),e.get_thunk_base(),e.get_thunk_end(),e.get_num_thunks(),e.get_rsrc_rva());
    t.set_esp((t.guest_alloc(0x10000) >>> 0)+0xfff0); t.set_fs_base(t.guest_alloc(0x1000));
    t.set_eip(e.get_eip()); t.set_eax(0x12345678);
    return ins;
  }
  const ins = await child(1), peer = await child(2), t = ins.exports;
  const saved = { eip:t.get_eip(),esp:t.get_esp(),eax:t.get_eax() };
  const thread = { instance:ins,state:'active',tid:1,waitPolls:0 };
  const manager = Object.create(ThreadManager.prototype);
  Object.assign(manager,{memory,mainInstance:primary,_callDllMain:loader.callDllMain,
    _loadedDlls:[first,second],_quietTM:true,threads:new Map([[2,thread]]),
    _now:()=>performance.now(),_waitNow:()=>performance.now(),_renderSendTargets:new Set(),
    _audioThreadHotUntil:new Map(),_emitThreadEvent(){},adoptMainGlobals(){},_log:console.log});
  const tick = () => manager.runSlice(1000,{quantumSteps:1000});
  for(let i=0;i<20 && !g32(count+4);i++) tick();
  assert.equal(g32(count),1); assert.equal(g32(count+4),1); assert.equal(g32(count+8),0);
  // Some dispatch paths surface the yield flag (halt 3) before the run loop's
  // blocking-wait classification (halt 4). Verify the actual CS park as well.
  assert.ok([3,4].includes(t.get_last_run_halt()));
  assert.ok(t.get_cs_waits() > 0); assert.equal(t.get_cs_wait_owner(),e.get_current_thread_id());
  assert.notEqual(t.get_esp(),saved.esp);
  const gate = new Int32Array(memory.buffer,e.get_dll_callback_lock(),2);
  assert.equal(gate[0],t.get_dll_callback_owner());
  assert.equal(loader.beginDllThreadNotification({exports:peer.exports,memoryBuffer:memory.buffer},2),null);
  for(let i=0;i<3;i++) tick();
  assert.equal(g32(count+4),1);
  // Holder releases using its own instance and ordinary guest execution.
  // Calling DllMain here would correctly be excluded by the notification gate.
  const esp = e.get_esp() >>> 0;
  const dv = new DataView(memory.buffer);
  [0,leave.row.loadAddr,0,0].forEach((value,i) =>
    dv.setUint32(e.guest_to_wasm(esp-16+i*4) >>> 0,value,true));
  e.set_esp(esp-16); e.set_eip(leave.row.dllMain); e.clear_yield();
  e.run(1000);
  assert.equal(e.get_eip(),0); assert.equal(e.get_esp(),esp);
  for(let i=0;i<20 && !thread._dllAttachNotified;i++) tick();
  assert.equal(thread._dllAttachNotified,true);
  assert.deepEqual([g32(count),g32(count+4),g32(count+8)],[1,1,1]);
  assert.deepEqual({eip:t.get_eip(),esp:t.get_esp(),eax:t.get_eax()},saved);
  assert.deepEqual([...gate],[0,0]);
  const next = loader.beginDllThreadNotification({exports:peer.exports,memoryBuffer:memory.buffer},2);
  assert.ok(next); next.cancel();
  console.log('PASS real PE cooperative attach: retained frame, holder release, no replay, restored caller');
}
main().catch(error=>{console.error(error);process.exitCode=1;});

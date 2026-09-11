'use strict';
const assert=require('assert');
const {bootRenderHarness}=require('./render-helper');
const {Bridge}=require('../lib/d3d9-host');
const {createHostImports}=require('../lib/host-imports');
const {Worker}=require('worker_threads');
const path=require('path');
const {WorkerConsumer}=require('../lib/d3d-command-stream');
const sigs=require('../lib/host-import-sigs.generated.json').sigs;
(async()=>{
  let bridge,productionImport;
  const api={Device9:['SetRenderTarget','GetRenderTarget','GetBackBuffer','SetViewport','GetViewport',
    'SetScissorRect','GetScissorRect','GetRenderTargetData','SetFVF','SetRenderState','DrawPrimitiveUP','Present','Reset','Release'],
    Surface9:['GetDesc','AddRef','Release','GetDevice','LockRect','UnlockRect']};
  const {exports:e,memory,module}=await bootRenderHarness({fonts:'none',
    extraHostOverrides:{gpu_gl_call:(op,p,a)=>productionImport(op,p,a)},extraWat:`
    ${Object.entries(api).flatMap(([type,names])=>names.map(name=>`
      (func (export "${type}_${name}") (param $a i32) (param $b i32) (param $c i32) (param $d i32) (param $f i32) (result i32)
        (global.set $esp (i32.const 0x074ff000))
        (call $handle_IDirect3D${type}_${name} (local.get $a) (local.get $b) (local.get $c) (local.get $d) (local.get $f) (i32.const 0))
        (global.get $eax))`)).join('\n')}
    (func (export "create_device") (param $pp i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $gs32 (i32.add (global.get $esp) (i32.const 24)) (local.get $pp))
      (call $gs32 (i32.add (global.get $esp) (i32.const 28)) (local.get $out))
      (call $handle_IDirect3D9_CreateDevice (i32.const 0) (i32.const 0) (i32.const 1) (i32.const 1) (i32.const 0) (i32.const 0))
      (global.get $eax))
    (func (export "color") (param $d i32) (param $w i32) (param $h i32) (param $fmt i32) (param $lock i32) (param $out i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $gs32 (i32.add (global.get $esp) (i32.const 24)) (i32.const 0))
      (call $gs32 (i32.add (global.get $esp) (i32.const 28)) (local.get $lock))
      (call $gs32 (i32.add (global.get $esp) (i32.const 32)) (local.get $out))
      (call $gs32 (i32.add (global.get $esp) (i32.const 36)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateRenderTarget (local.get $d) (local.get $w) (local.get $h) (local.get $fmt) (i32.const 0) (i32.const 0))
      (global.get $eax))
    (func (export "offscreen") (param $d i32) (param $w i32) (param $h i32) (param $pool i32) (param $out i32) (param $fmt i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $gs32 (i32.add (global.get $esp) (i32.const 24)) (local.get $out))
      (call $gs32 (i32.add (global.get $esp) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_CreateOffscreenPlainSurface (local.get $d) (local.get $w) (local.get $h) (local.get $fmt) (local.get $pool) (i32.const 0))
      (global.get $eax))
    (func (export "clear") (param $d i32) (param $color i32) (result i32)
      (global.set $esp (i32.const 0x074ff000))
      (call $gs32 (i32.add (global.get $esp) (i32.const 24)) (i32.const 0x3f800000))
      (call $gs32 (i32.add (global.get $esp) (i32.const 28)) (i32.const 0))
      (call $handle_IDirect3DDevice9_Clear (local.get $d) (i32.const 0) (i32.const 0) (i32.const 1) (local.get $color) (i32.const 0)) (global.get $eax))
    (func (export "back_bits") (param $d i32) (result i32)
      (load.field DxObject misc1 (call $d3ddev_rt_entry (local.get $d))))
    (func (export "blockers") (param $d i32) (result i32)
      (call $gl32 (i32.add (call $d3d9_program_state (local.get $d)) (i32.const 21772))))
  `});
  productionImport=createHostImports({getMemory:()=>memory.buffer,exports:e,
    d3d9Bridge:{call:(...args)=>bridge.call(...args)}}).host.gpu_gl_call;
  bridge=new Bridge({backend:'software',enableProgrammable:true,getExports:()=>e,
    getMemory:()=>memory.buffer,guestToWasm:p=>e.guest_to_wasm(p)>>>0});
  e.d3dim_worker_init(0x400000);e.init_dx_com_thunks();
  const alloc=n=>e.guest_alloc(n)>>>0,read=p=>e.guest_read32(p)>>>0,wa=p=>e.guest_to_wasm(p)>>>0;
  const write=(p,a)=>a.forEach((v,i)=>e.guest_write32(p+i*4,v));
  const out=alloc(64),pp=alloc(64),rect=alloc(32),lock=alloc(8);
  write(pp,[8,8,21,1,0,0,1,1,1]);e.guest_write32(pp+52,0x80000000);
  const ok=(v,label)=>assert.strictEqual(v>>>0,0,`${label}: ${bridge.lastError||''}`),bad=v=>assert.strictEqual(v>>>0,0x8876086c);
  ok(e.create_device(pp,out),'create device');const d=read(out);
  ok(e.Device9_GetRenderTarget(d,0,out),'implicit target');const back=read(out);
  ok(e.clear(d,0xff112233),'back clear');
  const create=(w,h,fmt=21,lockable=1)=>{ok(e.color(d,w,h,fmt,lockable,out),'create color');return read(out);};
  const a=create(4,3),b=create(2,5,22),unlocked=create(2,2,21,0);
  assert.strictEqual(e.blockers(d),3);
  bad(e.color(d,0,3,21,0,out));bad(e.color(d,4,3,80,0,out));bad(e.color(d,4,3,21,0,0));
  ok(e.Surface9_GetDesc(a,out),'desc');assert.deepStrictEqual(Array.from({length:8},(_,i)=>read(out+i*4)),[21,1,1,0,0,0,4,3]);
  ok(e.offscreen(d,4,3,2,out,21),'system surface');const system=read(out);assert.strictEqual(e.blockers(d),3);
  bad(e.Device9_SetRenderTarget(d,0,system));bad(e.Device9_SetRenderTarget(d,1,a));bad(e.Device9_SetRenderTarget(d,0,0));
  ok(e.Device9_SetRenderTarget(d,0,a),'bind A');
  ok(e.Device9_GetViewport(d,out),'viewport');assert.deepStrictEqual(Array.from({length:6},(_,i)=>read(out+i*4)),[0,0,4,3,0,0x3f800000]);
  ok(e.Device9_GetScissorRect(d,out),'scissor');assert.deepStrictEqual(Array.from({length:4},(_,i)=>read(out+i*4)),[0,0,4,3]);
  ok(e.clear(d,0x80335577),'A clear');
  ok(e.Device9_SetRenderTarget(d,0,b),'bind B');ok(e.clear(d,0x40556677),'B clear');
  const pixels=s=>{ok(e.Surface9_LockRect(s,lock,0,16),'read lock');const p=read(lock+4),pitch=read(lock);
    const value=read(p);ok(e.Surface9_UnlockRect(s),'read unlock');return {p,pitch,value};};
  assert.strictEqual(pixels(a).value,0x80335577);assert.strictEqual(pixels(b).value,0xff556677);
  ok(e.Device9_SetRenderTarget(d,0,a),'A draw binding');
  ok(e.Device9_SetFVF(d,0x44),'POSITIONT diffuse');ok(e.Device9_SetRenderState(d,137,0),'unlit');
  ok(e.Device9_SetRenderState(d,22,1),'no culling');
  const vertices=alloc(60),vv=new DataView(memory.buffer,wa(vertices),60);
  [[0,0],[4,0],[0,3]].forEach(([x,y],i)=>{const p=i*20;vv.setFloat32(p,x,true);vv.setFloat32(p+4,y,true);
    vv.setFloat32(p+8,.5,true);vv.setFloat32(p+12,1,true);vv.setUint32(p+16,0xffff0000,true);});
  ok(e.Device9_DrawPrimitiveUP(d,4,1,vertices,20),'real Draw to independent target');
  assert.strictEqual(pixels(a).value,0xffff0000,'raster output uses bound storage');
  assert.strictEqual(pixels(b).value,0xff556677,'drawing A preserves B');
  ok(e.clear(d,0x80335577),'restore A fixture color');ok(e.Device9_SetRenderTarget(d,0,b),'B before Present');
  ok(e.Device9_Present(d),'present while B bound');
  assert.strictEqual(new Uint32Array(memory.buffer,e.back_bits(d),64)[0],0xff112233,'Present names implicit storage');
  ok(e.Device9_GetBackBuffer(d,0,0,0,out),'GetBackBuffer independent of binding');assert.strictEqual(read(out),back);e.Surface9_Release(back);
  ok(e.offscreen(d,8,8,2,out,22),'backbuffer readback destination');const backCopy=read(out);
  ok(e.Device9_GetRenderTargetData(d,back,backCopy),'backbuffer readback while B bound');
  assert.strictEqual(pixels(backCopy).value,0xff112233);assert.strictEqual(e.Surface9_Release(backCopy),0);
  ok(e.Device9_GetRenderTargetData(d,a,system),'readback to system surface');assert.strictEqual(pixels(system).value,0x80335577);
  write(rect,[1,1,3,3]);ok(e.Surface9_LockRect(a,lock,rect,0),'subrect lock');
  assert.strictEqual(read(lock),16);const p=read(lock+4);e.guest_write32(p,0xffabcdef);
  bad(e.Surface9_LockRect(a,lock,0,0));bad(e.Device9_SetRenderTarget(d,0,a));
  ok(e.Surface9_UnlockRect(a),'upload subrect');
  assert.strictEqual(pixels(a).value,0x80335577);assert.strictEqual(read(p),0xffabcdef);
  bad(e.Surface9_LockRect(unlocked,lock,0,0));bad(e.Surface9_LockRect(a,0,0,0));bad(e.Surface9_LockRect(a,lock,0,0x4000));
  ok(e.Device9_SetRenderTarget(d,0,a),'restore A');
  assert.strictEqual(e.Surface9_Release(a),0,'internal binding retains externally released surface');
  assert.strictEqual(e.blockers(d),2);
  ok(e.Device9_GetRenderTarget(d,0,out),'recover bound surface');assert.strictEqual(read(out),a);
  assert.strictEqual(e.blockers(d),3);assert.strictEqual(e.Surface9_Release(a),0);
  ok(e.Device9_SetRenderTarget(d,0,back),'restore implicit');
  for(const s of[b,unlocked,system])assert.strictEqual(e.Surface9_Release(s),0);
  assert.strictEqual(e.blockers(d),0);e.Surface9_Release(back);
  assert.strictEqual(e.Device9_Release(d),0);assert.strictEqual(bridge.devices.size,0);
  await bridge.close();
  bridge=new Bridge({backend:'software',enableProgrammable:true,getExports:()=>e,getMemory:()=>memory.buffer,guestToWasm:wa,
    createSoftwareWorker:()=>new WorkerConsumer(new Worker(path.join(__dirname,'../lib/d3d-render-worker.js')),
      {module,memory,sigs,imageBase:e.get_image_base()>>>0,reclaimHeap:h=>e.d3d_render_adopt_free_list(h)})});
  const invoke=async(fn,...args)=>{let value=fn(...args);while(e.get_d3d_render_token()){
    await bridge.wait(e.get_d3d_render_token());value=fn(...args);}return value>>>0;};
  try{
    ok(e.create_device(pp,out),'worker device');const wd=read(out);
    ok(e.color(wd,3,2,21,1,out),'worker target');const target=read(out);
    ok(e.Device9_SetRenderTarget(wd,0,target),'worker bind');
    ok(await invoke(e.clear,wd,0xff918273),'worker clear');
    ok(await invoke(e.Surface9_LockRect,target,lock,0,0),'worker lock fences rendering');
    const bits=read(lock+4);assert.strictEqual(read(bits),0xff918273);
    e.guest_write32(bits,0xff13579b);
    ok(await invoke(e.Surface9_UnlockRect,target),'worker upload');
    ok(await invoke(e.Surface9_LockRect,target,lock,0,16),'worker read uploaded bytes');
    assert.strictEqual(read(read(lock+4)),0xff13579b);
    ok(await invoke(e.Surface9_UnlockRect,target),'worker readonly unlock');
    bad(await invoke(e.Device9_Reset,wd,pp));
    ok(e.offscreen(wd,3,2,2,out,21),'worker system surface');const sys=read(out);
    ok(await invoke(e.Device9_GetRenderTargetData,wd,target,sys),'worker readback');
    assert.strictEqual(pixels(sys).value,0xff13579b);
    assert.strictEqual(await invoke(e.Surface9_Release,target),0);
    ok(await invoke(e.Device9_Reset,wd,pp),'reset retires only internal target');
    assert.strictEqual(e.blockers(wd),0);assert.strictEqual(pixels(sys).value,0xff13579b,'system pool survives Reset');
    assert.strictEqual(await invoke(e.Device9_Release,wd),1,'system surface keeps device alive');
    assert.strictEqual(await invoke(e.Surface9_Release,sys),0,'last child drives ordered final device release');
    assert.strictEqual(bridge.devices.size,0);
  }finally{await bridge.close();}
  console.log('PASS native D3D9 color surfaces: direct/worker Clear/Lock/upload/readback, implicit Present, validation, Reset and last-child lifetime');
})().catch(error=>{console.error(error);process.exitCode=1;});

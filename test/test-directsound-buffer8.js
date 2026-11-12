#!/usr/bin/env node
'use strict';
// Real generated COM thunks and production dispatcher, with real host PCM
// playback/cursor state. No browser or external executable is required.
const assert = require('assert');
const {bootRenderHarness} = require('./render-helper');
const apis = require('../src/api_table.json');
const extraWat = String.raw`
  (func (export "b8_api") (param $id i32) (param $a i32) (param $b i32)
      (param $c i32) (param $d i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (call $dispatch_api_table (local.get $id) (local.get $a) (local.get $b)
      (local.get $c) (local.get $d) (i32.const 0) (i32.const 0))
    (i32.load (global.get $reg_base)))
  (func (export "b8_invoke") (param $thunk i32) (param $stack i32) (result i32)
    (i32.store offset=16 (global.get $reg_base) (local.get $stack))
    (global.set $eip (local.get $thunk))
    (call $win32_dispatch_inner (i32.div_u
      (i32.sub (call $g2w (local.get $thunk)) (global.get $THUNK_BASE)) (i32.const 8)))
    (i32.load (global.get $reg_base)))
  (func (export "b8_refs") (param $this i32) (result i32)
    (load.field DxObject refcount (call $dx_from_this (local.get $this))))
  (func (export "b8_voice") (param $this i32) (result i32)
    (load.field DxObject misc0 (call $dx_from_this (local.get $this))))
  (func (export "b8_restore") (result i32)
    (global.set $DX_VTBL_DSBUF8 (i32.const 0))
    (call $dx_sync_thread_vtables)
    (global.get $DX_VTBL_DSBUF8))
  (func (export "b8_pool_capacity") (result i32) (global.get $COM_WRAPPERS_AUX_MAX))
  (func (export "b8_pool_set") (param $n i32) (result i32)
    (local $old i32)
    (local.set $old (i32.load (global.get $COM_AUX_NEXT_SHARED)))
    (i32.store (global.get $COM_AUX_NEXT_SHARED) (local.get $n))
    (local.get $old))
`;
(async () => {
  let now = 0;
  const crashes = [];
  const {exports: e, hostCtx: ctx} = await bootRenderHarness({fonts:'none', extraWat,
    extraHostOverrides:{crash_unimplemented: (...args) => crashes.push(args)}});
  ctx.audioClockMs = () => now;
  e.init_dx_com_thunks();
  const stack = e.guest_alloc(64), out = e.guest_alloc(32);
  const fmt = e.guest_alloc(20), desc = e.guest_alloc(36);
  const api = (name, args) => e.b8_api(apis.find(a => a.name === name).id,
    ...Array.from({length:4}, (_,i) => args[i] || 0), stack) >>> 0;
  const read = p => e.guest_read32(p) >>> 0;
  const write = (p,v) => e.guest_write32(p,v);
  const guid = words => {const p=e.guest_alloc(16); words.forEach((v,i)=>write(p+4*i,v)); return p;};
  const iid = guid([0x6825a449,0x4d827524,0xe3500f92,0x1eabb36a]);
  const unknown = guid([0,0,0xc0,0x46000000]);
  const legacy = guid([0x279afa85,0x11ce4981,0x200021a5,0x60e50baf]);
  const forged = guid([0x6825a449,0,0,0]);
  const thunk = (obj,slot) => read(read(obj)+4*slot);
  const invoke = (obj,slot,args=[],trap=false) => {
    const address=thunk(obj,slot), all=[obj,...args], id=read(address+4);
    assert.strictEqual(read(address),0xcaca0010,'real generated COM thunk');
    // Legacy COM metadata describes the five dispatcher registers for Lock;
    // its remaining three arguments are read from the guest stack. Verify the
    // real eight-word ABI below through outputs, ESP and the trailing sentinel.
    if (apis[id].name === 'IDirectSoundBuffer_Lock') {
      assert.strictEqual(all.length,8,'Lock has eight actual arguments');
      assert.strictEqual(apis[id].nargs,5,'legacy Lock dispatcher metadata');
    } else assert.strictEqual(apis[id].nargs,all.length,'correct slot ABI');
    write(stack,0x12345678);
    all.forEach((v,i)=>write(stack+4+4*i,v));
    write(stack+4+4*all.length,0xdeadbeef);
    if (trap) {
      const count=crashes.length;
      assert.throws(()=>e.b8_invoke(address,stack),WebAssembly.RuntimeError);
      assert.strictEqual(crashes.length,count+1,'explicit unimplemented callback before trap');
      assert.strictEqual(crashes.at(-1)[1]>>>0,stack,'unwound stdcall frame is preserved at failure');
      assert.strictEqual(crashes.at(-1)[2]>>>0,address,'failure names the reached thunk');
      assert.strictEqual(e.get_esp()>>>0,stack,'fail-fast never pretends to return');
      all.forEach((v,i)=>assert.strictEqual(read(stack+4+4*i),v>>>0,'failure preserves argument frame'));
      assert.strictEqual(read(stack+4+4*all.length),0xdeadbeef);
      return;
    }
    const hr=e.b8_invoke(address,stack)>>>0;
    assert.strictEqual(e.get_esp()>>>0,stack+4+4*all.length,'stdcall pops exactly return and args');
    assert.strictEqual(read(stack+4+4*all.length),0xdeadbeef);
    return hr;
  };
  const qi = (obj,id,target=out) => invoke(obj,0,[id,target]);
  const release = obj => invoke(obj,2);
  assert.strictEqual(api('DirectSoundCreate',[0,out,0]),0);
  const root=read(out);
  // Mono8,1000Hz,100-byte ring => one byte per millisecond.
  [0x00010001,1000,1000,0x00080001,0].forEach((v,i)=>write(fmt+4*i,v));
  const create = caps => {
    [36,caps,caps&1?0:100,0,caps&1?0:fmt,0,0,0,0].forEach((v,i)=>write(desc+4*i,v));
    assert.strictEqual(api('IDirectSound_CreateSoundBuffer',[root,desc,out,0]),0);
    return read(out);
  };
  const buffer=create(0), primary=create(1), limited=create(0);
  const originalTable=read(buffer);
  assert.strictEqual(qi(primary,iid),0x80004002);
  assert.strictEqual(read(out),0);
  assert.strictEqual(e.b8_refs(primary),1);
  assert.strictEqual(qi(buffer,forged),0x80004002);
  assert.strictEqual(qi(buffer,iid,0),0x80004003);
  assert.strictEqual(qi(buffer,0),0x80004003);
  assert.strictEqual(qi(buffer,iid),0);
  const face=read(out), table=read(face);
  assert.notStrictEqual(face,buffer);
  assert.notStrictEqual(table,originalTable);
  assert.strictEqual(e.b8_refs(buffer),2);
  for (let i=0;i<21;i++) assert.strictEqual(read(table+4*i),read(originalTable+4*i),'inherited slot '+i);
  assert.strictEqual(e.b8_restore(),table,'worker registry restores full Buffer8 vtable');
  for (const [id,expected] of [[iid,face],[unknown,buffer],[legacy,buffer]]) {
    assert.strictEqual(qi(face,id),0);
    assert.strictEqual(read(out),expected);
    assert.strictEqual(release(expected),2);
  }
  const limitedTable=read(limited), count=e.b8_pool_set(e.b8_pool_capacity());
  assert.strictEqual(qi(limited,iid),0x8007000e);
  assert.strictEqual(read(out),0);
  assert.strictEqual(read(limited),limitedTable);
  assert.strictEqual(e.b8_refs(limited),1);
  assert.strictEqual(qi(face,iid),0,'existing face reusable at pool exhaustion');
  assert.strictEqual(read(out),face);
  assert.strictEqual(release(face),2);
  e.b8_pool_set(count);
  // Original-game pattern: QI then release the base, keeping only Buffer8.
  assert.strictEqual(release(buffer),1);
  assert.strictEqual(invoke(face,11,[0,100,out,out+4,out+8,out+12,0]),0);
  const samples=read(out);
  assert.strictEqual(read(out+4),100);
  for(let i=0;i<100;i+=4) write(samples+i,0x80808080);
  assert.strictEqual(invoke(face,19,[samples,100,0,0]),0);
  assert.strictEqual(invoke(face,12,[0,0,1]),0);
  const voice=e.b8_voice(face);
  assert(voice && ctx._voices._map[voice],'inherited Play creates a real shared host voice');
  now=25;
  assert.strictEqual(invoke(face,4,[out,out+4]),0);
  assert.strictEqual(read(out),25,'inherited cursor advances on the real host audio clock');
  assert.strictEqual(invoke(face,18),0);
  for(const [slot,name,args] of [[21,'SetFX',[1,desc,out]],
    [22,'AcquireResources',[0,1,out]],[23,'GetObjectInPath',[iid,0,unknown,out]]]) {
    assert.strictEqual(apis[read(thunk(face,slot)+4)].name,'IDirectSoundBuffer8_'+name);
    invoke(face,slot,args,true);
  }
  assert.strictEqual(read(buffer),originalTable,'QI never rewrites legacy vtable');
  assert.strictEqual(release(face),0,'last Buffer8 reference destroys shared storage');
  assert.strictEqual(ctx._voices._map[voice],undefined,'final release closes voice');
  assert.strictEqual(release(primary),0);
  assert.strictEqual(release(limited),0);
  ctx.stopAudio();
  console.log('PASS Buffer8 inherited audio, COM identity/lifetime, primary rejection,24-slot ABI and explicit extension traps');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});

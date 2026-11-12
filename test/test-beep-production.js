#!/usr/bin/env node
'use strict';
// Full production loader, real PE import table, image exports and guest JMPs.
// No handler substitution or private Beep entry/observation exports.
const assert=require('node:assert/strict');
const {bootRenderHarness}=require('./render-helper');
const {audioContext}=require('./test-beep-output');
const {makeFixture,BASE,API,iat}=require('../tools/kernel32-native-fixture');
const tailCalls=!process.argv.includes('--no-tail-calls');
(async()=>{
 const h=await bootRenderHarness({fonts:'none',tailCalls}),e=h.exports,ac=audioContext();
 h.hostCtx._voices._ensureCtx=()=>ac;
 const pe=makeFixture(),raw=rva=>rva-0x1000+0x200;
 // Extend the deterministic fixture's terminated import table by one name.
 const beepIat=BASE+0x1900+API.length*4;
 assert.equal(pe.readUInt32LE(raw(beepIat-BASE)),0);
 pe.writeUInt32LE(0x1c00,raw(beepIat-BASE));pe.writeUInt16LE(0,raw(0x1c00));
 pe.write('Beep\0',raw(0x1c02));
 new Uint8Array(h.memory.buffer).set(pe,e.get_staging());assert(e.load_pe(pe.length));
 const stack=e.get_esp(),read=p=>e.guest_read32(p)>>>0;
 const start=(pointer,args=[])=>{
  e.set_esp(stack);e.clear_yield();e.call_func(pointer,...Array.from({length:4},(_,i)=>args[i]||0));
  const before=e.get_esp();e.run(1000);return before;
 };
 const sync=(name,args=[],nargs=args.length)=>{
  const before=start(read(iat(name)),args);assert.equal(e.get_eip(),0,name+' returned');
  assert.equal(e.get_esp(),before+4*(nargs+1),name+' stdcall');return e.get_eax()>>>0;
 };
 const string=text=>{const p=e.guest_alloc(text.length+1);Buffer.from(text+'\0').forEach((b,i)=>e.guest_write8(p+i,b));return p;};
 const module=sync('LoadLibraryA',[string('KERNEL32.DLL')]);assert(module&&module!==BASE);
 const dynamic=sync('GetProcAddress',[module,string('Beep')]);assert(dynamic!==0);
 const exp=module+read(module+read(module+0x3c)+120);
 const entry=require('../src/kernel32-exports.json').exports.find(x=>x.name==='Beep');
 assert(entry&&entry.ordinal===586);
 const eat=module+read(module+read(exp+28)+(entry.ordinal-1)*4);
 assert.equal(dynamic,eat,'dynamic pointer is the actual KERNEL32 EAT entry');
 assert.equal(e.guest_read8(dynamic),0xe9,'real guest JMP export');
 const imported=read(beepIat);assert(imported!==0&&imported!==0x1c00,'loader patched static IAT');
 for(const pointer of [imported,dynamic]){
  sync('SetLastError',[1234]);
  const before=start(pointer,[750,100]);assert.notEqual(e.get_eip(),0);
  assert.equal(e.apc_alertable_sleeping(),1);
  const node=ac.nodes.at(-1);assert(node);assert.equal(node.frequency.value,750);
  for(let i=0;i<3;i++){e.clear_yield();e.run(1000);assert.notEqual(e.get_eip(),0,'cannot return before audio completes');}
  ac.currentTime+=0.101;e.clear_yield();e.run(1000);
  assert.equal(e.get_eip(),0);assert.equal(e.get_eax(),1);assert.equal(e.get_esp(),before+12);
  assert.equal(sync('GetLastError'),1234,'successful BOOL preserves caller last error');
  for(const [frequency,duration,error] of [[36,100,87],[32768,100,87],[750,0,87],[750,60001,50],[750,0xffffffff,50]]){
   const count=ac.nodes.length,sp=start(pointer,[frequency,duration]);
   assert.equal(e.get_eip(),0);assert.equal(e.get_eax(),0);assert.equal(e.get_esp(),sp+12);
   assert.equal(sync('GetLastError'),error);assert.equal(ac.nodes.length,count,'unsupported request creates no tone');
  }
  ac.state='suspended';const sp=start(pointer,[750,100]);
  assert.equal(e.get_eip(),0);assert.equal(e.get_eax(),0);assert.equal(e.get_esp(),sp+12);
  assert.equal(sync('GetLastError'),50);ac.state='running';
 }
 h.hostCtx.stopAudio();
 console.log('Production Beep PE static import, KERNEL32 dynamic EAT, actual guest calls/BOOL/ESP/failure: PASS; tailCalls='+tailCalls);
})().catch(error=>{console.error(error);process.exitCode=1;});

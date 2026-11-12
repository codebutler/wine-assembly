'use strict';
// Narrow exact shipping-module check; no compiler, WAT exports, or surrogate.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const root=process.cwd(),{createHostImports}=require(path.join(root,'lib/host-imports'));
const ownership=require(path.join(root,'lib/region-map.generated')).BASE.CALLBACK_OWNERSHIP;
const bytes=fs.readFileSync('build/wine-assembly.wasm');
const sha=crypto.createHash('sha256').update(bytes).digest('hex');
const u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,n>>>24];
(async()=>{
 let count=0,cases=0;const check=(a,b,msg)=>{assert.strictEqual(a,b,msg);count++};
 for(const mode of ['normal','stale-root-return','stale-epoch-return']){
  const memory=new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
  const ctx={getMemory:()=>memory.buffer},imports=createHostImports(ctx);
  Object.assign(imports.host,{memory,log:()=>{},log_i32:()=>{},get_ticks:()=>1000});
  const e=(await WebAssembly.instantiate(bytes,imports)).instance.exports;ctx.exports=e;
  const exe=fs.readFileSync('test/binaries/notepad.exe');new Uint8Array(memory.buffer).set(exe,e.get_staging());check(!!e.load_pe(exe.length),true,'PE establishes real invocation root');
  const alloc=n=>e.guest_alloc(n)>>>0,stack=alloc(8192)+4096,out=alloc(4),cb=alloc(32),resume=alloc(16);
  new Uint8Array(memory.buffer).set([0xff,0x05,...u32(out),0xc2,20,0],e.guest_to_wasm(cb));
  new Uint8Array(memory.buffer).set([0xc3],e.guest_to_wasm(resume));
  e.set_esp(stack);e.guest_write32(stack,0);e.set_eip(resume);e.set_yield_state(1,1);
  const tls=e.get_tls_slots(),fsBase=e.get_fs_base();
  check(e.fire_wave_out_callback_bound(17,19,cb,456),1,'canonical callback admitted');
  check(e.fire_wave_out_callback_bound(17,19,cb,456),0,'nested refused');
  if(mode==='normal'){
   e.run(10000);check(e.guest_read32(out),1,'real guest INC ran once');check(e.get_eip(),resume,'parked EIP restored');check(e.get_esp(),stack,'stack restored');check(e.get_yield_reason(),1,'wait restored');check(e.get_tls_slots(),tls,'TLS retained');check(e.get_fs_base(),fsBase,'FS retained');check(e.is_mm_timer_callback_active(),0,'callback retired');
  }else{
   const dv=new DataView(memory.buffer),off=ownership+(mode==='stale-root-return'?16:8);dv.setBigUint64(off,dv.getBigUint64(off,true)+1000n,true);
   const beforeEsp=e.get_esp();
   assert.throws(()=>e.run(10000),WebAssembly.RuntimeError,'stale owner traps at real RET');count++;
   // RET 20 pops 24 guest bytes before CACA000A validates the retained owner.
   // The continuation must not restore the remaining 40-byte saved context.
   check(e.guest_read32(out),1,'guest executes before rejected continuation');check(e.get_esp(),beforeEsp+24,'guest RET completed but saved caller frame was not restored');check(e.is_mm_timer_callback_active(),1,'stale continuation did not clear owner');check(e.get_yield_reason(),0,'stale continuation did not restore parked wait');
  }
  cases++;
 }
 console.log(JSON.stringify({result:'PASS',cases,assertions:count,moduleSha256:sha,moduleBytes:bytes.length,node:process.version,coverage:'exact shipping module; real guest INC/RET20; normal parked wave return and stale root/epoch return rejection'}));
})().catch(e=>{console.error(e);process.exitCode=1});

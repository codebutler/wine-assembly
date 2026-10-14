'use strict';
// Sanity's 5-bit color table needs PC24: 31 * 255 * float32(1/31)
// truncates to 255 on native x87 PC24, versus 254 with PC53/64.
const assert = require('assert');
const fs = require('fs');
const { compileSrcWasm } = require('./compile-src');
const { createHostImports } = require('../lib/host-imports');
const wasm = compileSrcWasm((f,s) => f === '13-exports.wat' ? s + `
(func (export "test_mul") (param $a f64) (param $b f64) (param $cw i32) (result f64)
 (global.set $fpu_cw (local.get $cw)) (call $fpu_mul (local.get $a) (local.get $b)))
(func (export "test_g2w") (param $a i32) (result i32) (call $g2w (local.get $a)))
` : s);
(async () => {
 const memory = new WebAssembly.Memory({initial:8192,maximum:8192,shared:true});
 const ctx={exports:null,getMemory:()=>memory.buffer};const {host}=createHostImports(ctx);
 Object.assign(host,{memory,log:()=>{},log_i32:()=>{},exit:()=>{},crash_unimplemented:()=>{},wait_multiple:()=>0,shell_execute:()=>33});
 const {instance}=await WebAssembly.instantiate(wasm,{host}); const e=ctx.exports=instance.exports;
 let checks=0;const eq=(x,y,label)=>{assert(Object.is(x,y),`${label}: ${x} != ${y}`);checks++};
 const step=2**-23;
 for(const sign of [1,-1]) for(const rc of [0,1,2,3]){
  const v=sign*(1+2**-24),up=rc===0?false:rc===1?sign<0:rc===2?sign>0:false;
  eq(e.test_mul(v,1,0x3f|(rc<<10)),sign*(1+(up?step:0)),`tie sign${sign} RC${rc}`);
 }
 eq(e.test_mul(1+3*2**-24,1,0x3f),1+2*step,'ties to even up');
 for(const exp of [-200,200]) eq(e.test_mul(2**exp,1+2**-24,0x3f),2**exp,'retain exponent '+exp);
 eq(e.test_mul(-0,2,0x3f),-0,'signed zero');eq(e.test_mul(Infinity,2,0x3f),Infinity,'infinity');
 assert(Number.isNaN(e.test_mul(NaN,1,0x3f)));checks++;
 eq(e.test_mul(2**-1050,1,0x3f),2**-1050,'f64 subnormal retained');
 eq(e.test_mul(1+2**-24,1,0x23f),1+2**-24,'PC53 unchanged');
 eq(e.test_mul(e.test_mul(31,255,0x3f),Math.fround(1/31),0x3f),255,'native PC24 color');
 eq(Math.trunc(e.test_mul(e.test_mul(31,255,0x23f),Math.fround(1/31),0x23f)),254,'native PC53 color');
 const mem=new Uint8Array(memory.buffer),dv=new DataView(memory.buffer),exe=fs.readFileSync(__dirname+'/binaries/notepad.exe');
 mem.set(exe,e.get_staging());assert(e.load_pe(exe.length));const base=e.get_image_base()>>>0,g=a=>e.test_g2w(a)>>>0,le=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];
 const data=base+0x50000,stack=base+0xd00000;let code=base+0x100000;
 // Run actual memory, reverse-register and pop-register multiplication forms.
 for(const arm of ['plain','generic','fast']) for(const pc of [0,0x200,0x300]) for(const form of ['mem','reg','pop']){
  e.set_x87_affine_fusion(0);e.set_x87_pipeline4_fusion(arm==='plain'?0:1);e.set_x87_island_predecode(arm==='fast'?1:0);e.set_x87_fuse_debug(16,0,-1);
  dv.setUint16(g(data),0x3f|pc,true);dv.setFloat64(g(data+8),31,true);dv.setFloat32(g(data+16),255,true);dv.setFloat32(g(data+20),Math.fround(1/31),true);
  const mult=addr=>form==='mem'?[0xd8,0x0d,...le(addr)]:[0xd9,0x05,...le(addr),...(form==='pop'?[0xde,0xc9]:[0xdc,0xc9,0xdd,0xd8])];
  const bytes=[0xdb,0xe3,0xd9,0x2d,...le(data),0xdd,0x05,...le(data+8),...mult(data+16),...mult(data+20),0xdd,0x1d,...le(data+24),0xc3];
  mem.set(bytes,g(code));dv.setUint32(g(stack),0,true);e.set_esp(stack);e.set_eip(code);e.run(100000);
  eq(e.get_eip()>>>0,0,arm+' returned');eq(Math.trunc(dv.getFloat64(g(data+24),true)),pc===0?255:254,`${arm}/${form}/PC${pc}`);code+=0x400;
 }
 console.log(`PASS ${checks} x87 multiplication precision checks`);
})().catch(e=>{console.error(e);process.exitCode=1});

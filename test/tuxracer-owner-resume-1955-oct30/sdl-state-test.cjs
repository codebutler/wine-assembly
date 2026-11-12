'use strict';
const vm=require('vm'),assert=require('assert');
const {sampleSDL}=require('./sdl-state.cjs');
function fixture(base){
  // PE loader relocation semantics, independently applied at known operand sites.
  const memory={buffer:new ArrayBuffer(0x40000)},dv=new DataView(memory.buffer);
  for(const [rva,hex,offsets] of [
    [0x1a120,'8b44240485c074090fbf0da04f031089088b44240885c074090fbf15a44f03108910a0b04f0310c3',[11,28,35]],
    [0x19530,'8b44240485c07406c70042010000b810440310c3',[15]]]){
    new Uint8Array(memory.buffer,rva,hex.length/2).set(Buffer.from(hex,'hex'));
    for(const o of offsets)dv.setUint32(rva+o,(dv.getUint32(rva+o,true)+base-0x10000000)>>>0,true);
  }
  dv.setInt16(0x34fa0,320,true);dv.setInt16(0x34fa4,260,true);dv.setInt16(0x34fa8,-4,true);
  dv.setUint8(0x34fb0,1);dv.setUint8(0x34410+13,1);
  return {mods:{sdl:{loadAddr:base,origBase:0x10000000}},memory,g2w:a=>0x1000+a-base,tickState:{batch:7},renderer:{_mouseX:320,_mouseY:240,_mouseButtonsMask:1}};
}
// Reserve the unmapped sentinel range in the mock translation as in production.
function shifted(base){const c=fixture(base),b=new ArrayBuffer(0x41000);new Uint8Array(b,0x1000).set(new Uint8Array(c.memory.buffer));c.memory.buffer=b;return c;}
const run=(f,c)=>vm.runInNewContext('('+f.toString()+')()',c);
for(const base of [0x10000000,0x12000000,0xa47000]){
  const c=shifted(base),before=Buffer.from(c.memory.buffer),s=run(sampleSDL,c);
  assert.equal(s.x,320);assert.equal(s.y,260);assert.equal(s.relativeX,-4);assert.equal(s.buttons,1);assert.equal(s.keys.return,1);
  assert(before.equals(Buffer.from(c.memory.buffer)));
}
let c=shifted(0xa47000);new Uint8Array(c.memory.buffer)[0x1000+0x1a120+11]^=1;assert.throws(()=>run(sampleSDL,c),/relocation mismatch/);
c=shifted(0xa47000);new Uint8Array(c.memory.buffer)[0x1000+0x19530]^=1;assert.throws(()=>run(sampleSDL,c),/relocation mismatch/);
c=shifted(0xa47000);c.g2w=()=>240;assert.throws(()=>run(sampleSDL,c),/unmapped/);
c=shifted(0xa47000);c.mods={};assert.throws(()=>run(sampleSDL,c),/absent/);
c=shifted(0xa47000);new Uint8Array(c.memory.buffer,0x1000+0x1a120,40).set(Buffer.from('8b44240485c074090fbf0da04f031089088b44240885c074090fbf15a44f03108910a0b04f0310c3','hex'));assert.throws(()=>run(sampleSDL,c),/relocation mismatch/);
if(process.argv[2]){
  const old=require(require('path').resolve(process.argv[2])).sampleSDL;
  assert.throws(()=>run(old,shifted(0xa47000)),/code mismatch/);
}
console.log(JSON.stringify({PASS:true,positive:3,rejecting:5,readOnly:true,oldRejectsActualRelocation:Boolean(process.argv[2])}));

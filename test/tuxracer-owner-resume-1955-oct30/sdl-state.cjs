'use strict';
// Read-only controlEval sampler for SDL.dll sha256
// 101732c9f75df3574a66ee4094df549aad63960bdb56025a61244336e69b03b8.
// Getter code and absolute operands are checked AFTER PE relocation.
function sampleSDL() {
  const m=Object.entries(mods).find(([n])=>/^sdl(?:\.dll)?$/i.test(n));
  if(!m)throw Error('SDL module absent');
  const mod=m[1],base=mod.loadAddr>>>0;
  if((mod.origBase>>>0)!==0x10000000)throw Error('unexpected SDL original base');
  function bytes(rva,n){
    let start;
    for(let i=0;i<n;i++){
      const p=g2w((base+rva+i)>>>0);
      if(!Number.isInteger(p)||p<256||p>=memory.buffer.byteLength||(i&&p!==start+i))throw Error('unmapped/noncontiguous SDL range');
      if(!i)start=p;
    }
    return Array.from(new Uint8Array(memory.buffer,start,n));
  }
  const hex=b=>b.map(x=>x.toString(16).padStart(2,'0')).join('');
  const le=n=>hex([n&255,(n>>>8)&255,(n>>>16)&255,n>>>24]);
  function getter(rva,canonical,operands){
    let expected=canonical;
    for(const target of operands)expected=expected.replace(le(0x10000000+target),le(base+target));
    if(hex(bytes(rva,expected.length/2))!==expected)throw Error('SDL getter code/relocation mismatch');
  }
  getter(0x1a120,'8b44240485c074090fbf0da04f031089088b44240885c074090fbf15a44f03108910a0b04f0310c3',[0x34fa0,0x34fa4,0x34fb0]);
  getter(0x19530,'8b44240485c07406c70042010000b810440310c3',[0x34410]);
  const s16=r=>{const b=bytes(r,2),u=b[0]+b[1]*256;return u>=32768?u-65536:u;};
  return {module:m[0],loadAddr:base,origBase:mod.origBase,getMouseStateRVA:0x1a120,
    getKeyStateRVA:0x19530,verifiedGetter:true,verifiedRelocations:true,
    x:s16(0x34fa0),y:s16(0x34fa4),buttons:bytes(0x34fb0,1)[0],
    relativeX:s16(0x34fa8),relativeY:s16(0x34fac),batch:tickState.batch,
    keys:{return:bytes(0x34410+13,1)[0],escape:bytes(0x34410+27,1)[0],space:bytes(0x34410+32,1)[0]},
    host:{x:renderer._mouseX,y:renderer._mouseY,buttons:renderer._mouseButtonsMask},
    scope:'read-only post-batch snapshot; does not prove callback execution'};
}
module.exports={sampleSDL};

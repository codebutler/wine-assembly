'use strict';
const {neLifecycleImage} = require('./ne-lifecycle-image');

// Real Pascal calls from an owned LibEntry, with KERNEL ordinal relocations.
// VALUE queries usage, ordinal 4 frees one acquired ref, ordinal 5 resolves
// WIN87EM.1 and ordinal 6 calls that resolved far pointer.
function neFixedLifecycleImage({loads=2, result=1, name='WIN87EM'}={}) {
  const b=Buffer.alloc(0x600), n=0x80, w=(p,v)=>b.writeUInt16LE(v,p);
  neLifecycleImage({dependencies:['KERNEL','WIN87EM']}).copy(b);
  w(n+6,28);w(n+0x26,0x80);w(n+0x28,0xa0);
  b.fill(0,n+0x60,n+0xb0);
  b[n+0x60]=8;b[n+0x61]=1;
  for(const [i,off] of [0,16,32,0x90,0xb0,0xd0,0xe0,0xf0].entries()) {b[n+0x62+i*3]=1;w(n+0x63+i*3,off);}
  b.set([3,87,69,80,3,0,5,86,65,76,85,69,2,0,0],n+0x80);
  w(n+0xa0,0);w(n+0xa2,7);
  w(n+0x44,0x100);w(n+0x48,0x50);
  b.fill(0,0x200,0x400);b.set([0xeb,0x3e],0x200);
  b.set([0xb8,1,0,0xca,2,0],0x220);
  b.write(name+'\0',0x520,'ascii');
  b.write('GETMODULEHANDLE\0',0x540,'ascii');
  const reloc=[];
  const emit=(start,ops)=>{let p=0x200+start;for(const op of ops) {
    if(Array.isArray(op)) {b.set(op,p);p+=op.length;}
    else {b.set([0x9a,0xff,0xff,0,0],p);reloc.push({site:p+1-0x200,ordinal:op});p+=5;}
  } assertFits(p,start);};
  function assertFits(p,start){if(p>0x300)throw new Error('NE fixed fixture code overflow '+start);}
  const init=[[0x66,0xb8,0,0,0xbb,0xaa]]; // high EAX survives each WORD result
  for(let i=0;i<loads;i++)init.push([0x1e,0xb8,0x20,0,0x50],95,[0xa3,i*2,0]);
  init.push([0x66,0xa3,12,0,0xb8,result,0,0xcb]);emit(0x40,init);
  emit(16,[[0xff,0x36,0,0],48,[0xcb]]);
  emit(0x90,[[0xff,0x36,0,0,0xb8,0x5a,0x5a],96,[0xcb]]);
  emit(0xb0,[[0xff,0x36,0,0,0x6a,0,0x6a,1],50,[0xa3,8,0,0x89,0x16,10,0,0xcb]]);
  emit(0xd0,[[0xff,0x1e,8,0,0xcb]]);
  emit(0xe0,[[0x1e,0xb8,0x20,0,0x50],47,[0xcb]]);
  emit(0xf0,[[0xff,0x36,0,0,0x1e,0xb8,0x40,0,0x50],50,[0xcb]]);
  w(0x300,reloc.length);
  for(const [i,r] of reloc.entries()){const p=0x302+i*8;b.set([3,1],p);w(p+2,r.site);w(p+4,1);w(p+6,r.ordinal);}
  return b;
}
module.exports={neFixedLifecycleImage};

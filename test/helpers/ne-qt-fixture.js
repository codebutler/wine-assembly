'use strict';
const {neGuestCaller}=require('./ne-guest-caller');
const {neLifecycleImage}=require('./ne-lifecycle-image');

// Real PE instructions: EAT lifecycle calls obtain the NE entry, ordinary
// GetProcAddress obtains QT_Thunk, and a wrapper calls it with EDX=far entry.
// Generation never runs an interpreter or installs a host-provided address.
function neQtFixture({base=0x400000,words=[1000,0],cleanup=words.length*2,
  eax=0x89abcdef,edx=0x76543210,ecx=0xfedcba98,failure=null}={}) {
  if(!Array.isArray(words)||words.length>32||words.some(w=>!Number.isInteger(w)||w<0||w>65535))
    throw new RangeError('Invalid QT fixture words');
  if(!Number.isInteger(cleanup)||cleanup<0||cleanup>65535)throw new RangeError('Invalid QT cleanup');
  if(![null,'trap','loop','bad-return'].includes(failure))throw new Error('Unknown QT failure');
  const pe=neGuestCaller(base,{calls:[[35,[base+0x2840]],[37,[{result:0},base+0x2980]]]}),
    raw=r=>r-0x1000+0x200,code=[],u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,n>>>24],
    u16=n=>[n&255,n>>>8],emit=(...b)=>code.push(...b),out=base+0x2a00,qt=base+0x2610;
  pe.bytes.write('QT_Thunk\0',raw(0x29a0));
  // The base helper's final MOV EAX,1 / RET is replaced, retaining its actual
  // GetModuleHandle/EAT and LoadLibrary16/GetProcAddress16 instructions.
  const prefix=pe.codeSize-6;
  emit(0x68,...u32(base+0x2800),0xff,0x15,...u32(base+0x1900));
  emit(0x68,...u32(base+0x29a0),0x50,0xff,0x15,...u32(base+0x1908),0xa3,...u32(qt));
  emit(0x55,0x89,0xe5,0x83,0xec,0x40); // B=EBP, 64-byte scratch
  const scratch=Array.from({length:16},(_,i)=>(0xcafe0000+i)>>>0);
  for(let i=0;i<16;i++)emit(0xc7,0x45,(-64+i*4)&255,...u32(scratch[i]));
  emit(0xbb,...u32(0x13579bdf),0xbe,...u32(0x2468ace0),0xbf,...u32(0x3579bdf1));
  emit(0x53,0x56,0x57); // saved EBX/ESI/EDI, as in original PMPRO62F
  for(const word of [...words].reverse())emit(0x66,0x68,...u16(word));
  emit(0x89,0x25,...u32(out),0x89,0x2d,...u32(out+4)); // pre-call ESP and B
  emit(0x8b,0x15,...u32(pe.result+4),0xff,0x15,...u32(qt));
  const afterQt=pe.entry+prefix+code.length;
  emit(0xa3,...u32(out+8),0x89,0x15,...u32(out+12),0x89,0x0d,...u32(out+16));
  emit(0x89,0x25,...u32(out+20),0x89,0x2d,...u32(out+24));
  for(let i=0;i<16;i++)emit(0x8b,0x55,(-64+i*4)&255,0x89,0x15,...u32(out+48+i*4));
  emit(0x5f,0x5e,0x5b,0x89,0x1d,...u32(out+28),0x89,0x35,...u32(out+32),0x89,0x3d,...u32(out+36));
  emit(0xc9); // leave restores the outer EBP even for fixture under-cleanup
  emit(0xff,0x35,...u32(pe.result),0xff,0x15,...u32(pe.slots+4),0xc3);
  if(prefix+code.length>0x600)throw new Error('QT PE code overlaps fixture data');
  pe.bytes.set(code,raw(0x2000)+prefix);
  const ne=neLifecycleImage(),body=[],push=(...b)=>body.push(...b);
  ne.writeUInt16LE(0x40,0x80+0x60+6); // VALUE ordinal 2, independently of name
  // Before establishing a private callee frame, mutate the incoming BP's
  // original PE scratch. This distinguishes aliasing from a copied BP frame.
  push(0x36,0x66,0xc7,0x46,0xfc,...u32(0xfacebeef));
  scratch[15]=0xfacebeef;
  push(0x36,0x89,0x76,0xf4,0x36,0x89,0x7e,0xf8); // save incoming SI/DI in caller scratch
  for(const modrm of [0xc0,0xd8,0xe0,0xe8]) // ES,DS,FS,GS must be zero
    push(0x8c,modrm,0x85,0xc0,0x74,1,0xcc);
  push(0x8c,0xd0,0x39,0xd0,0x74,1,0xcc); // DX is the alias SS
  push(0x55,0x89,0xe5);
  const branches=[];
  for(let i=0;i<words.length;i++) {
    push(0x36,0x81,0x7e,6+i*2,...u16(words[i]),0x0f,0x85,0,0);
    branches.push(body.length-2);
  }
  if(failure==='trap')push(0xcc);
  else if(failure==='loop')push(0xeb,0xfe);
  else {
    push(0x66,0xb8,...u32(eax),0x66,0xba,...u32(edx),0x66,0xb9,...u32(ecx));
    if(failure==='bad-return')push(0xc7,0x46,4,0,0); // corrupt return CS
    push(0x5d,...(cleanup?[0xca,...u16(cleanup)]:[0xcb]));
  }
  const bad=body.length;push(0xcc);
  for(const at of branches){const delta=bad-at-2;body[at]=delta&255;body[at+1]=delta>>>8;}
  // Enlarge code segment for the 32-WORD verifier; relocate only its file
  // extent, never the entry or lifecycle contracts.
  const image=Buffer.alloc(0x800);ne.copy(image);
  image.writeUInt16LE(0x400,0x80+0x42);image.writeUInt16LE(0x400,0x80+0x46);
  image.writeUInt16LE(0x60,0x80+0x48);
  ne.copy(image,0x600,0x300,0x400);image.fill(0,0x300,0x600);image.set(body,0x240);
  return {pe:pe.bytes,ne:image,entry:pe.entry,afterQt,result:out,qtSlot:qt,
    scratch,words:[...words],cleanup,expected:{eax:eax>>>0,edx:edx>>>0,ecx:ecx>>>0}};
}
module.exports={neQtFixture};

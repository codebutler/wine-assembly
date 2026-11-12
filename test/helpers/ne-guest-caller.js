'use strict';
const {makeFixture} = require('../../tools/kernel32-native-fixture');
// A real PE caller imports GetModuleHandleA, walks KERNEL32's guest EAT, then
// executes the resulting JMP stubs. No host-injected API address is involved.
function neGuestCaller(base=0x400000,{dll=false,ordinalImports=false,path='C:\\Outlaws\\DEMO.DLL',calls}={}) {
  const bytes=makeFixture(),raw=rva=>rva-0x1000+0x200,optional=0x80+24;
  bytes.writeUInt32LE(base,optional+28);
  if(dll)bytes.writeUInt16LE(0x210e,0x80+22);
  if(ordinalImports)for(const ordinal of [35,36,37])
    bytes.writeUInt32LE(0x80000000+ordinal,raw(0x191c+(ordinal-35)*4));
  const result=base+0x2700,entry=base+0x2000,slots=base+0x2600;
  bytes.write('kernel32.dll\0',raw(0x2800));bytes.write(path+'\0',raw(0x2840));bytes.write('VALUE\0',raw(0x2980));
  const code=[],emit=(...b)=>code.push(...b),u32=n=>[n&255,(n>>>8)&255,(n>>>16)&255,n>>>24];
  emit(0x68,...u32(base+0x2800),0xff,0x15,...u32(base+0x1900));
  emit(0x89,0xc3,0x8b,0x53,0x3c,0x01,0xda,0x8b,0x52,0x78,0x01,0xda,
    0x8b,0x4a,0x10,0x8b,0x72,0x1c,0x01,0xde);
  for(const ordinal of [35,36,37]) {
    emit(0xb8,...u32(ordinal),0x29,0xc8,0x8b,0x04,0x86,0x01,0xd8,0xa3,...u32(slots+(ordinal-35)*4));
  }
  const handle={result:0},other={result:1};
  calls ||= [[35,[base+0x2840]],[35,[base+0x2840]],
    [37,[handle,base+0x2980]],[37,[handle,2]],[37,[handle,999]],
    [36,[handle]],[36,[other]]];
  calls.forEach(([ordinal,args],index)=>{
    for(const arg of [...args].reverse()) {
      if(typeof arg==='object')emit(0xff,0x35,...u32(result+arg.result*4));
      else emit(0x68,...u32(arg));
    }
    emit(0xff,0x15,...u32((ordinalImports?base+0x191c:slots)+(ordinal-35)*4),0xa3,...u32(result+index*4));
  });
  emit(0xb8,1,0,0,0,...(dll?[0xc2,12,0]:[0xc3]));
  if(code.length>0x600)throw new Error('NE caller code overflow');
  bytes.set(code,raw(0x2000));
  return {bytes,entry,result,slots,codeSize:code.length};
}
module.exports={neGuestCaller};

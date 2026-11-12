'use strict';
const assert=require('node:assert/strict');
const {planNeQtStack}=require('../lib/ne-qt-stack');
const memory=new ArrayBuffer(0x30000),bytes=new Uint8Array(memory),view=new DataView(memory);
// Same alias contract for low direct and high sparse guest addresses. No guest
// code executes; these tests cover only planner rejection and address identity.
for(const base of [0x7400000,0x91230000,0xffff0000]) {
  const e={guest_to_wasm:g=>g>=base&&g<base+65536?0x10000+g-base:0xf0};
  const ebp=base+0x8000,esp=ebp-0x54;
  view.setUint32(0x10000+esp-base,0x4111d8,true);
  const before=bytes.slice(),plan=planNeQtStack(e,memory,{esp,ebp});
  assert.equal(plan.base,base);assert.equal(plan.argumentStart,ebp-0x50);
  assert.equal(plan.bp,0x8000);assert.equal(plan.sp,0x7fac);
  assert.equal(plan.argumentStart+4,ebp-0x4c,'actual RETF4 cleanup');
  assert.equal(plan.returnAddress,0x4111d8);assert.equal(plan.maxCleanup,20);
  assert(Object.isFrozen(plan));assert.deepEqual(bytes,before,'planning is read-only');
  // A BP-relative write through the planned alias lands in the PE scratch,
  // not a private stack with merely similar initial bytes.
  view.setUint32(plan.wasmBase+plan.bp-0x20,0x12345678,true);
  assert.equal(view.getUint32(e.guest_to_wasm(ebp-0x20),true),0x12345678);
  for(const frame of [{esp:base,ebp},{esp:esp+1,ebp},{esp,ebp:ebp+1},
    {esp,ebp:esp+4},{esp,ebp:base+65536},{esp:base+65534,ebp:base+65535}])
    assert.throws(()=>planNeQtStack(e,memory,frame),RangeError);
  const hole={guest_to_wasm:g=>g>=base+0x3000&&g<base+0x4000?0xf0:e.guest_to_wasm(g)};
  assert.throws(()=>planNeQtStack(hole,memory,{esp,ebp}),/Unmapped/);
  const split={guest_to_wasm:g=>e.guest_to_wasm(g)+(g>=base+0x9000?4096:0)};
  assert.throws(()=>planNeQtStack(split,memory,{esp,ebp}),/Noncontiguous/);
}
for(const value of [-1,0x100000000,NaN,1.5,undefined])
  assert.throws(()=>planNeQtStack({},memory,{esp:value,ebp:0x8000}),RangeError);
console.log('PASS QT stack alias planning: direct/sparse, scratch identity, holes, split pages and wrap rejection');

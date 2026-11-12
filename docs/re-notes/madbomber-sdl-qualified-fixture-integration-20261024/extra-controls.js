'use strict';
const assert = require('node:assert/strict');
const { describeSystemThunk: describe } = require('./repo/test/system-thunk-identity');
const name = 'waveOutGetErrorTextA', id = 4590;
function fixture() {
  const memory = new ArrayBuffer(256), dv = new DataView(memory), b = new Uint8Array(memory);
  dv.setUint32(32, 78, true); dv.setUint32(36, id, true); b.set(Buffer.from(name + '\0'), 80);
  return {memory,dv,b,e:{get_thunk_base:()=>32,get_thunk_end:()=>40,guest_to_wasm:p=>p,get_guest_base:()=>0}};
}
let rejects = 0;
for (const mutate of [
  f=>f.dv.setUint32(36,0,true),
  f=>f.b[80]=87,
  f=>f.b[80+name.length]=1,
  f=>f.e.get_thunk_end=()=>39,
  f=>f.e.guest_to_wasm=()=>252,
  f=>f.dv.setUint32(32,0xffffffff,true),
]) {
  const f=fixture(); mutate(f); assert.throws(()=>describe(f.e,f.memory,32,name,id)); rejects++;
}
const f=fixture();assert.equal(describe(f.e,f.memory,32,name,id).apiId,id);
for (const p of [24,31,33,40,0xffffffff]) {assert.throws(()=>describe(f.e,f.memory,p,name,id));rejects++;}
console.log(JSON.stringify({verdict:'PASS',additionalRejectingControls:rejects,positiveExactEndBoundary:true}));

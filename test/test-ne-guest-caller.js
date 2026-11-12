'use strict';
const assert=require('node:assert/strict');
const {neGuestCaller}=require('./helpers/ne-guest-caller');
for(const base of [0x400000,0x10000000])for(const dll of [false,true]) {
  const f=neGuestCaller(base,{dll});
  assert.equal(f.bytes.readUInt32LE(0x80+24+28),base);
  assert.equal(f.entry,base+0x2000);
  assert.equal(f.bytes[0x1200],0x68);
  assert(f.bytes.includes(Buffer.from([0x8b,0x04,0x86])),'guest EAT indexed read');
  assert.equal(f.bytes.includes(Buffer.from([0xc2,12,0])),dll);
}
const ordinal=neGuestCaller(0x400000,{ordinalImports:true});
assert.equal(ordinal.bytes.readUInt32LE(0xb1c),0x80000023);
assert.equal(ordinal.bytes.readUInt32LE(0xb24),0x80000025);
console.log('PASS deterministic PE EAT lifecycle caller generation (no guest execution)');

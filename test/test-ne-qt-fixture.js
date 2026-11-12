'use strict';
const assert=require('node:assert/strict');
const {neQtFixture}=require('./helpers/ne-qt-fixture');
const {inspectNeDll}=require('../lib/ne-image');
for(const words of [[],[1000,0],[0x1234,0xabcd,0x5678,0x9876,0x1357],Array.from({length:32},(_,i)=>i*2039)]) {
  for(const cleanup of [0,4,words.length*2,1,66]) {
    const fixture=neQtFixture({words,cleanup}),image=inspectNeDll(fixture.ne);
    assert.deepEqual(image.entries.get(2),{segment:1,offset:0x40});
    assert.equal(image.names.get('VALUE'),2);
    assert.equal(image.names.get('WEP'),3);
    assert(fixture.pe.includes(Buffer.from('QT_Thunk\0')));
    assert(fixture.pe.includes(Buffer.from([0x55,0x89,0xe5,0x83,0xec,0x40])));
    assert(fixture.ne.includes(Buffer.from(cleanup?[0xca,cleanup&255,cleanup>>>8]:[0xcb])));
    assert(fixture.afterQt>fixture.entry&&fixture.afterQt<fixture.entry+0x600);
    assert.equal(fixture.scratch.length,16);
  }
}
for(const failure of ['trap','loop','bad-return'])inspectNeDll(neQtFixture({failure}).ne);
assert.throws(()=>neQtFixture({words:[65536]}),RangeError);
assert.throws(()=>neQtFixture({words:Array(33).fill(0)}),RangeError);
assert.throws(()=>neQtFixture({cleanup:-1}),RangeError);
assert.throws(()=>neQtFixture({failure:'fake-success'}));
console.log('PASS QT PE/NE fixture generation and image validation; no guest execution');

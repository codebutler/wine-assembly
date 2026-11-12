'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {memoryStore} = require(process.argv[2] || '../repo/lib/overlay-store.js');
const file = (path, data, attrs=0x21) => ({path, kind:'file', data:Buffer.from(data), attrs, name:path, creationTime:{lo:7,hi:8},lastAccessTime:{lo:9,hi:10},lastWriteTime:{lo:11,hi:12}});
async function snapshot(s) { return Promise.all((await s.list()).map(async m => ({...m,data:await s.read(m.path)}))); }
async function seeded() { const s=memoryStore();await s.writeBatch([file('old','OLD'),file('stable','STABLE'),{path:'directory',kind:'dir',attrs:16},{path:'deleted',kind:'whiteout'}]);return s; }
async function unchanged(records, pattern) {const s=await seeded(),before=await snapshot(s);await assert.rejects(Promise.resolve().then(()=>s.writeBatch(records)),pattern);assert.deepEqual(await snapshot(s),before);return s;}
test('independent: invalid tail after duplicate overwrite, addition, dir and whiteout rolls back complete metadata',async()=>{
  await unchanged([file('old','1'),file('old','2'),file('new','3'),{path:'stable',kind:'whiteout'},{path:'directory',kind:'file',data:Buffer.from('x')},{path:'deleted',kind:'dir'},{path:'invalid',kind:'invalid'}],/kind/);
});
test('independent: iterator next failure preserves original saves and listing order',async()=>{
  const records={[Symbol.iterator](){let i=0;return {next(){if(i++===0)return {value:file('old','BAD'),done:false};throw Error('next failure');}};}};
  await unchanged(records,/next failure/);
});
test('independent: conversion fails after bytes were staged; iterator closes and no publication',async()=>{
  let closed=false;function* records(){try {yield file('new','NEW');yield {path:'old',kind:'file',attrs:255,data:{length:2,get 0(){return 4;},get 1(){throw Error('conversion failure');}}};}finally{closed=true;}}
  await unchanged(records(),/conversion failure/);assert.equal(closed,true);
});
test('independent: coercion and metadata getter failures roll back staged duplicate paths',async()=>{
  await unchanged([file('old','BAD'),{path:{toString(){throw Error('path conversion');}},kind:'dir'}],/path conversion/);
  await unchanged([file('old','BAD'),{path:'new',kind:'dir',get attrs(){throw Error('metadata failure');}}],/metadata failure/);
});
test('independent: successful duplicate paths last wins and remove stale bytes across kind changes',async()=>{
  const s=await seeded();assert.deepEqual(await s.writeBatch([file('old','first'),{path:'old',kind:'dir'},file('old','last'),file('stable','temporary'),{path:'stable',kind:'whiteout'},file('directory','temporary'),{path:'directory',kind:'dir'}]),{written:7,removed:0});
  assert.equal(Buffer.from(await s.read('old')).toString(),'last');assert.equal(await s.read('stable'),null);assert.equal(await s.read('directory'),null);
  assert.equal((await s.list()).find(x=>x.path==='old').size,4);
});
test('independent: Buffer and Uint8Array subview input and read buffers retain ownership',async()=>{
  const s=memoryStore();const backing=Uint8Array.from([99,1,2,3,88]),view=backing.subarray(1,4),buffer=Buffer.from([4,5]);
  await s.writeBatch([{path:'v',kind:'file',data:view},{path:'b',kind:'file',data:buffer}]);backing.fill(0);buffer.fill(0);
  assert.deepEqual([...await s.read('v')],[1,2,3]);assert.deepEqual([...await s.read('b')],[4,5]);
  const read=await s.read('v');read.fill(9);assert.deepEqual([...await s.read('v')],[1,2,3]);
});
test('independent: staged input mutation by later iterator step cannot alter staged payload',async()=>{
  const s=memoryStore(),r=file('old','SAFE');function* records(){yield r;r.data.fill(0);yield file('second','OK');}
  await s.writeBatch(records());assert.equal(Buffer.from(await s.read('old')).toString(),'SAFE');
});
test('independent: empty and null batches preserve every metadata field and bytes; rejected batch can retry',async()=>{
  const s=await seeded(),before=await snapshot(s);assert.deepEqual(await s.writeBatch([]),{written:0,removed:0});assert.deepEqual(await s.writeBatch(null),{written:0,removed:0});assert.deepEqual(await snapshot(s),before);
  await assert.rejects(Promise.resolve().then(()=>s.writeBatch([file('old','BAD'),{path:'bad',kind:'file',size:-2}])),/size/);assert.deepEqual(await snapshot(s),before);
  await s.writeBatch([file('old','GOOD')]);assert.equal(Buffer.from(await s.read('old')).toString(),'GOOD');
});

'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const readerPath = process.env.READER_UNDER_TEST || './readers';
const {createReader} = require(readerPath);
const owner = require.cache[require.resolve(readerPath)];

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'module-independent-'));
  await fs.mkdir(path.join(root,'lib/nested'),{recursive:true});
  const file = path.join(root,'lib/apps.js');
  t.after(async () => {
    for (const [id,m] of Object.entries(require.cache)) {
      if (id.startsWith(root+path.sep)) delete require.cache[id];
      else m.children = m.children.filter(c => !c.filename?.startsWith(root+path.sep));
    }
    await fs.rm(root,{recursive:true,force:true});
  });
  const reader = createReader({root,codexRoot:false,claudeRoot:false,processes:false});
  return {root,file,reader,write:source=>fs.writeFile(file,source)};
}
const source = (label,padding=0) => `module.exports={APPS:{probe:{exe:'probe.exe'}},DESKTOP_APPS:[['probe',${JSON.stringify(label)}]],padding:${JSON.stringify('x'.repeat(padding))}};`;
const name = state => state.candidates.find(c=>c.id==='probe')?.name;

test('large registry refreshes leave zero reader-owned retired modules',async t=>{
  const f=await fixture(t);
  for(let i=0;i<32;i++) {await f.write(source('revision-'+i,256*1024));assert.equal(name(await f.reader.snapshot()),'revision-'+i);}
  const held=owner.children.filter(m=>m.filename===f.file);
  const bytes=held.reduce((sum,m)=>sum+Buffer.byteLength(JSON.stringify(m.exports)),0);
  t.diagnostic(`direct reader children=${held.length}; retained exported bytes=${bytes}; 32 x 256KiB registry revisions`);
  assert.equal(held.length,0);assert.equal(bytes,0);
});

test('nested relative imports share dependency cache and expose normal path resolution',async t=>{
  const f=await fixture(t), leaf=path.join(f.root,'lib/nested/leaf.json'),dep=path.join(f.root,'lib/nested/label.js');
  await fs.writeFile(leaf,JSON.stringify({label:'nested 漢😀'}));
  await fs.writeFile(dep,"module.exports={label:require('./leaf.json').label,file:__filename,dir:__dirname,parent:module.parent.filename};");
  await f.write("const d=require('./nested/label');if(d.file!==require.resolve('./nested/label')||d.dir!==__dirname+'/nested'||d.parent!==__filename)throw Error('paths');module.exports={APPS:{probe:{exe:'p.exe'}},DESKTOP_APPS:[['probe',d.label]]};");
  assert.equal(name(await f.reader.snapshot()),'nested 漢😀');
  const cached=require.cache[dep],firstParent=cached.parent;
  assert.equal(firstParent.filename,f.file);assert.ok(firstParent.children.includes(cached));
  await fs.writeFile(leaf,JSON.stringify({label:'new dependency bytes'}));
  for(let i=0;i<12;i++) assert.equal(name(await f.reader.snapshot()),'nested 漢😀');
  assert.equal(require.cache[dep],cached);assert.equal(cached.parent,firstParent);
  assert.equal(require(leaf).label,'nested 漢😀');
  t.diagnostic(`dependency module.parent retains the first registry; parent.loaded=${firstParent.loaded}; direct reader registries=${owner.children.filter(m=>m.filename===f.file).length}; dependency refresh intentionally shared`);
});

test('external cached registry stays identical through success, syntax, throw and missing dependency',async t=>{
  const f=await fixture(t);await f.write(source('external-old'));
  const old=require(f.file), cached=require.cache[f.file];
  await f.write(source('fresh'));assert.equal(name(await f.reader.snapshot()),'fresh');
  for(const [bad,pattern] of [["module.exports={",/Unexpected/],["throw Error('independent failure')",/independent failure/],["require('./absent-dependency')",/Cannot find module/]]) {
    await f.write(bad);const state=await f.reader.snapshot();
    assert.ok(state.warnings.some(w=>w.startsWith('App registry:')&&pattern.test(w)));
    assert.equal(name(state),undefined,'failed evaluation must not reuse last good dashboard state');
    assert.equal(require.cache[f.file],cached);assert.equal(require(f.file),old);
  }
  await f.write(source('recovered 漢😀'));assert.equal(name(await f.reader.snapshot()),'recovered 漢😀');
  assert.equal(require.cache[f.file],cached);assert.equal(require(f.file),old);
});

test('atomic replacement, rollback, BOM and shebang preserve fresh Unicode exports',async t=>{
  const f=await fixture(t);
  for(const [i,prefix] of [[0,'\ufeff'],[1,'#!/usr/bin/env node\n'],[2,'']]) {
    await fs.writeFile(f.file+'.new',prefix+source('version-'+i+' 漢😀'));await fs.rename(f.file+'.new',f.file);
    assert.equal(name(await f.reader.snapshot()),'version-'+i+' 漢😀');
  }
  await f.write(source('version-0 漢😀'));assert.equal(name(await f.reader.snapshot()),'version-0 漢😀');
});

// Standard CommonJS re-entry: while apps is loading, its dependency must see
// that same partial exports object. This oracle is unchanged for both sources.
test('CommonJS cyclic relative import sees current partial registry exports',async t=>{
  const f=await fixture(t);
  await fs.writeFile(path.join(f.root,'lib/nested/back.js'),"module.exports=require('../apps');");
  await f.write("exports.APPS={probe:{exe:'p.exe'}};exports.DESKTOP_APPS=[['probe','cyclic fresh']];if(require('./nested/back')!==module.exports)throw Error('cycle observed another registry exports object');");
  const state=await f.reader.snapshot();
  assert.equal(name(state),'cyclic fresh',JSON.stringify(state.warnings));
});

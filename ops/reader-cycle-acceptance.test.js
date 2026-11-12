'use strict';
// Independent native-loader comparison. Production source and supplied tests
// are unchanged. No VM, browser, live service or memory-causality assertion.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const readerPath = process.env.READER_UNDER_TEST || './readers';
const {createReader} = require(readerPath);
const readerModule = require.cache[require.resolve(readerPath)];
const label = s => s.candidates.find(c => c.id === 'probe')?.name;
const registry = n => `({APPS:{probe:{exe:'p.exe'}},DESKTOP_APPS:[['probe',${JSON.stringify(n)}]]})`;

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cycle-accept-'));
  await fs.mkdir(path.join(root,'lib'), {recursive:true});
  await fs.mkdir(path.join(root,'emulator'));
  const file = path.join(root,'lib/apps.js');
  const token = 'cycle_accept_' + path.basename(root).replaceAll('-','_');
  globalThis[token] = {};
  t.after(async () => {
    delete globalThis[token];
    for (const [key,m] of Object.entries(require.cache)) {
      if (key.startsWith(root + path.sep)) delete require.cache[key];
      else m.children = m.children.filter(c => !c.filename?.startsWith(root + path.sep));
    }
    await fs.rm(root,{recursive:true,force:true});
  });
  return {root,file,token,state:globalThis[token],
    reader:createReader({root,emulatorRoot:path.join(root,'emulator'),codexRoot:false,claudeRoot:false,processes:false}),
    write:s=>fs.writeFile(file,s), dep:s=>fs.writeFile(path.join(root,'lib/back.js'),s)};
}

for (const mode of ['partial','replace-before','replace-after','throw-after-cycle']) {
  test(`native CommonJS parity: ${mode}, loaded state and circular proxy`, async t => {
    async function run(native) {
      const f = await setup(t);
      await f.dep(`const s=globalThis[${JSON.stringify(f.token)}];s.seen=require('./apps');s.loading=require.cache[require.resolve('./apps')].loaded;module.exports=s.seen;`);
      await f.write(`const s=globalThis[${JSON.stringify(f.token)}];s.root=module;s.partial=exports;
        ${mode==='replace-before' ? `module.exports=${registry(mode)};` : `Object.assign(exports,${registry(mode)});`}
        s.before=module.exports;const back=require('./back');s.same=back===module.exports;
        ${mode==='replace-after' ? `module.exports=${registry(mode)};s.self=require('./apps')===module.exports;` : ''}
        ${mode==='throw-after-cycle' ? "throw Error('intentional parity throw');" : ''}`);
      if (native) {
        if (mode==='throw-after-cycle') assert.throws(()=>require(f.file),/intentional parity throw/);
        else require(f.file);
      } else {
        const snap=await f.reader.snapshot();
        if (mode==='throw-after-cycle') {
          assert.equal(label(snap),undefined);
          assert.ok(snap.warnings.some(w=>w.includes('intentional parity throw')));
        } else assert.equal(label(snap),mode);
        assert.equal(require.cache[f.file],undefined);
      }
      const s=f.state, dep=require.cache[path.join(f.root,'lib/back.js')];
      assert.equal(s.same,true,'cyclic dependency sees current exports');
      assert.equal(s.loading,false,'registry is in progress during dependency');
      assert.equal(dep.loaded,true);
      assert.equal(dep.parent,s.root);
      if(mode==='replace-after') {assert.equal(s.self,true);assert.notEqual(s.root.exports,s.before);}
      const proto=Object.getPrototypeOf(s.before);
      return {loaded:s.root.loaded,partialSeen:s.seen===s.partial,
        plainPrototype:proto===Object.prototype,
        prototypeKeys:Reflect.ownKeys(proto).map(String).sort(),
        dependencyLoaded:dep.loaded, replacement: s.root.exports!==s.before};
    }
    assert.deepEqual(await run(false),await run(true));
  });
}

test('custom extension and existing cache identity survive success and evaluation failures', async t => {
  const f=await setup(t), original=require.extensions['.js'];
  await f.write(`module.exports=${registry('old')};`);
  const external=require(f.file),cached=require.cache[f.file],calls=[];
  function hook(m,file) { assert.equal(this,require.extensions); calls.push(file); return original.call(this,m,file); }
  await f.dep("module.exports=7;");
  require.extensions['.js']=hook;
  try {
    for(const [source,expected] of [
      [`require('./back');module.exports=${registry('fresh')};`,'fresh'],
      ["require('./back');throw Error('acceptance throw');",undefined],
      ["module.exports={",undefined],
      ["require('./missing-acceptance');",undefined],
      [`module.exports=${registry('recovered')};`,'recovered']]) {
      await f.write(source);
      assert.equal(label(await f.reader.snapshot()),expected);
      assert.equal(require.extensions['.js'],hook);
      assert.equal(require.cache[f.file],cached);
      assert.equal(require(f.file),external);
    }
    assert.deepEqual(calls,[path.join(f.root,'lib/back.js')],'dependency loader runs once; registry uses bounded source');
  } finally {require.extensions['.js']=original;}
});

test('fixed cached dependency graph does not accumulate retired registry modules',async t=>{
  const f=await setup(t),depPath=path.join(f.root,'lib/back.js');
  await f.dep("exports.registry=require('./apps');exports.parent=module.parent;");
  let first,retainedFirst;
  function retained() {
    const seen=new Set(),pending=[require.cache[depPath]];
    while(pending.length) {
      const m=pending.pop();if(!m||seen.has(m))continue;seen.add(m);
      pending.push(m.parent,...m.children);
    }
    return [...seen].filter(m=>m.filename===f.file);
  }
  for(let i=0;i<96;i++) {
    await f.write(`Object.assign(exports,${registry('round-'+i)});require('./back');`);
    assert.equal(label(await f.reader.snapshot()),'round-'+i);
    const dep=require.cache[depPath];
    if(i===0) {first=dep;retainedFirst=retained();assert.equal(retainedFirst.length,1);}
    assert.equal(dep,first);assert.deepEqual(retained(),retainedFirst);
    assert.equal(require.cache[f.file],undefined);
    assert.equal(readerModule.children.filter(m=>m.filename===f.file).length,0);
  }
  t.diagnostic('96 refreshes, fixed one-dependency graph: one stable first registry retained; zero reader-owned registries. No transitive-zero or RSS claim.');
});

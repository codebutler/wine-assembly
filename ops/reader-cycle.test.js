'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const readerPath = process.env.READER_UNDER_TEST || './readers';
const {createReader} = require(readerPath);
const owner = require.cache[require.resolve(readerPath)];
const name = state => state.candidates.find(c => c.id === 'probe')?.name;
const exportsSource = label => `({APPS:{probe:{exe:'p.exe'}},DESKTOP_APPS:[['probe',${JSON.stringify(label)}]]})`;
async function fixture(t) {
  const jsLoader = require.extensions['.js'];
  t.after(() => assert.equal(require.extensions['.js'], jsLoader, 'restore JS loader on success and failure'));
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-cycle-'));
  await fs.mkdir(path.join(root, 'lib/nested'), {recursive:true});
  // Launch catalog caching is a separate, intentional external consumer.
  // Isolate it to measure only the inventory loader's cache restoration.
  const emulatorRoot = path.join(root, 'emulator');
  await fs.mkdir(emulatorRoot);
  const file = path.join(root, 'lib/apps.js');
  t.after(async () => {
    for (const [id, m] of Object.entries(require.cache)) {
      if (id.startsWith(root + path.sep)) delete require.cache[id];
      else m.children = m.children.filter(c => !c.filename?.startsWith(root + path.sep));
    }
    await fs.rm(root, {recursive:true, force:true});
  });
  return {root, file, reader:createReader({root,emulatorRoot,codexRoot:false,claudeRoot:false,processes:false}),
    write:source => fs.writeFile(file, source),
    dep:(name, source) => fs.writeFile(path.join(root, 'lib/nested', name + '.js'), source)};
}

test('nested cycles preserve in-progress identity, loaded flags and ordinary dependency cache', async t => {
  const f = await fixture(t);
  await f.dep('a', "exports.before=true;const b=require('./b');if(b.a!==exports)throw Error('nested a identity');module.exports=b;");
  await f.dep('b', "const a=require('./a');const apps=require('../apps');if(require.cache[require.resolve('../apps')].loaded)throw Error('prematurely loaded');module.exports={a,apps};");
  await f.write(`Object.assign(exports,${exportsSource('nested 漢😀')});if(require('./nested/a').apps!==module.exports)throw Error('registry identity');`);
  assert.equal(name(await f.reader.snapshot()), 'nested 漢😀');
  const a = require.cache[path.join(f.root,'lib/nested/a.js')];
  assert.equal(a.parent.loaded, true);
  assert.equal(Object.getPrototypeOf(a.parent.exports), Object.prototype, 'native circular-warning proxy is removed');
  assert.equal(require.cache[f.file], undefined);
  // Dependencies deliberately stay cached. Their first parent/exports remain
  // the first registry; subsequent registry revisions themselves are fresh.
  for (let i=0; i<12; i++) {
    await f.write(`module.exports=${exportsSource('revision-'+i)};require('./nested/a');`);
    assert.equal(name(await f.reader.snapshot()), 'revision-'+i);
    assert.equal(require.cache[path.join(f.root,'lib/nested/a.js')], a);
  }
  assert.equal(owner.children.filter(m => m.filename === f.file).length, 0);
});

test('cycles see replacement exports before reentry and current exports after replacement', async t => {
  const f = await fixture(t);
  await f.dep('back', "module.exports=require('../apps');");
  await f.write(`module.exports=${exportsSource('before')};if(require('./nested/back')!==module.exports)throw Error('replacement before');`);
  assert.equal(name(await f.reader.snapshot()), 'before');
  delete require.cache[path.join(f.root,'lib/nested/back.js')];
  await f.write(`const partial=exports;exports.marker='partial';if(require('./nested/back')!==partial)throw Error('partial lost');module.exports=${exportsSource('after')};if(require('./apps')!==module.exports)throw Error('replacement after');if(require('./nested/back')!==partial)throw Error('cached partial changed');`);
  assert.equal(name(await f.reader.snapshot()), 'after');
  assert.equal(require.cache[f.file], undefined);
});

for (const external of [false, true]) test(`nested cyclic errors restore ${external ? 'external cache identity' : 'absent cache'} and recover fresh state`, async t => {
  const f = await fixture(t);
  await f.write(`module.exports=${exportsSource('external')};`);
  const old = external ? require(f.file) : undefined;
  const cached = require.cache[f.file];
  await f.dep('fail', "const apps=require('../apps');if(apps.marker!=='in progress')throw Error('wrong partial');throw Error('nested cyclic failure');");
  for (let i=0; i<12; i++) {
    await f.write(`exports.marker='in progress';exports.APPS={probe:{exe:'p.exe'}};require('./nested/fail');`);
    const state = await f.reader.snapshot();
    assert.equal(name(state), undefined);
    assert.ok(state.warnings.some(w => /App registry: nested cyclic failure/.test(w)));
    assert.equal(require.cache[f.file], cached);
    assert.equal(require.cache[path.join(f.root,'lib/nested/fail.js')], undefined);
  }
  await f.write(`module.exports=${exportsSource('recovered')};`);
  assert.equal(name(await f.reader.snapshot()), 'recovered');
  assert.equal(require.cache[f.file], cached);
  if (external) assert.equal(require(f.file), old);
  assert.equal(owner.children.filter(m => m.filename === f.file).length, 0);
});

test('awaiting a bounded source read never exposes temporary registry state to another consumer', async t => {
  const f = await fixture(t);
  await f.write(`module.exports=${exportsSource('external')};`);
  const old = require(f.file), cached = require.cache[f.file];
  const jsLoader = require.extensions['.js'];
  await f.write(`module.exports=${exportsSource('fresh')};`);
  const open = fs.open.bind(fs);
  let observations=0;
  t.mock.method(fs, 'open', async (...args) => {
    const h = await open(...args);
    if (args[0] === f.file) {
      const read = h.read.bind(h);
      h.read = async (...readArgs) => {
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(require.cache[f.file], cached);
        assert.equal(require.extensions['.js'], jsLoader);
        assert.equal(require(f.file), old);
        observations++;
        return read(...readArgs);
      };
    }
    return h;
  });
  const states = await Promise.all([f.reader.snapshot(),f.reader.snapshot()]);
  assert.deepEqual(states.map(name), ['fresh','fresh']);
  assert.equal(observations, 2);
  assert.equal(require.cache[f.file], cached);
});

test('preexisting extension hook receives ordinary dependencies and is restored after cyclic throw', async t => {
  const f = await fixture(t);
  const original = require.extensions['.js'];
  const calls = [];
  function custom(loaded, filename) {
    assert.equal(this, require.extensions);
    calls.push(filename);
    return original.call(this, loaded, filename);
  }
  await f.dep('back', "module.exports=require('../apps');");
  require.extensions['.js'] = custom;
  try {
    await f.write(`Object.assign(exports,${exportsSource('hook')});if(require('./nested/back')!==exports)throw Error('cycle');`);
    assert.equal(name(await f.reader.snapshot()), 'hook');
    assert.deepEqual(calls, [path.join(f.root,'lib/nested/back.js')]);
    assert.equal(require.extensions['.js'], custom);
    await f.write("throw Error('hook failure');");
    const state = await f.reader.snapshot();
    assert.equal(name(state), undefined);
    assert.ok(state.warnings.some(w => /App registry: hook failure/.test(w)));
    assert.equal(require.extensions['.js'], custom);
    assert.equal(require.cache[f.file], undefined);
  } finally { require.extensions['.js'] = original; }
});

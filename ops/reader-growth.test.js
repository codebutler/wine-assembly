'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createReader} = require('./readers');

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'reader-growth-'));
  t.after(() => fs.rm(root, {recursive:true, force:true}));
  await fs.mkdir(path.join(root, 'lib'));
  return root;
}
const reader = root => createReader({root, codexRoot:false, claudeRoot:false, processes:false});
const registry = (version, padding = 8192) => `module.exports={APPS:{},DESKTOP_APPS:[],version:${version},padding:${JSON.stringify('x'.repeat(padding))}};`;

test('registry refresh does not retain retired modules or exported bytes', async t => {
  const root = await fixture(t), file = path.join(root, 'lib/apps.js');
  const r = reader(root), owner = require.cache[require.resolve('./readers')];
  for (let i = 0; i < 48; i++) {
    await fs.writeFile(file, registry(i));
    await r.snapshot();
  }
  const retained = owner.children.filter(m => m.filename === file);
  const bytes = retained.reduce((n,m) => n + Buffer.byteLength(JSON.stringify(m.exports)), 0);
  t.diagnostic(`retired registry modules=${retained.length}; retained export bytes=${bytes}`);
  assert.ok(retained.length <= 1, `retained ${retained.length} registry modules after 48 refreshes`);
  assert.ok(bytes <= 16*1024, `retained ${bytes} exported bytes`);
});

test('registry remains fresh without disturbing another consumer of the CommonJS cache', async t => {
  const root = await fixture(t), file = path.join(root, 'lib/apps.js');
  await fs.writeFile(file, registry(0));
  const other = require(file), cached = require.cache[file];
  t.after(() => { delete require.cache[file]; module.children = module.children.filter(m => m.filename !== file); });
  await fs.writeFile(file, "module.exports={APPS:{fresh:{exe:'fresh.exe'}},DESKTOP_APPS:[['fresh','Fresh Unicode 漢😀']]};");
  const state = await reader(root).snapshot();
  assert.equal(state.candidates.find(c => c.id === 'fresh')?.name, 'Fresh Unicode 漢😀');
  assert.ok(require.cache[file] === cached, 'another consumer retains its cached module');
  assert.ok(require(file) === other, 'another consumer retains its cached exports');
});

test('isolated registry preserves CommonJS paths and bounds source bytes, including growth after stat', async t => {
  const root = await fixture(t), file = path.join(root, 'lib/apps.js');
  await fs.writeFile(path.join(root, 'lib/label.js'), "module.exports='Relative 漢😀';");
  const source = "module.exports={APPS:{relative:{exe:'relative.exe'}},DESKTOP_APPS:[['relative',require('./label')]]};";
  await fs.writeFile(file, source);
  const r = reader(root), open = fs.open.bind(fs);
  let requested = 0;
  t.mock.method(fs, 'open', async (...args) => {
    const h = await open(...args);
    if (args[0] === file) {
      const stat = h.stat.bind(h), read = h.read.bind(h);
      h.stat = async () => { const s = await stat(); await fs.appendFile(file, '\n//'+ 'x'.repeat(32768)); return s; };
      h.read = async (b,o,n,p) => { requested = Math.max(requested,p+n); return read(b,o,Math.min(n,17),p); };
    }
    return h;
  });
  const state = await r.snapshot();
  assert.equal(state.candidates.find(c => c.id === 'relative')?.name, 'Relative 漢😀');
  assert.equal(requested, Buffer.byteLength(source));
  await fs.writeFile(file, '//'+ 'x'.repeat(2*1024*1024));
  const oversized = await r.snapshot();
  assert.ok(oversized.warnings.some(w => /App registry: file exceeds 2 MiB read limit/.test(w)));
  await fs.writeFile(file, 'throw new Error("registry failure");');
  assert.ok((await r.snapshot()).warnings.some(w => /registry failure/.test(w)));
  await fs.writeFile(file, source);
  assert.ok((await r.snapshot()).candidates.some(c => c.id === 'relative'));
});

test('growing discovery, rotating histories and replaced assets leave bounded current views', async t => {
  const root = await fixture(t), logs = path.join(root, 'logs'), run = path.join(root, 'scratch/runs/current');
  await fs.mkdir(logs); await fs.mkdir(run, {recursive:true});
  const record = id => JSON.stringify({type:'assistant',cwd:root,sessionId:id,timestamp:'2026-10-25T12:00:00Z',message:{content:[{type:'text',text:'summary 漢😀'}]}})+'\n';
  for (let i = 0; i < 105; i++) await fs.writeFile(path.join(logs, `${i}.jsonl`), record(String(i)));
  const r = createReader({root, claudeRoot:logs, codexRoot:false, processes:false});
  const now = Date.now(); let tick = now;
  t.mock.method(Date, 'now', () => tick);
  let priorKey;
  for (let i = 0; i < 8; i++) {
    tick += 31000;
    const file = path.join(logs, '104.jsonl');
    await fs.writeFile(file+'.new', record('rotated-'+i)); await fs.rename(file+'.new', file);
    await fs.appendFile(file, record('rotated-'+i));
    await fs.writeFile(path.join(logs, `added-${i}.jsonl`), record('added-'+i));
    const name = `asset-${i}.txt`; await fs.writeFile(path.join(run, name), 'evidence');
    await fs.writeFile(path.join(run, 'result.json'), JSON.stringify({candidateId:'synthetic',startedAt:'2026-10-25T12:00:00Z',outcome:'passed',artifacts:[name]}));
    const state = await r.snapshot();
    assert.equal(state.agents.length, 40);
    assert.ok(Buffer.byteLength(JSON.stringify(state.agents)) < 64*1024);
    assert.equal(state.runs.length, 1); assert.equal(state.runs[0].artifacts.length, 2);
    if (priorKey) assert.equal(await r.artifact(priorKey), null);
    priorKey = 'scratch/runs/current/'+name;
    assert.equal(await r.artifact(priorKey), path.join(run, name));
  }
});

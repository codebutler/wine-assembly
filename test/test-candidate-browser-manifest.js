const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { createRequire } = require('module');

const root = path.resolve(__dirname, '..');
const script = path.join(root, 'tools/fetch-candidate-corpus.js');
const source = fs.readFileSync(script, 'utf8').split('\n(async () => {')[0];
const realRequire = createRequire(script);
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-browser-manifest-'));
const destination = path.join(dir, 'sample');
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname,
  'candidate-corpus/baldurs-gate2-demo-files.json'), 'utf8'));
const candidate = { id: 'sample', packages: [{}], browser: {
  fileRoot: '.', exe: 'BGMain.exe', defaultLoadMode: 'lazy',
} };
function put(name, bytes) {
  const target = path.join(destination, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}
function context(args) {
  return vm.createContext({ Buffer, URL, __dirname: path.dirname(script),
    process: { argv: ['node', script, ...args] }, console,
    require(name) {
      if (name === 'fs') return { ...fs, readFileSync(file, ...rest) {
        if (file === path.join(root, 'test/candidate-corpus/manifest.json'))
          return JSON.stringify({ assetRoot: dir });
        return fs.readFileSync(file, ...rest);
      } };
      if (name === 'http' || name === 'https')
        return new Proxy({}, { get() { throw Error('Unexpected network operation'); } });
      if (name === 'child_process')
        return { spawnSync() { throw Error('Unexpected child process'); } };
      return realRequire(name);
    }, candidate, destination });
}

(async () => {
  try {
    // Real inventory paths, tiny synthetic content: no retail bytes or downloads.
    for (const file of inventory.files) put(file.path, file.path);
    const contexts = [context(['--prepare']), context([])];
    for (const ctx of contexts) {
      vm.runInContext(source, ctx, { filename: script });
    }
    const read = () => JSON.parse(fs.readFileSync(path.join(destination, '.wine-assembly-browser.json')));
    await vm.runInContext('fetchCandidate(candidate)', contexts[0]);
    assert.equal(read().files.length, 644);
    put('.candidate-source.json', '{"synthetic":true}\n');
    put('.wine-assembly-file-metadata.json', JSON.stringify({ 'baldur.ini': { lastWriteTime: 12345 } }));
    const expected = new Map(inventory.files.map(file => [file.path, file.path]));
    for (const name of ['save/slot1.sav', '.game-config', 'save/.candidate-source.json',
      'save/.wine-assembly-browser.json', 'save/.wine-assembly-file-metadata.json']) {
      put(name, 'preserved ' + name);
      expected.set(name, 'preserved ' + name);
    }
    let previous;
    for (const ctx of [contexts[0], contexts[1], contexts[0], contexts[1]]) {
      await vm.runInContext('fetchCandidate(candidate)', ctx);
      const manifest = read();
      assert.deepEqual(manifest.files.map(file => file.url).sort(),
        [...expected.keys()].filter(name => name !== 'BGMain.exe').sort());
      assert.equal(manifest.files.find(file => file.url === 'baldur.ini').lastWriteTime, 12345);
      if (previous) assert.deepEqual(manifest, previous, 'prepare/keep must be idempotent');
      previous = manifest;
      for (const [name, bytes] of expected)
        assert.equal(fs.readFileSync(path.join(destination, name), 'utf8'), bytes);
      assert.equal(fs.readFileSync(path.join(destination, '.candidate-source.json'), 'utf8'), '{"synthetic":true}\n');
    }
    // A nested browser root must retain identically named guest files too.
    candidate.browser = { fileRoot: 'save', exe: 'BGMain.exe' };
    vm.runInContext('writeBrowserManifest(candidate, destination)', contexts[0]);
    assert.equal(read().files.length, 4);
    console.log('PASS candidate manifest: 645 inventory paths, stable prepare/keep, host sidecars excluded, saves preserved');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

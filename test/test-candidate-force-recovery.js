const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const { createRequire } = require('module');
const root = path.resolve(__dirname, '..');
const sourceFile = path.join(root, 'tools/fetch-candidate-corpus.js');
const source = fs.readFileSync(sourceFile, 'utf8').split('\n(async () => {')[0];
const realRequire = createRequire(path.join(root, 'tools/fetch-candidate-corpus.js'));
const bytes = Buffer.from('local synthetic replacement package');
const sha1 = crypto.createHash('sha1').update(bytes).digest('hex');
function snapshot(dir) {
  const result = {};
  function walk(at, prefix = '') {
    for (const item of fs.readdirSync(at, { withFileTypes: true })) {
      const name = prefix + item.name;
      if (item.isDirectory()) walk(path.join(at, item.name), name + '/');
      else result[name] = fs.readFileSync(path.join(at, item.name)).toString('hex');
    }
  }
  walk(dir);
  return result;
}
async function run(mode) {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'wa-recovery-test-'));
  const assets = path.join(dir, 'assets');
  const dest = path.join(assets, 'sample');
  fs.mkdirSync(dest, { recursive: true });
  fs.writeFileSync(path.join(dest, 'old.exe'), 'usable old executable');
  fs.writeFileSync(path.join(dest, '.candidate-source.json'), '{"old":true}\n');
  fs.writeFileSync(path.join(dest, '.wine-assembly-browser.json'), '{"stale":true}\n');
  const old = snapshot(dest);
  const logs = [];
  let requests = 0;
  let extracts = 0;
  let publicationAttempted = false;
  let oldPreservedDuringWork = true;
  const candidate = { id: 'sample', name: 'Synthetic local fixture', version: 'new', packages: [
    { url: 'https://fixture.invalid/package', sha1, type: 'archive', into: 'game' },
  ], browser: { fileRoot: 'game', exe: 'game/new.exe' } };
  const facade = { ...fs,
    readFileSync(file, ...args) {
      if (file === path.join(root, 'test/candidate-corpus/manifest.json')) return JSON.stringify({ assetRoot: assets });
      return fs.readFileSync(file, ...args);
    },
    renameSync(from, to) {
      if (to === dest && path.basename(from) === 'fixture') {
        publicationAttempted = true;
        const receipt = JSON.parse(fs.readFileSync(path.join(from, '.candidate-source.json')));
        assert.equal(receipt.packages[0].sha1, sha1);
        assert.equal(fs.readFileSync(path.join(from, 'game/new.exe'), 'utf8'), 'new executable');
        if (mode.startsWith('publish-fail')) throw Error('injected publication failure');
      }
      if (mode === 'publish-fail-rollback' && to === dest && path.basename(from) === 'previous') throw Error('injected rollback failure');
      return fs.renameSync(from, to);
    },
  };
  const transport = { get(url, options, callback) {
    requests++;
    oldPreservedDuringWork &&= JSON.stringify(snapshot(dest)) === JSON.stringify(old);
    const request = new EventEmitter();
    process.nextTick(() => {
      const response = Readable.from([mode === 'hash' ? Buffer.from('wrong bytes') : bytes]);
      response.statusCode = mode === 'acquisition' ? 404 : 200;
      response.headers = {};
      callback(response);
    });
    return request;
  } };
  const context = vm.createContext({ Buffer, URL, setTimeout, __dirname: path.join(root, 'tools'),
    process: { argv: ['node', sourceFile, '--force'] },
    console: { log: (...args) => logs.push(args.join(' ')), error: (...args) => logs.push(args.join(' ')) },
    fetch: () => { throw Error('Unexpected live fetch'); },
    require(name) {
      if (name === 'fs') return facade;
      if (name === 'http' || name === 'https') return transport;
      if (name === 'os') return { tmpdir: () => dir };
      if (name === 'child_process') return { spawnSync(command, args) {
        extracts++;
        oldPreservedDuringWork &&= JSON.stringify(snapshot(dest)) === JSON.stringify(old);
        assert.ok(['7z', 'unar'].includes(command));
        const output = command === '7z' ? args.find(a => a.startsWith('-o')).slice(2) : args[args.indexOf('-o') + 1];
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, 'new.exe'), 'new executable');
        // A partial extraction must never get published, even with emitted files.
        if (mode === 'extraction') return { status: 2, stderr: 'synthetic corrupt archive' };
        if (mode === 'browser') fs.unlinkSync(path.join(output, 'new.exe'));
        return { status: 0 };
      } };
      return realRequire(name);
    },
  });
  try {
    vm.runInContext(source + '\nthis.run = fetchCandidate;', context, { filename: sourceFile });
    const result = await context.run(candidate);
    assert.equal(oldPreservedDuringWork, true, 'old fixture remains intact during acquisition and extraction');
    assert.equal(requests, 1);
    if (mode === 'success') {
      assert.equal(result.fetched, 1);
      assert.equal(publicationAttempted, true);
      assert.deepEqual(Object.keys(snapshot(dest)).sort(), ['.candidate-source.json', '.wine-assembly-browser.json', 'game/new.exe']);
      const receipt = JSON.parse(fs.readFileSync(path.join(dest, '.candidate-source.json')));
      assert.equal(receipt.version, 'new');
      assert.equal(receipt.old, undefined);
      assert.equal(receipt.packages[0].sha1, sha1);
      const browser = JSON.parse(fs.readFileSync(path.join(dest, '.wine-assembly-browser.json')));
      assert.equal(browser.stale, undefined);
      assert.equal(browser.schemaVersion, 1);
    } else {
      assert.equal(result.failed, 1);
      if (mode === 'publish-fail-rollback') {
        assert.equal(fs.existsSync(dest), false);
        const retained = fs.readdirSync(assets);
        assert.equal(retained.length, 1);
        const backup = path.join(assets, retained[0], 'previous');
        assert.deepEqual(snapshot(backup), old);
        assert.ok(logs.some(line => line.includes('previous fixture retained at ' + backup)));
      } else assert.deepEqual(snapshot(dest), old, 'failure preserves all old bytes and sidecars');
      if (mode === 'hash' || mode === 'acquisition') assert.equal(extracts, 0);
    }
    if (mode !== 'publish-fail-rollback') assert.deepEqual(fs.readdirSync(assets), ['sample'], 'no abandoned staging/backup');
    assert.deepEqual(fs.readdirSync(dir), ['assets'], 'download temporary cleaned');
    console.log('PASS ' + mode);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
const evidence = { sourceFile, node: process.version, passed: [] };
(async () => {
  for (const mode of ['acquisition', 'hash', 'extraction', 'browser', 'success', 'publish-fail', 'publish-fail-rollback']) {
    await run(mode);
    evidence.passed.push(mode);
  }
})().catch(error => {
  evidence.error = error.stack;
  console.error(error);
  process.exitCode = 1;
});

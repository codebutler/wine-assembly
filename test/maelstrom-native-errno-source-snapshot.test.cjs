'use strict';
// Source strings only: no compilation, WebAssembly, or guest execution.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs'), path = require('node:path');
const hook = require('../tools/maelstrom-native-errno-latch.cjs');
const sources = Object.fromEntries(Object.keys(hook.PINS).map(p =>
  [p, fs.readFileSync(path.join(process.env.MNE_SOURCE_ROOT, p), 'utf8')]));
const options = { enabled: true, crtLoadedBase: 0x522000, binaries: {
  net: fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT, 'SDL_net.dll')),
  exe: fs.readFileSync(path.join(process.env.MNE_ORIGINAL_ROOT, 'Maelstrom.exe')),
  crt: fs.readFileSync(process.env.MNE_CRT),
} };
const expected = hook.transform(sources, options);
const key = 'src/07-decoder.wat', altered = sources[key] + '\n;; unpinned\n';
let groups = 0;
function test(name, f) { f(); groups++; console.log('PASS source snapshot: ' + name); }

test('a third-read substitution cannot reach output after pinned validation', () => {
  let reads = 0;
  const varying = { ...sources };
  Object.defineProperty(varying, key, { enumerable: true,
    get() { return ++reads <= 2 ? sources[key] : altered; } });
  const result = hook.transform(varying, options);
  assert.equal(createHash('sha256').update(result[key]).digest('hex'), hook.PINS[key]);
  assert.equal(reads, 1);
});
test('each pinned value is read once and that exact string reaches output', () => {
  // Every path, including paths composed through the select transform.
  for (const p of Object.keys(hook.PINS)) {
    let reads = 0;
    const varying = { ...sources };
    Object.defineProperty(varying, p, { enumerable: true,
      get() { return ++reads === 1 ? sources[p] : sources[p] + '\n;; unpinned\n'; } });
    assert.deepEqual(hook.transform(varying, options), expected, p);
    assert.equal(reads, 1, p + ' read count');
  }
});
test('an unpinned first value rejects even if subsequent reads would be pinned', () => {
  let reads = 0;
  const varying = { ...sources };
  Object.defineProperty(varying, key, { get() { return ++reads === 1 ? altered : sources[key]; } });
  assert.throws(() => hook.transform(varying, options), /source pin/);
  assert.equal(reads, 1);
});
test('inherited accessors and proxy reads obey the same snapshot contract', () => {
  let reads = 0;
  const inherited = Object.create(Object.defineProperty({}, key, {
    get() { return ++reads === 1 ? sources[key] : altered; },
  }));
  for (const p of Object.keys(sources)) if (p !== key) inherited[p] = sources[p];
  assert.deepEqual(hook.transform(inherited, options), expected);
  assert.equal(reads, 1);
  const counts = new Map();
  const proxy = new Proxy(sources, { get(target, p) {
    const n = (counts.get(p) || 0) + 1; counts.set(p, n);
    assert(Object.hasOwn(target, p), 'only canonical pinned paths are read');
    return n === 1 ? target[p] : target[p] + '\n;; unpinned\n';
  }, ownKeys() { throw Error('unused enumeration'); } });
  assert.deepEqual(hook.transform(proxy, options), expected);
  assert.deepEqual([...counts.values()], Object.keys(sources).map(() => 1));
});
test('later getter mutation cannot replace an earlier captured source', () => {
  const [first, second] = Object.keys(sources), varying = { ...sources };
  Object.defineProperty(varying, second, { get() {
    varying[first] = sources[first] + '\n;; changed after capture\n';
    return sources[second];
  } });
  assert.deepEqual(hook.transform(varying, options), expected);
});
test('disabled transform returns input without touching sources or unused options', () => {
  const unused = new Proxy({}, { get() { throw Error('unused source read'); },
    ownKeys() { throw Error('unused source enumeration'); } });
  for (const enabled of [false, undefined, 0]) {
    const inertOptions = new Proxy({ enabled }, { get(target, p) {
      assert.equal(p, 'enabled', 'unused option read'); return target[p];
    }, ownKeys() { throw Error('unused option enumeration'); } });
    assert.equal(hook.transform(unused, inertOptions), unused);
  }
});
console.log(`${groups} source snapshot groups passed; native errno/caller/gameplay UNKNOWN`);

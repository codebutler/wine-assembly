#!/usr/bin/env node

// Regression: the generic candidate-corpus CLI launches the Silver demo's
// dual-drive layout, exactly as pinned by docs/re-notes/silver-demo.md, and
// refuses invalid or missing media instead of launching an incomplete
// configuration. No WebAssembly build, no fixture walk: mount media is
// simulated through the exists injection, so this stays a launch-contract test.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildLaunchArgs, fixtureId } = require('../lib/candidate-cli');

const manifest = JSON.parse(fs.readFileSync(
  path.join(__dirname, 'candidate-corpus', 'manifest.json'), 'utf8'));
const runPath = path.join(__dirname, 'run.js');

const BASE = [
  runPath,
  '--exe=EXE',
  '--wasm=W',
  '--no-build',
  '--no-close',
  '--quiet-api',
  '--quiet-blocks',
  '--stuck-after=50',
  '--max-batches=80',
  '--batch-size=10000',
];

function launchWith(candidate, options = {}) {
  return buildLaunchArgs(candidate, {
    runPath,
    executable: options.executable || 'EXE',
    wasmPath: 'wasmPath' in options ? options.wasmPath : 'W',
    fixtureRoot: options.fixtureRoot || '/fixture',
    exists: options.exists || (() => true),
    isDirectory: () => true,
  });
}

let checked = 0;
function check(label, fn) {
  fn();
  checked++;
  console.log(`PASS ${label}`);
}

check('silver-demo manifest keeps the documented dual mount', () => {
  const candidate = manifest.candidates.find(entry => entry.id === 'silver-demo');
  assert(candidate, 'silver-demo stays a manifest candidate');
  assert.deepStrictEqual(candidate.cli.vfsTrees, ['game'],
    'the complete game/ tree is mirrored at C:\\ (game/SILVER -> C:/SILVER)');
  assert.deepStrictEqual(candidate.cli.zipMounts,
    [{ file: 'source/SilverDemo.zip', root: 'D:/SILVER/' }],
    'the unchanged original ZIP is the only D:-side media');
  assert.strictEqual(candidate.cli.cwd, 'C:/SILVER',
    'the working directory is the installed tree');
  assert.strictEqual(candidate.cli.exeGuestPath, 'C:/SILVER/silver.exe');
  assert.deepStrictEqual(candidate.packages.map(pkg => pkg.destination),
    ['source/SilverDemo.zip'],
    'the mount and the acquired package stay the same original bytes');
});

check('silver-demo generates the dual-drive launch arguments', () => {
  const candidate = manifest.candidates.find(entry => entry.id === 'silver-demo');
  const args = launchWith(candidate);
  assert.deepStrictEqual(args.slice(0, BASE.length), BASE,
    'generic base flags stay first and unchanged');
  assert.deepStrictEqual(args.slice(BASE.length), [
    '--exe-guest-path=C:\\SILVER\\silver.exe',
    '--cwd=C:\\SILVER\\',
    '--vfs-tree=/fixture/game',
    '--zip-root=D:\\SILVER\\',
    '--zip=/fixture/source/SilverDemo.zip',
  ]);
});

check('missing original zip media is refused, not launched', () => {
  const candidate = manifest.candidates.find(entry => entry.id === 'silver-demo');
  try {
    launchWith(candidate, { exists: p => !/SilverDemo\.zip$/.test(p) });
    assert.fail('missing zip must raise');
  } catch (error) {
    assert.strictEqual(error.media, 'source/SilverDemo.zip');
    assert(/zipMounts media is not present/.test(error.message), error.message);
  }
});

check('missing install tree media is refused, not launched', () => {
  const candidate = manifest.candidates.find(entry => entry.id === 'silver-demo');
  try {
    launchWith(candidate, { exists: p => p !== '/fixture/game' });
    assert.fail('missing tree must raise');
  } catch (error) {
    assert.strictEqual(error.media, 'game');
    assert(/vfsTrees media is not present/.test(error.message), error.message);
  }
});

check('malformed media entries are schema rejections', () => {
  const id = 'malformed';
  const base = {
    exeGuestPath: 'C:/SILVER/silver.exe',
    cwd: 'C:/SILVER',
    vfsTrees: ['game'],
    zipMounts: [{ file: 'source/SilverDemo.zip', root: 'D:/SILVER/' }],
  };
  const cases = [
    ['trailing separator', { ...base, zipMounts: [{ file: 'x.zip', root: 'D:/SILVER' }] }],
    ['fixture traversal', { ...base, zipMounts: [{ file: '../ escape.zip', root: 'D:/SILVER/' }] }],
    ['relative guest drive', { ...base, cwd: 'SILVER' }],
    ['bare guest file', { ...base, exeGuestPath: 'C:/SILVER/' }],
    ['empty tree array', { ...base, vfsTrees: [] }],
  ];
  for (const [label, cli] of cases) {
    try {
      launchWith({ id, cli });
      assert.fail(`${label} must raise`);
    } catch (error) {
      assert(/^malformed\.cli\./.test(error.message), `${label}: ${error.message}`);
    }
  }
});

check('overlapping zip roots are rejected', () => {
  const cli = {
    zipMounts: [
      { file: 'a.zip', root: 'D:/SILVER/' },
      { file: 'b.zip', root: 'D:/SILVER/LEVELS/' },
    ],
  };
  try {
    launchWith({ id: 'overlap', cli });
    assert.fail('overlap must raise');
  } catch (error) {
    assert(/supports exactly one mount/.test(error.message), error.message);
  }
});

check('spawned argv keeps --wasm at the original position', () => {
  // test-cli-candidate-corpus.js splices --wasm at index 2, exactly where the
  // previous inline builder placed it: run, exe, wasm, no-build...
  const candidate = manifest.candidates.find(entry => entry.id === 'silver-demo');
  const dry = launchWith(candidate, { wasmPath: null });
  dry.splice(2, 0, '--wasm=SNAPSHOT');
  assert.deepStrictEqual(dry.slice(0, 5),
    [runPath, '--exe=EXE', '--wasm=SNAPSHOT', '--no-build', '--no-close']);
});

check('older cli contracts launch unchanged', () => {
  const civMge = manifest.candidates.find(entry => entry.id === 'civilization-2-mge-win32');
  assert.deepStrictEqual(civMge.cli.dlls, ['installed/XDaemon.dll']);
  const args = launchWith(civMge);
  assert(args.includes(`--dll-seed=/fixture/installed/XDaemon.dll`),
    'MGE still preloads XDaemon.dll beside the fixture');
  assert(!args.some(arg => arg.startsWith('--zip-root=')),
    'single-directory candidates never gain a second mount');

  const civWin16 = manifest.candidates.find(entry => entry.id === 'civilization-2-win16');
  const win16Args = launchWith(civWin16);
  assert(win16Args.includes(`--cue=/fixture/${civWin16.cli.cue}`),
    'the mixed-mode CUE mount stays a --cue argument');
  assert(win16Args.includes('--vfs-include=**/*'));

  const chapters = manifest.candidates.find(
    entry => entry.id === 'baldurs-gate-chapters-1-2-demo');
  assert.strictEqual(fixtureId(chapters), chapters.id);
});

console.log(`candidate-cli silver launch contract: ${checked} checks`);

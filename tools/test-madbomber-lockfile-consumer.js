'use strict';
// Read-only plan validation; does not launch the guest or instantiate wasm.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { argv } = require('./run-madbomber-lockfile-consumer');
const root = path.resolve(__dirname, '..');
const oldRun = '/home/user/wine-assembly/scratch/runs/20261019-madbomber-dbcs-retry';
const manifest = JSON.parse(fs.readFileSync(path.join(oldRun, 'launch-manifest.json')));
const old = JSON.parse(fs.readFileSync(path.join(oldRun, 'launch.json'))).args;
const args = argv('/tmp/madbomber-plan-validation');
assert.equal(args[0], 'test/run.js');
const mounts = list => list.filter(a => a.startsWith('--vfs-mount='));
assert.equal(mounts(args).length, 140); assert.equal(manifest.files.length, 140);
assert.deepEqual(mounts(args), mounts(old));
const seeds = list => list.filter(a => a.startsWith('--dll-seed='));
assert.equal(seeds(args).length, seeds(old).length + 1);
assert.deepEqual(seeds(args).slice(0, -1), seeds(old));
for (const arg of ['--no-build', '--no-threads', '--real-ticks', '--real-calendar', '--tz=UTC',
  '--max-seconds=10', '--control-stdin', '--cwd=C:\\MADBOMBER', '--exe-guest-path=C:\\MADBOMBER\\madbomber.exe']) assert(args.includes(arg), arg);
assert(args.includes('--wasm=' + path.join(root, 'build/wine-assembly.wasm')));
assert(args.includes('--png=/tmp/madbomber-plan-validation/final.png'));
assert(!args.some(a => a.startsWith('--input=')));
assert(args.find(a => a.startsWith('--trace-api=')).endsWith(',LockFile,UnlockFile'));
const { SYSTEM_DATA_FILES } = require('../lib/process-boot');
for (const item of SYSTEM_DATA_FILES) assert(fs.existsSync(path.join(root, item.url)), item.url);
const fonts = require('../lib/font-substitutions');
for (const name of fonts.BUNDLED_BITMAP_FONTS) assert(fs.existsSync(path.join(root, 'fonts', name)), name);
for (const item of fonts.fontMounts(JSON.parse(fs.readFileSync(path.join(root, 'fonts/substitutions.json'))), { subset: true })) {
  assert(fs.existsSync(path.join(root, 'fonts', item.file)), item.file);
}
console.log('Mad Bomber consumer plan: PASS (140 original mounts, DLL seeds, CLI controls and static dependencies; no guest)');

#!/usr/bin/env node
'use strict';

// Run the pinned original Wise installer. Keep its log/VFS as evidence, and
// verify the completed payload before publishing a game tree (never a partial
// ~glh*.tmp archive). See docs/re-notes/thps2-demo.md.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const arg = name => process.argv.slice(2).find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const hash = (file, algorithm = 'sha256') => crypto.createHash(algorithm).update(fs.readFileSync(file)).digest('hex');
const PAYLOAD = {
  'anet.inf': '6be953d053748a5e258f11160f6518671bc5a9289bb208e18974c9e840ced4b4',
  'binkw32.dll': '1fd7ef7873c8a3be7e2f127b306d0d24d7d88e20cf9188894eff87b5af0d495f',
  'demo readme.rtf': 'ab128d620fa698df3426fc2850a1b3f334c248f9fed0bd18d85492eb29b70711',
  'demo.pkr': 'a68e9f3c2ee9a4e783185712561743c2a1325a007677d2d388cf646948f7b566',
  'ltix30.dat': 'a246aa248185faec1d71dcc751629c41e1d082284a21b490300fa71d794b86f2',
  'thawk2.exe': 'fe5b66dd0a14bf5f3e5b00aceeeda9e1da165c7274a83a22fd1cb106e03d4b26',
  'unwise.exe': '49ef36bd01b8ebf38c7b807a5fb44cbaf47c9d4efa883b01c41494c61ae4a2e2',
  'unwise.ini': '251b86129f00020616f194f13c3094a67b7412320c857b115e16189c1184134f',
};
function verify(directory) {
  for (const [name, expected] of Object.entries(PAYLOAD)) {
    assert.strictEqual(hash(path.join(directory, name)), expected, `incomplete or different payload: ${name}`);
  }
}
function main() {
  assert(arg('installer') && arg('output'), 'usage: node tools/install-thps2-demo.js --installer=thps2.exe --output=DIR');
  const installer = path.resolve(arg('installer'));
  const output = path.resolve(arg('output'));
  assert.strictEqual(hash(installer, 'sha1'), '8fbb8860ce20ca5c7c94a1ec93bd04738afc6699', 'installer differs from pinned THPS2 demo');
  if (fs.existsSync(output) && fs.readdirSync(output).length) {
    verify(output); // Reuse only a complete, verified tree; preserve any WIP.
    console.log(`KEEP verified THPS2 demo: ${output}`);
    return;
  }
  const runs = path.join(ROOT, 'scratch', 'runs');
  fs.mkdirSync(runs, { recursive: true });
  const run = fs.mkdtempSync(path.join(runs, 'thps2-install-'));
  const vfs = path.join(run, 'vfs');
  const log = fs.openSync(path.join(run, 'output.log'), 'wx');
  console.log(`Installing original THPS2 demo; evidence: ${run}`);
  let result;
  try {
    result = spawnSync(process.execPath, [path.join(ROOT, 'test/run.js'),
      `--exe=${installer}`, '--threads', '--max-batches=1000000', '--max-seconds=600',
      '--quiet-api', '--quiet-blocks', '--no-build',
      '--input=7000:click:368:383,16000:click:291:317,18000:click:368:383,20000:click:368:383,22000:click:368:383,24000:click:368:383,26000:click:368:383',
      `--png=${path.join(run, 'screen.png')}`, `--save-vfs=${vfs}`,
      `--reg-export=${path.join(run, 'registry.json')}`,
    ], { cwd: ROOT, stdio: ['ignore', log, log], timeout: 660000 });
  } finally { fs.closeSync(log); }
  if (result.error) throw result.error;
  assert.strictEqual(result.status, 0, `installer failed; inspect ${run}`);
  const text = fs.readFileSync(path.join(run, 'output.log'), 'utf8');
  assert(!/UNIMPLEMENTED API:|\*\*\* CRASH|RuntimeError:/i.test(text), `installer compatibility failure; inspect ${run}`);
  assert(text.includes('has been successfully installed'), `installer did not reach completion; inspect ${run}`);
  const installed = path.join(vfs, 'program files', 'activision', 'thps2');
  verify(installed);
  fs.mkdirSync(output, { recursive: true });
  for (const name of Object.keys(PAYLOAD)) {
    fs.copyFileSync(path.join(installed, name), path.join(output, name), fs.constants.COPYFILE_EXCL);
  }
  console.log(`PASS installed and verified THPS2 demo: ${output}`);
}
try { main(); } catch (error) { console.error(error.stack); process.exitCode = 1; }

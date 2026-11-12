#!/usr/bin/env node
'use strict';
// Invoke only on the granted runtime box, from a clean isolated clone.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const root = path.resolve(process.env.WA_TEST_ROOT || path.join(__dirname, '..'));
const out = path.resolve(process.env.WA_RUN_OUT || '/home/user/kkrieger-buffer8-validation');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, p))).digest('hex');
const git = (...args) => cp.execFileSync('git', ['-C', root, ...args], {encoding: 'utf8'}).trim();
if (git('status', '--porcelain', '--untracked-files=no')) throw Error('tracked source must be clean');
if (hash('test/binaries/calc.exe') !== 'cb71fcc9726f756421519a215c39cf89efd930c9ae0fa5bbb59b64050faef52b') throw Error('calc fixture pin mismatch');
const space = fs.statfsSync(root); if (space.bavail * space.bsize < 2.5 * 1024 ** 3) throw Error('2GiB floor plus 512MiB reserve required');
fs.mkdirSync(out, {recursive: false});
const sources = git('ls-files', 'src', 'lib', 'host.js', 'index.html', 'tools', 'test/test-directsound*').split('\n').filter(Boolean);
const pins = Object.fromEntries(sources.map(p => [p, hash(p)]));
fs.writeFileSync(path.join(out, 'sources.json'), JSON.stringify(pins, null, 2));
fs.writeFileSync(path.join(out, 'environment.json'), JSON.stringify({head: git('rev-parse', 'HEAD'), node: process.version, arch: process.arch, platform: process.platform}, null, 2));
const suites = ['buffer8', 'buffer-query-interface', 'notify', 'buffer-format', 'ring-wrap', 'play-cursor'];
const commands = [['canonical', 600, 'bash', ['tools/build.sh']], ...suites.map(s => [s, 180, process.execPath, ['test/test-directsound-' + s + '.js']])];
const results = [];
for (const [label, seconds, command, args] of commands) {
  const fd = fs.openSync(path.join(out, label + '.log'), 'wx'), start = new Date().toISOString();
  const r = cp.spawnSync('timeout', ['--signal=TERM', '--kill-after=10s', seconds + 's', command, ...args], {cwd: root, stdio: ['ignore', fd, fd]});
  fs.closeSync(fd);
  const row = {label, command, args, start, end: new Date().toISOString(), exit: r.status, signal: r.signal, error: r.error?.message || null};
  results.push(row); fs.writeFileSync(path.join(out, 'suites.json'), JSON.stringify(results, null, 2)); console.log(JSON.stringify(row));
  if (label === 'canonical') {
    if (r.status !== 0) break;
    fs.writeFileSync(path.join(out, 'canonical.sha256'), hash('build/wine-assembly.wasm') + '\n');
  }
}
const changed = Object.keys(pins).filter(p => hash(p) !== pins[p]);
fs.writeFileSync(path.join(out, 'postflight.json'), JSON.stringify({changed, status: git('status', '--porcelain', '--untracked-files=no')}, null, 2));
process.exitCode = results.length !== 7 || results.some(r => r.exit !== 0) || changed.length ? 1 : 0;

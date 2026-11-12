#!/usr/bin/env python3
"""Bounded offline review replay. No guest, build, runtime or network calls."""
from pathlib import Path
import hashlib
import json
import os
import subprocess

E = Path(__file__).resolve().parent
R = E.parents[2]
ENV = {**os.environ, 'GIT_NO_LAZY_FETCH': '1'}
CANDIDATE = '30bdd15fb0c824701716ab04335a4688a7c36a96'
MAIN = '324cc4f9580755a4fcc97eea0a5e4070ea7a0df9'
checks = []

def git(*args):
    return subprocess.check_output(['git', *args], cwd=R, env=ENV)

def run(name, command, expected=0, env=None):
    p = subprocess.run(command, cwd=R, env={**ENV, **(env or {})}, capture_output=True, text=True)
    (E / (name + '.log')).write_text(p.stdout + p.stderr)
    assert p.returncode == expected, (name, p.returncode, p.stderr[:400])
    checks.append(dict(name=name, command=command, env=env, exit=p.returncode, expected=expected))

def changed_file(p, value, action):
    original = p.read_bytes()
    try:
        p.write_bytes(value)
        action()
    finally:
        p.write_bytes(original)

def sha(b):
    return hashlib.sha256(b).hexdigest()

# Every production file in the focused checkout is the exact candidate blob.
production = ['test/run.js', 'host.js', 'lib/host-imports.js', 'lib/vfs-export.js',
              'lib/filesystem.js', 'lib/process-boot.js', 'lib/region-map.generated.js',
              'lib/storage.js', 'lib/browser-shell.js', 'lib/dll-registry.js']
identity = {f: sha((R/f).read_bytes()) for f in production}
for f in production:
    oid = git('ls-tree', CANDIDATE, '--', f).decode().split()[2]
    data = (R/f).read_bytes()
    assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest() == oid, f
baseline = git('show', MAIN+':test/run.js')
(E/'baseline-run.js').write_bytes(baseline)
assert baseline != (R/'test/run.js').read_bytes()
assert git('show', MAIN+':host.js') == (R/'host.js').read_bytes()
original_browser = git('show', MAIN+':test/test-shell-execute-launch.js')
assert original_browser == git('show', CANDIDATE+':test/test-shell-execute-launch.js')

fixture = ['node', 'test/test-shell-cli-routing.js']
base_env = {'CLI_SOURCE': str(E/'baseline-run.js')}
run('baseline-zero-forks', fixture+['--baseline'], env=base_env)
run('candidate-routing', fixture)
run('reject-baseline', fixture, 1, base_env)
s = (R/'test/run.js').read_text()
mutations = {
    'false-success': s.replace('return spawnVfsChild(command, directory, false, nShow) ? 33 : 2;', 'return 33;'),
    'bypassed-transport': s.replace('    const vfs = ctx.vfs;\n    if (!vfs || !(forceSpawn', '    return 0x4004;\n    const vfs = ctx.vfs;\n    if (!vfs || !(forceSpawn'),
    'missing-cleanup': s.replace('fs.rmSync(tmp, { recursive: true, force: true });', 'void tmp;'),
}
for name, value in mutations.items():
    assert value != s
    p = E/'mutation.js'
    try:
        p.write_text(value)
        run('reject-'+name, fixture, 1, {'CLI_SOURCE': str(p)})
    finally:
        p.unlink(missing_ok=True)

browser = ['node', 'test/test-shell-execute-launch.js']
changed_file(R/'test/test-shell-execute-launch.js', original_browser,
             lambda: run('original-browser-candidate-fails', browser, 1))
def original_on_main():
    changed_file(R/'test/test-shell-execute-launch.js', original_browser,
                 lambda: run('original-browser-main-fails', browser, 1))
changed_file(R/'test/run.js', baseline, original_on_main)
run('corrected-browser-candidate', browser)
changed_file(R/'test/run.js', baseline, lambda: run('corrected-browser-main', browser))
host = (R/'host.js').read_text()
for name, before, after in [
    ('absolute-call', 'if (absolute && shell.launchVfsExe', 'if (false && shell.launchVfsExe'),
    ('relative-call', 'if (!absolute && shell.launchVfsExe', 'if (false && shell.launchVfsExe'),
]:
    assert before in host
    changed_file(R/'host.js', host.replace(before, after).encode(),
                 lambda name=name: run('reject-browser-'+name, browser, 1))
shell = (R/'lib/browser-shell.js').read_text()
changed_file(R/'lib/browser-shell.js', shell.replace('queuePendingLaunch(key, SINGLE_APP(), launchOpts);',
             'queuePendingLaunch(key, SINGLE_APP());').encode(),
             lambda: run('reject-browser-lost-queue-options', browser, 1))
run('coupled-lazy-routing', ['node', str(E/'coupled-routing.cjs')])
exporter = (R/'lib/vfs-export.js').read_text()
changed_file(R/'lib/vfs-export.js', exporter.replace('value && value._provider',
             'value && (value._provider || value._size !== undefined)').encode(),
             lambda: run('reject-lazy-source-omission', ['node', str(E/'coupled-routing.cjs')], 1))
run('existing-exporter', ['node', 'test/test-vfs-export.js'])
for f in ['test/run.js', 'test/test-shell-cli-routing.js', 'test/test-shell-execute-launch.js']:
    run('syntax-'+Path(f).stem, ['node', '--check', f])
expected_rejections = {
    'reject-baseline': 'shell callback must reach authentic transport exactly once',
    'reject-false-success': 'shell callback must reach authentic transport exactly once',
    'reject-bypassed-transport': 'shell callback must reach authentic transport exactly once',
    'reject-missing-cleanup': 'snapshot cleaned on child exit',
    'original-browser-main-fails': 'browser host offers relative and absolute executable names',
    'original-browser-candidate-fails': 'browser host offers relative and absolute executable names',
    'reject-browser-absolute-call': 'browser host offers relative and absolute executable names',
    'reject-browser-relative-call': 'a bare name in the caller current directory',
    'reject-browser-lost-queue-options': 'registered and inherited-VFS handoffs use the dormant process queue',
    'reject-lazy-source-omission': 'ENOENT: no such file or directory',
}
for name, reason in expected_rejections.items():
    assert reason in (E/(name+'.log')).read_text(), (name, 'wrong rejecting reason')

run('regression-unit-tier', ['node', '-e', "const t=require('./tools/test-tiers'); const assert=require('assert'); assert.equal(t.classifyTest('test/test-shell-cli-routing.js'),'unit'); console.log('PASS new regression auto-discovered as unit');"])
(E/'source-identities.json').write_text(json.dumps(identity, indent=2)+'\n')
(E/'checks.json').write_text(json.dumps(checks, indent=2)+'\n')
print('PASS combined intended main: '+str(len(checks))+' outcomes; baseline and routing/browser/lazy-export controls rejected for expected reasons; no build/guest/runtime')

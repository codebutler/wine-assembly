"""Offline receipt acceptance; never contacts or starts a runtime."""
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys

E = pathlib.Path(__file__).resolve().parent
W = E.parents[2]
BASE = '58e90870a40a541a4083cae5e987ca8de31889e6'
CANDIDATE = '340803e35428c88f1946e52112e322b1733fb346'
INSTALL = 'ba485e8a27ad8a0cc25a14d40427e8cbfd38eec3'
D = pathlib.Path('/home/user/wine-assembly-shadow-man-live-capture-helper-retest-oct23')
R = D / 'scratch/runs/20261023-shadow-man-live-capture-helper-retest'
ID = pathlib.Path('/home/user/wine-assembly-shadow-man-original-install-continue-oct22')
I = ID / 'scratch/runs/20261022-shadow-man-original-install-continue'
RD = pathlib.Path('/home/user/wine-assembly-shadow-man-remaining-files-launcher-capture-oct23')
RR = RD / 'scratch/runs/20261023-shadow-man-remaining-files-launcher-capture'
os.environ['GIT_NO_LAZY_FETCH'] = '1'
os.environ['PYTHONDONTWRITEBYTECODE'] = '1'


def j(p):
    return json.loads(p.read_text())


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def blob(b):
    return hashlib.sha1(b'blob ' + str(len(b)).encode() + b'\0' + b).hexdigest()


def du(p):
    return int(subprocess.check_output(['du', '-s', '-B1', str(p)]).split()[0])


def tree(root, ref):
    result = {}
    for row in git(root, 'ls-tree', '-rz', ref).split(b'\0'):
        if row:
            meta, path = row.split(b'\t', 1)
            mode, typ, sha = meta.split()
            result[path] = (mode, sha)
    return result


def fingerprint(p):
    h = hashlib.sha256()
    count = 0
    for x in sorted(p.rglob('*')):
        s = x.lstat()
        h.update(str((str(x.relative_to(p)), s.st_mode, s.st_size,
                      s.st_mtime_ns, s.st_ino)).encode())
        count += 1
    return dict(entries=count, metadataSHA256=h.hexdigest())


candidate_tree = tree(D, CANDIDATE)
manifest = j(R / 'artifact-manifest.json')
for item in manifest:
    p = R / item['path']
    b = p.read_bytes()
    assert len(b) == item['bytes']
    assert hashlib.sha256(b).hexdigest() == item['sha256'], p
    assert blob(b).encode() == candidate_tree[str(p.relative_to(D)).encode()][1], p
assert len(manifest) == 55
for name in ['live_operator.py', 'offline_fixture.py', 'remote-launcher-live-snapshot.json']:
    assert (E / 'fixture' / name).read_bytes() == (R / name).read_bytes()

# Real candidate verifier already replayed in a copied context; it never wrote donors.
assert j(E / 'historical-verifier-replay.json')['passAll']
fixture = subprocess.run([sys.executable, '-B', str(E / 'fixture/offline_fixture.py')],
                         capture_output=True, text=True, check=True)
f = j(E / 'fixture/offline-fixture.json')
assert f['passAll'] and f['guestCalls'] == 0 and len(f['rejected']) == 8
assert f['actualSnapshotAdvancedToPng']

for name in ['launcher-before.png', 'output-config-after.png']:
    assert (E / name).read_bytes() == (R / name).read_bytes()
    assert (E / name).read_bytes().startswith(b'\x89PNG\r\n\x1a\n')
s = j(E / 'fixed-session-result.json')
assert s['guestSessionAttempts'] == 1 and s['boundPassed'] and not s['remaining']
assert s['parentOsExit'] == -9 and s['firstFailure'] is None
dispatch = j(E / 'fixed-ordinary-dispatch.json')
assert dispatch['args'] == ['cmd', 'dlg-cmd:1024'] and dispatch['exit'] == 0
assert '[input] dlg-cmd: cmd=1024 hwnd=0x10001' in dispatch['stdout']
assert 'after 64 rounds (yield_reason=15)' in dispatch['stdout']
state = json.loads(j(E / 'fixed-configuration-response-state.json')['stdout'])
assert any(w['hwnd'] == '0x10006' and w['visible'] and
           w['title'] == 'ShadowMan Configuration' for w in state['windows'])
assert any(x.get('event') == 'canonical-input-consumed' and x['sha256'] ==
           'ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553'
           for x in map(json.loads, (E / 'fixed-module-consumption.jsonl').read_text().splitlines()))

install_tree = tree(ID, INSTALL)
checked_install = ['acceptance.json', 'installed-payload.json',
                   '04-after-license-yes-control.json', 'raw/installer/output.log',
                   'raw/installer/exit.json', '03-after-welcome-next.png',
                   '04-after-license-yes.png', '10-install-progress.png']
for name in checked_install:
    p = I / name
    assert blob(p.read_bytes()).encode() == install_tree[str(p.relative_to(ID)).encode()][1], p
a = j(I / 'acceptance.json')
assert a['acceptedInGuest'] and a['childBatch'] == 1191279
assert a['actualActionAt'] == '2026-10-22T20:01:25.326828+00:00'
c = j(I / '04-after-license-yes-control.json')
assert c['rows'][0]['command']['cmd'] == 'click:413:394'
assert c['rows'][0]['response']['value']['batch'] == 1191279
assert any(w['visible'] and w['title'].strip() == 'Zielpfad wählen'
           for w in c['rows'][1]['response']['value']['windows'])
log = (I / 'raw/installer/output.log').read_text()
assert '[child 4004 _ins5576._mp] [input] click 413,394 at batch 1191279' in log
assert '[child 4004 _ins5576._mp] [API #9717822] ExitProcess(0x00000000)' in log
payload = j(I / 'installed-payload.json')
assert payload['files'] == payload['matched'] == len(payload['mapping']) == 1959
assert payload['originalPayloadBytes'] == 100354053 and not payload['mismatches']
for row in payload['mapping']:
    assert row['match'] and row['installed']['exists']
    assert row['original']['size'] == row['installed']['size']
    assert row['original']['sha256'] == row['installed']['sha256']
assert sum(r['original']['size'] for r in payload['mapping']) == 100354053
assert not j(I / 'raw/installer/exit.json')['remainingLiveProcesses']

restored = j(RR / 'verification.json')
assert restored['restorationComplete'] and restored['originalFiles'] == 2083
assert restored['originalBytes'] == 186399681 and restored['immutablePriorReceiptsMatched'] == 217
close = j(E / 'coordinator-runtime-closeout.json')
assert close['box'] == 'bx_vufrds5w' and close['state'] == 'stopped'
assert close['endedAt'] == '2026-10-23T01:26:26.642Z' and not close['ownedGroups']

base = tree(W, BASE)
assert len(base) == 8279
index = {}
for row in git(W, 'ls-files', '--stage', '-z').split(b'\0'):
    if row:
        meta, path = row.split(b'\t', 1)
        mode, sha, stage = meta.split()
        index[path] = (mode, sha)
assert all(index[p] == v for p, v in base.items() if p != b'TODOS.md')
assert not any(p.startswith((b'src/', b'lib/', b'tools/', b'test/'))
               for p in set(index) - set(base))
old = pathlib.Path('/home/user/wine-assembly-accepted-ledger/TODOS.md').read_text()
assert blob(old.encode()).encode() == base[b'TODOS.md'][1]
new = (W / 'TODOS.md').read_text()


def split_block(t):
    at = t.index('  id: NEW-GAME-SHADOW-MAN-DEMO-20261013')
    start = t.rfind('- [', 0, at)
    end = t.index('\n- [', at)
    return t[:start], t[start:end], t[end:]


before, old_block, after = split_block(old)
nbefore, new_block, nafter = split_block(new)
assert (before, after) == (nbefore, nafter)
assert 'acceptedInGuest=true' in new_block and 'acceptedInGuest=false' not in new_block
assert 'Spielen remains disabled' in new_block and 'Proposal only' in new_block
assert not j(E / 'visual-review.json')['settingsAcceptance']
assert old_block == (E / 'original-main-shadow-man-block.txt').read_text()

protected = j(E / 'protected-git-before.json')
after_protected = {p: fingerprint(pathlib.Path(p)) for p in protected}
root_git = '/home/user/wine-assembly/.git'
assert all(protected[p] == after_protected[p] for p in protected if p != root_git), 'donor Git metadata changed'
# The shared root has concurrent unrelated worktrees. Record global metadata
# variation truthfully; no command in this task writes to that Git store.
root_metadata_equal = protected[root_git] == after_protected[root_git]
(E / 'protected-git-after.json').write_text(json.dumps(after_protected, indent=2) + '\n')

admission = j(E / 'admission.json')
donors = {p: du(p) for p in admission['donors']}
own = du(W)
assert own <= admission['ownCheckoutGitOutputAllowance']
# This allowance includes the exact selected original reports, full raw log,
# payload mapping, reviewed installer images, root instructions/TODO reads,
# main TODO materialization donor, qualified-DSETUP note and ordinary tool I/O.
whole = sum(donors.values()) + own + admission['additionalReadToolsTempOutputAllowance'] + admission['reserve']
free = shutil.disk_usage(W).free
assert whole <= admission['cap'] and free >= admission['hostFloor']
out = dict(passAll=True, candidatePublishedArtifactsMatched=len(manifest),
           originalInstallFilesMatched=len(checked_install), payloadMappingsMatched=1959,
           offlineRejectCases=8, runtimeCalls=0, basePathsPreservedExceptRequestedTodo=8278,
           todoBlockOnly=True, donorGitMetadataUnchanged=True,
           sharedRootGitMetadataUnchanged=root_metadata_equal,
           metadataScope='finishing/publication interval', donorAllocated=donors,
           actualOwn=own, additionalReadsToolsTempOutputAllowance=admission['additionalReadToolsTempOutputAllowance'],
           wholeLocalIncluding8MiBReserve=whole, cap=admission['cap'], hostFree=free,
           hostFloor=admission['hostFloor'], boxStateFromCoordinatorReceipt='stopped',
           fixtureStdout=fixture.stdout.strip())
(E / 'verification.json').write_text(json.dumps(out, indent=2) + '\n')
print(json.dumps(out))

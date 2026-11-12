"""Offline acceptance only: reads retained evidence and Git objects; no runtime."""
import datetime as dt
import hashlib
import json
import pathlib
import subprocess
import sys

repo = pathlib.Path(__file__).resolve().parents[3]
p = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else repo / 'scratch/runs/20261021-madbomber-browser-gameplay'
candidate = '27c3bb0adba86db7e12786a00df5c6689a97adec'
base = '0c0fa3ebd7a84b6254a160c6cdfa6774c556d4cb'
build = '30a2c3fb1b5c2bfa8a6b001d7394d5cf50df295d'
def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo)
def read(name):
    return json.loads((p / name).read_text())
def stamp(s):
    return dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
def tree(rev):
    result = {}
    for line in git('ls-tree', '-rl', rev).decode().splitlines():
        meta, path = line.split('\t')
        mode, kind, oid, size = meta.split()
        if kind == 'blob':
            result[path] = (oid, int(size))
    return result

changed = git('diff-tree', '--no-commit-id', '--name-only', '-r', candidate).decode().splitlines()
ct = tree(candidate)
for name in changed:
    local = p / name.split('scratch/runs/20261021-madbomber-browser-gameplay/', 1)[1] if name.startswith('scratch/') else None
    if local:
        data = local.read_bytes()
        oid = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        assert ct[name] == (oid, len(data)), name
manifest_counts = {}
for name, rev in [('source-manifest.json', base), ('provenance/build-source-manifest.json', build)]:
    m = read(name)
    assert m['revision'] == rev
    t = tree(rev)
    for f in m['files']:
        assert t[f['path']] == (f['oid'], f['size']), f['path']
    manifest_counts[rev] = len(m['files'])
delta = git('diff', '--name-only', build, base).decode().splitlines()
non_docs = [n for n in delta if not n.startswith(('docs/', 'scratch/')) and n not in ('TODOS.md', 'ops/STATUS.md')]
assert set(non_docs) == {'tools/army-bltfast-observer.js', 'tools/army-bltfast-preload.test.js'}
assert len(read('evidence/dependencies.json')) == 2407
sessions = []
for d in ['browser', 'browser2']:
    prefix = 'evidence/' + d + '/'
    start = stamp(read(prefix + 'window-start.json')['at'])
    inputs = read(prefix + 'inputs.json')
    plan = read(prefix + 'commands/1.json')['actions']
    assert len(inputs) == len(plan) + 1
    assert inputs[0]['action'] == 'click'
    for actual, scheduled in zip(inputs[1:], plan):
        assert all(actual[k] == v for k, v in scheduled.items())
        elapsed = (stamp(actual['at']) - start).total_seconds() * 1000
        assert abs(elapsed - actual['elapsedMs']) <= 2
        assert elapsed >= scheduled['ms'] - 2
        snap = read(prefix + scheduled['name'] + '.json')
        assert stamp(snap['at']) >= stamp(actual['at'])
    assert all(stamp(a['at']) <= stamp(b['at']) for a, b in zip(inputs, inputs[1:]))
    responses = read(prefix + 'module-responses.json')
    net = read(prefix + 'network.json')
    assert len(responses) == 1
    r = responses[0]
    assert r['sha256'] == '728e1de80ec20a284fc41b339895ee8ac29f16e4ded83325b27576cfacd4466c'
    assert r['bytes'] == 1878508
    assert any(n['url'] == r['url'] and n.get('status') == 200 for n in net)
    assert not any('army-bltfast' in n['url'] for n in net)
    end = read(prefix + 'cleanup.json')
    duration = (stamp(end['at']) - start).total_seconds()
    assert 60 <= duration < 62
    sessions.append({'name': d, 'secondsIncludingFinalCaptureAndClose': duration, 'timestampedRecords': len(inputs), 'networkRecords': len(net), 'moduleResponseVerified': True})
times = {n: (stamp(read('evidence/browser2/' + n + '.json')['at']) - stamp(read('evidence/browser2/window-start.json')['at'])).total_seconds() for n in ['catch-4600', 'catch-5200', 'catch-6800']}
assert times == {'catch-4600': 4.725, 'catch-5200': 5.337, 'catch-6800': 6.891}
print(json.dumps({'pass': True, 'candidateFilesMatched': len(changed)-2, 'gitManifestEntries': manifest_counts, 'nonDocumentChangesSinceBuild': non_docs, 'sessions': sessions, 'visualSnapshotSeconds': times, 'fullRemoteArchiveIndependentlyVerified': False}, indent=2))

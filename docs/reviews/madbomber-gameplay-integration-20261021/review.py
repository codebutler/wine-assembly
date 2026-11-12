"""Read-only independent acceptance checks; no extraction, build or runtime."""
import hashlib, json, pathlib, subprocess, sys, tarfile
root = pathlib.Path(sys.argv[1]).resolve()
e = root / 'scratch/runs/20261021-madbomber-current-main-gameplay'
sha = lambda b: hashlib.sha256(b).hexdigest()
candidate = '045a6e6f0b496a41dc273da1f5ad9a8f6a78cbe8'
def git(*args):
    return subprocess.check_output(['git', '-C', str(root), *args])
with tarfile.open(e / 'evidence.tar.gz') as tf:
    files = {m.name: tf.extractfile(m).read() for m in tf.getmembers() if m.isfile()}
    assert len(files) == len(set(files)) == 64
    assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in files)
    for name in ['source-manifest.json', 'provenance/build-source-manifest.json']:
        manifest = json.loads(files[name])
        tree = {}
        for row in git('ls-tree', '-rl', manifest['revision']).decode().splitlines():
            head, path = row.split('\t'); mode, kind, oid, size = head.split()
            if kind == 'blob': tree[path] = (oid, int(size))
        assert tree == {x['path']: (x['oid'], x['size']) for x in manifest['files']}
    # Require ordered acknowledgements, including repeated actions, and balanced keys.
    counts = {}
    for run in ['run1', 'run2']:
        log = files[run + '/output.log'].decode(); cursor = 0; down = set(); count = 0
        for row in files[run + '/input-receipts.jsonl'].splitlines():
            rec = json.loads(row); assert rec['writable']
            if 'cmd' not in rec['command']: continue
            action, *values = rec['command']['cmd'].split(':')
            assert action in ['keydown', 'keyup', 'mousemove']
            if action in ['keydown', 'keyup']:
                key = int(values[0]); assert key in [13, 32]
                if action == 'keydown': assert key not in down; down.add(key)
                else: assert key in down; down.remove(key)
                expected = f'[input] {action} vk={key}'
            else: expected = f'[input] mousemove {values[0]},{values[1]}'
            cursor = log.index(expected, cursor) + len(expected); count += 1
        assert not down; counts[run] = count
    pre = json.loads(files['preflight.json'])
    original = root / 'scratch/runs/20261020-madbomber-native-qualification/original-assets.tar.gz'
    assert sha(original.read_bytes()) == 'b5353b73674a1af6109cb9bf3af5f7d0383308b7ef0b47d52139813ba3ee98ef'
    with tarfile.open(original) as ot:
        originals = {m.name: ot.extractfile(m).read() for m in ot.getmembers() if m.isfile()}
    restored = 0
    for pin in pre['closure']:
        path = pin['path']; prefix = 'test/binaries/candidates/madbomber/'
        data = originals[path[len(prefix):]] if path.startswith(prefix) else (root/path).read_bytes()
        assert sha(data) == pin['sha256'], path
        restored += 1
    # Materialized candidate files must match their committed objects and archive members.
    paths = git('diff-tree', '--no-commit-id', '--name-only', '-r', candidate).decode().splitlines()
    for path in paths:
        data = (root/path).read_bytes() if path.startswith('scratch/') else git('show', candidate+':'+path)
        assert hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest() == git('rev-parse', candidate+':'+path).decode().strip()
        if path.startswith('scratch/'):
            relative = path.split('20261021-madbomber-current-main-gameplay/', 1)[1]
            if relative in files and relative != 'SHA256SUMS.json': assert data == files[relative], relative
    # Outer publication seals cover the selected files; inner seals cover all captures/provenance.
    outer = json.loads((e/'SHA256SUMS.json').read_text())
    for pin in outer:
        data = (e/pin['path']).read_bytes()
        assert len(data) == pin['bytes'] and sha(data) == pin['sha256'], pin['path']
print(json.dumps({'pass': True, 'candidatePaths': len(paths), 'completeGitManifestMatches': 2,
                  'orderedBalancedInputs': counts, 'recoverableAssetPins': restored,
                  'archiveMembers': len(files), 'outerSeals': len(outer), 'newBuilds': 0, 'newRuntimeRuns': 0}, indent=2))

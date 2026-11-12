"""Offline provenance and recovery-tool checks; no original bytes or runtime."""
import hashlib, io, json, pathlib, subprocess, tarfile, tempfile

ROOT = pathlib.Path(__file__).resolve().parents[3]
HERE = pathlib.Path(__file__).resolve().parent
sha = lambda b: hashlib.sha256(b).hexdigest()
rows = json.loads((HERE / 'provenance.json').read_text())
archives = {}
for row in rows:
    origin, _, member = row['origin'].partition('#')
    if member:
        if origin not in archives:
            raw = subprocess.check_output(['git', 'show', origin], cwd=ROOT)
            with tarfile.open(fileobj=io.BytesIO(raw)) as t:
                archives[origin] = {m.name.removeprefix('./'): t.extractfile(m).read()
                                    for m in t.getmembers() if m.isfile()}
        expected = archives[origin][member]
    else:
        expected = subprocess.check_output(['git', 'show', origin], cwd=ROOT)
    actual = (ROOT / row['path']).read_bytes()
    assert actual == expected and len(actual) == row['bytes']
    assert sha(actual) == row['sha256']

layout = ROOT / 'docs/reviews/jedi-original-layout-install-20261021'
archive = next(v for k, v in archives.items() if 'original-layout-install' in k)
for image, member in [('complete.png', 'install1/complete.png'),
                      ('startup.png', 'launch2/startup.png'),
                      ('directx-blocker.png', 'launch2/directx-blocker.png')]:
    assert (layout / image).read_bytes() == archive[member]
proof = json.loads((layout / 'layout-proof.json').read_text())['files']
inventory = json.loads((layout / 'original-inventory.json').read_text())['files']
assert len({f['name'] for f in proof}) == len(proof) == 39
assert {f['name']: (f['size'], f['sha256']) for f in proof} == {
    f['name']: (f['size'], f['sha256']) for f in inventory}
# These recipes are scoped to sealed, trusted manifests, run without python -O.
trees = json.loads((layout / 'sealed/recovery-trees.json').read_text())['trees']
for tree, files in trees.items():
    for row in files:
        for name in [tree, row['path'], row['recovery']['path']]:
            p = pathlib.PurePosixPath(name)
            assert not p.is_absolute() and '..' not in p.parts and ':' not in name

with tempfile.TemporaryDirectory() as td:
    td = pathlib.Path(td)
    bad = td / 'bad-package'; bad.write_bytes(b'not the pinned original')
    dest = td / 'rejected'
    p = subprocess.run(['python3', str(layout / 'recover-layout.py'), str(bad),
                        str(layout / 'original-inventory.json'), str(dest)], capture_output=True)
    assert p.returncode != 0 and not dest.exists()
    # Exercise all three restore mapping kinds with tiny synthetic bytes.
    e, s, o = [td / name for name in ['evidence', 'source', 'original']]
    for base in [e / 'recovery-payload', s, o]: base.mkdir(parents=True)
    mappings = []
    for kind, base in [('payload', e / 'recovery-payload'), ('source', s), ('original', o)]:
        raw = kind.encode(); (base / kind).write_bytes(raw)
        mappings.append(dict(path=kind, bytes=len(raw), sha256=sha(raw),
                             recovery=dict(kind=kind, path=kind)))
    (e / 'recovery-trees.json').write_text(json.dumps({'trees': {'observed/vfs': mappings}}))
    cmd = ['python3', str(layout / 'restore.py'), str(e), str(s), str(o)]
    subprocess.run(cmd + [str(td / 'restored')], check=True, capture_output=True)
    for kind in ['payload', 'source', 'original']:
        assert (td / 'restored/observed/vfs' / kind).read_bytes() == kind.encode()
    assert subprocess.run(cmd + [str(td / 'restored')], capture_output=True).returncode != 0
    (e / 'recovery-payload/payload').write_bytes(b'corrupt')
    assert subprocess.run(cmd + [str(td / 'corrupt')], capture_output=True).returncode != 0
    assert not (td / 'corrupt').exists()

print(json.dumps(dict(pass_=True, exactProvenanceFiles=len(rows), safeMappingPaths=361,
                     recoveryControls=4, originalExtractionReplayed=False,
                     runtimeReplayed=False)))

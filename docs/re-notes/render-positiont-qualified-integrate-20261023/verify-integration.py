"""Git-object-only identity and preservation checks; never import project code."""
import hashlib
import json
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
HERE = pathlib.Path(__file__).resolve().parent
BASE = 'bb9c496ed13095cc832fdf607f0937fb9c14b7de'
MAIN = '6666ab7b28c9efca61c3ce6875c05da71111507a'
CANDIDATE = '95a12b641d2b9195762c4800a1db8e3b76a3ceee'
REPORT = 'docs/re-notes/render-positiont-qualified-integrate-20261023.md'
PREFIX = REPORT[:-3] + '/'
os.environ['GIT_NO_LAZY_FETCH'] = '1'


def git(*args, data=None):
    return subprocess.check_output(['git', '-C', str(ROOT), *args], input=data, timeout=45)


def tree(rev):
    result = {}
    for row in git('ls-tree', '-r', rev).decode().splitlines():
        meta, path = row.split('\t')
        mode, kind, blob = meta.split()
        assert kind == 'blob', (path, kind)
        result[path] = (mode, blob)
    return result


def verify(rev):
    integrated, main, candidate, base = map(tree, [rev, MAIN, CANDIDATE, BASE])
    accepted = {p for p in base.keys() | candidate.keys() if base.get(p) != candidate.get(p)}
    assert len(accepted) == 219
    actual = {p for p in main.keys() | integrated.keys() if main.get(p) != integrated.get(p)}
    new_evidence = {p for p in actual if p == REPORT or p.startswith(PREFIX)}
    assert actual - new_evidence == accepted, sorted(actual - new_evidence ^ accepted)
    assert not accepted & {p for p in base.keys() | main.keys() if base.get(p) != main.get(p)}
    for p in accepted:
        assert integrated.get(p) == candidate.get(p), ('accepted entry changed', p)
    preserved = []
    for p in main.keys() | integrated.keys():
        if p not in accepted and p not in new_evidence:
            assert integrated.get(p) == main.get(p), ('unrelated entry changed', p)
            if p in main:
                preserved.append([p, *main[p]])
    manifest = json.loads(git('show', CANDIDATE + ':docs/re-notes/render-positiont-reuse-independent-qualification-20261023/source-manifest.json'))
    pins = json.loads(git('show', rev + ':test/support/positiont-com-source-pins.json'))
    assert len(manifest) == 290 and len(pins) == 286
    assert hashlib.sha256(json.dumps(pins, separators=(',', ':')).encode()).hexdigest() == 'd39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262'
    # Read committed blobs, including unmaterialized files. No checkout inference.
    records = []
    for row in manifest:
        p = row['path']
        assert integrated[p] == candidate[p] == (row['mode'], row['blob'])
        content = git('cat-file', 'blob', integrated[p][1])
        assert len(content) == row['bytes']
        assert hashlib.sha256(content).hexdigest() == row['sha256']
        if row['pin']:
            assert pins[p] == integrated[p][1]
        records.append({k: row[k] for k in ['path', 'mode', 'blob', 'sha256', 'bytes', 'pin']})
    assert sum(r['pin'] for r in records) == 286
    artifacts = []
    donor = pathlib.Path('/home/user/wine-assembly-render-positiont-tiny-rhw-native-qualification-oct23/build')
    for name, size, sha in [
        ('positiont-com-tiny-rhw.wasm', 1883361, '5d057b5424b710fb28f1c617786ba71d7c8c116fb74e51eac611ec9a79868ef1'),
        ('positiont-com-tiny-rhw.provenance.json', 1002, 'e64c83f925f52649f46e1a89bb952d7dde06d627f7a799f0956a535c1bca8cc3')]:
        p = donor / name
        content = p.read_bytes()
        assert len(content) == size and hashlib.sha256(content).hexdigest() == sha
        artifacts.append(dict(path=str(p), bytes=size, sha256=sha))
    provenance = json.loads((donor / 'positiont-com-tiny-rhw.provenance.json').read_text())
    assert provenance['sourcePinsSha256'] == 'd39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262'
    assert provenance['extraWatSha256'] == '4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068'
    return dict(verdict='PASS', revision=rev, tree=git('rev-parse', rev + '^{tree}').decode().strip(),
                freshMain=MAIN, acceptedHead=CANDIDATE, acceptedPaths=len(accepted),
                addedIntegrationEvidence=sorted(new_evidence), pins=286, closureFilesAndModes=290,
                fixture=integrated['test/test-d3d9-positiont-com-qualification.js'],
                unrelatedEntriesPreserved=len(preserved),
                unrelatedManifestSha256=hashlib.sha256(json.dumps(sorted(preserved), separators=(',', ':')).encode()).hexdigest(),
                qualifiedClosure=records, retainedArtifacts=artifacts,
                nativeQualification='REUSED; no native replay or build', groupsReaped=True, box=None)


if __name__ == '__main__':
    rev, output = sys.argv[1:]
    result = verify(rev)
    pathlib.Path(output).write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ['qualifiedClosure', 'addedIntegrationEvidence']}))

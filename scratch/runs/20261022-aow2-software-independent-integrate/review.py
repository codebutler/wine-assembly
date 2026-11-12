"""Read-only independent checks; stream archives in place, allocate no runtime."""
import hashlib
import json
import pathlib
import subprocess
import tarfile

W = pathlib.Path(__file__).resolve().parents[3]
E = W / 'scratch/runs/20261022-aow2-import-reachability-measure'
ROOT = pathlib.Path('/home/user/wine-assembly')
DONOR = pathlib.Path('/home/user/wine-assembly-arcanum-software-frame-measure-oct22/runtime')
Q = pathlib.Path('/home/user/wine-assembly-mm-timer-qualified-integrate-oct22/scratch/runs/20261022-mm-timer-canonical-qualification')
REV = 'c26252c4a95babe583ade1d1c6e2da0c050be45c'

def load(p):
    return json.loads(p.read_text())

def sha(b):
    return hashlib.sha256(b).hexdigest()

def file_sha(p):
    with p.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

git = subprocess.Popen(['git', '-C', str(W), 'cat-file', '--batch'], stdin=subprocess.PIPE,
                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)

def blob(ref):
    git.stdin.write((ref + '\n').encode())
    git.stdin.flush()
    header = git.stdout.readline().split()
    assert len(header) == 3 and header[1] == b'blob', (ref, header)
    b = git.stdout.read(int(header[2]))
    assert git.stdout.read(1) == b'\n'
    return b

try:
    seals = load(E / 'seals.json')
    for row in seals:
        p = E / row['path']
        assert p.stat().st_size == row['size'] and file_sha(p) == row['sha256'], p
    archive = E / 'evidence.tar.gz'
    assert archive.stat().st_size == 6305282
    assert file_sha(archive) == 'ff023d5ccfefed47b06c177250429b7487e265c1425453d4814c5ee4be396a67'
    copies = expanded = 0
    with tarfile.open(archive) as t:
        for m in t:
            if m.isfile():
                assert not pathlib.PurePosixPath(m.name).is_absolute() and '..' not in pathlib.PurePosixPath(m.name).parts
                assert t.extractfile(m).read() == (E / 'raw' / m.name).read_bytes(), m.name
                copies += 1
                expanded += m.size
    assert len(seals) == 104 and copies == 59
    metrics = {}
    for label, expected in [('gate', 45), ('full', 220)]:
        r = load(E / f'raw/run/worker-{label}-samples.json')
        s, ev = r['samples'], r['events']
        assert r['hwnd'] == 65538 and (r['width'], r['height']) == (1024, 768) and not r['errors']
        count = s[-1]['count'] - s[0]['count']
        seconds = (s[-1]['t'] - s[0]['t']) / 1000
        assert count == expected == len(ev) == r['frames']
        assert abs(seconds-r['seconds']) < 1e-9 and abs(count/seconds-r['fps']) < 1e-9
        for i, sample in enumerate(s):
            assert sample['valid'] and not sample['direct'] and isinstance(sample['writeSeq'], int)
            if i:
                assert sample['t'] > s[i-1]['t'] and sample['count'] >= s[i-1]['count'] and sample['writeSeq'] >= s[i-1]['writeSeq']
            # Counts at each sample independently agree with event timestamps.
            assert sample['count'] == sum(e['submittedAt'] <= sample['t'] for e in ev)
        for i, event in enumerate(ev):
            assert event['count'] == i+1 and event['kind'] == 'completed visible filter.present'
            assert s[0]['t'] <= event['copiedAt'] <= event['submittedAt'] <= s[-1]['t']
            assert s[0]['writeSeq'] < event['seq'] <= s[-1]['writeSeq']
            if i:
                assert event['seq'] > ev[i-1]['seq'] and event['submittedAt'] >= ev[i-1]['submittedAt']
            assert event['sinkDrawArgs'] == [0, 0, 1024, 768, 6, 0, 448, 336]
        for row in s+ev:
            sink = row['sink']
            assert sink['id'] == 'screen-present' and sink['display'] == 'block' and sink['visibility'] == 'visible'
            assert sink['opacity'] == '1' and sink['documentVisibility'] == 'visible'
            assert sink['rect'] == dict(x=10, y=226, width=460, height=336)
        metrics[label] = dict(count=count, seconds=seconds, rate=count/seconds, samples=len(s), start=s[0]['t'], end=s[-1]['t'])
    assert metrics['gate']['end'] < metrics['full']['start']
    canonical = Q / 'qualification-artifacts.tar.gz'
    assert file_sha(canonical) == '3e308c0012e996070a01c1f77d6f399e9aaf7adb2d2620b27af018a80d29e248'
    with tarfile.open(canonical) as t:
        module = t.extractfile('build/wine-assembly.wasm').read()
    assert len(module) == 1878971 and sha(module) == 'f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
    trees = {}
    for path in ['src', 'lib', 'tools', 'host.js', 'index.html', 'package-lock.json']:
        refs = subprocess.check_output(['git', '-C', str(W), 'rev-parse', REV+':'+path,
            'ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c:'+path], stderr=subprocess.DEVNULL).decode().splitlines()
        assert refs[0] == refs[1], path
        trees[path] = refs[0]
    tracked = load(Q/'source-manifest.json')['files']
    entries = subprocess.check_output(['git', '-C', str(W), 'ls-tree', '-r',
        'ce4ce4f95eacaedff1b3e386f3ce3ae5d85bd16c'], stderr=subprocess.DEVNULL).decode().splitlines()
    treeblobs = {line.split('\t',1)[1]: line.split()[2] for line in entries}
    assert all(treeblobs[x['path']] == x['blob'] for x in tracked)
    closure = tracked + load(Q/'supplemental-manifest.json')
    for x in closure:
        b = blob(x['blob'])
        assert len(b) == x['size'] and sha(b) == x['sha256'], x['path']
    source = load(E/'source-manifest.json')
    for x in source:
        p = DONOR/x['path']
        assert p.stat().st_size == x['size'] and file_sha(p) == x['sha256'], p
        if not x['path'].startswith('build/'):
            assert sha(blob(REV+':'+x['path'])) == x['sha256'], x['path']
    fonts, assets = load(E/'font-manifest.json'), load(E/'assets.json')['files']
    for x in fonts+assets:
        p = ROOT/x['path']
        assert p.stat().st_size == x['size'] and file_sha(p) == x['sha256'], p
    base = ROOT / 'test/binaries/win98-games-a-d/Age of Wonders2 demo-SW/extracted'
    manifest = load(base/'.wine-assembly-browser.json')
    assert len(manifest['files']) == 1059
    actual = {str(p.relative_to(base)) for p in base.rglob('*') if p.is_file()}
    assert actual == {x['url'] for x in manifest['files']} | {'AoW2.exe', 'vcl50.bpl', 'vclx50.bpl', 'Ml42ND50.bpl', '.wine-assembly-browser.json'}
    assert {str(ROOT/x['path']) for x in assets} == {str(base/p) for p in actual}
    for x in manifest['files']:
        assert (base/x['url']).stat().st_size == x['size'] and x['loadMode'] == 'lazy'
        assert x['vfsPath'] == 'c:\\aow2demo\\'+x['url'].replace('/', '\\')
    pins = load(E/'pins.json')['files']
    pinmap = {x['path']: x for x in pins}
    assert len(pins) == len(pinmap) == 1253
    for x in source+fonts+assets:
        assert pinmap[x['path']]['sha256'] == x['sha256']
    support = [x for x in pins if x['path'] not in {r['path'] for r in source+fonts+assets}]
    for x in support:
        p = W/x['path'] if x['path'].startswith('tools/') else ROOT/x['path']
        assert file_sha(p) == x['sha256'] and p.stat().st_size == x['size'], p
    # The attach driver is transferred separately and sealed; it is not one of the 1,253 pins.
    attach = W/'tools/aow2-worker-measure.js'
    transfer = load(E/'worker-observer-transfer.json')
    assert transfer['sha256'] == file_sha(attach)
    assert load(E/'raw/pins.json') == load(E/'pins.json')
    assert load(E/'raw/preflight.json')['pins'] == load(E/'raw/handoff.json')['pinsVerified'] == 1253
    deps = load(E/'raw/runner-dependencies.json')
    assert len(deps) == load(E/'raw/handoff.json')['dependenciesVerified'] == 4434
    assert len({x['path'] for x in deps}) == 4434
    requests = load(E/'raw/run/requests.json')
    successful = {x['rel'] for x in requests if x['status'] in [200,206]}
    unpinned = successful-set(pinmap)
    assert not unpinned, unpinned
    commands = load(E/'raw/run/commands.json')
    assert not any(c['action'] in ['registered-route','measure'] for c in commands)
    assert [c['action'] for c in commands].count('canvas-click') == 4
    assert not load(E/'raw/run/errors.json')
    console = load(E/'raw/run/console.json')
    exits = [x['text'] for x in console if 'exited (eip=0)' in x['text']]
    assert len(exits) == 2
    assert not any('GetOverlappedResult' in x['text'] or 'ActivateKeyboardLayout' in x['text'] for x in console)
    cleanup = load(E/'raw/run/cleanup.json')
    assert cleanup['chromeTerminal'] == dict(code=0,signal=None) and cleanup['browserWallSeconds'] < 1200
    for finding in load(E/'loader-semantics.json')['findings']:
        b = blob(REV+':'+finding['path'])
        assert sha(b) == finding['sha256']
        excerpt = '\n'.join(b.decode().splitlines()[finding['firstLine']-1:finding['lastLine']])
        assert excerpt == finding['excerpt']
    print(json.dumps(dict(seals=len(seals), archiveCopies=copies, archiveExpandedBytes=expanded,
        metrics=metrics, canonicalSourceBlobs=len(closure), runtimePins=len(source), fonts=len(fonts),
        fixturePins=len(assets), supportPins=len(support), remotePins=len(pins), runnerPins=len(deps),
        successfulRequestedPaths=len(successful), unpinnedSuccessfulRequests=sorted(unpinned),
        historicalTrees=trees, milesThreadExits=exits,
        browserWallSeconds=cleanup['browserWallSeconds'], passed=True), indent=2))
finally:
    git.stdin.close()
    git.wait()

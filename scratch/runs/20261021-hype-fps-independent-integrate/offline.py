"""Read-only independent acceptance; no extraction, build or runtime access."""
import hashlib, io, json, pathlib, struct, subprocess, tarfile
ROOT = pathlib.Path('/home/user/wine-assembly')
NEW = ROOT/'scratch/runs/20261021-hype-counter-owner-measure'
OLD = ROOT/'scratch/runs/20261021-hype-browser-fps-authorized'
BASE = 'b88c818ba3a071877e889e7cc779975a193591ce'
CANDIDATE = '12e43047471843e8ae49a85844fae53c4184881f'
PRIOR = '56c92dc2abad4c2cbf1ca26ab0b85a5dfbde388f'
def git(*args): return subprocess.check_output(['git', '-C', str(ROOT), *args])
def sha(b): return hashlib.sha256(b).hexdigest()
def read(p): return json.loads(p.read_bytes())
def seals(root, entries):
    for f in entries:
        p = pathlib.PurePosixPath(f['path'])
        assert not p.is_absolute() and '..' not in p.parts
        b = (root/p).read_bytes()
        assert len(b) == f['bytes'] and sha(b) == f['sha256'], str(p)
    return len(entries)
result = {'candidate': CANDIDATE, 'prior': PRIOR, 'base': BASE}
result['candidateSeals'] = seals(NEW, read(NEW/'SHA256SUMS.json')['files'])
result['recoverySeals'] = seals(NEW/'evidence', read(NEW/'recovery-manifest.json')['files'])
result['priorSeals'] = seals(OLD, read(OLD/'SHA256SUMS.json'))
# Authenticate candidate artifacts against immutable Git objects, not just self-seals.
paths = git('diff', '--name-only', BASE, CANDIDATE).decode().splitlines()
for p in paths:
    local = NEW/'report.md' if p == 'docs/reviews/hype-counter-owner-measure-20261021.md' else ROOT/p
    assert local.read_bytes() == git('show', CANDIDATE+':'+p), p
result['candidateGitFiles'] = len(paths)
archive = OLD/'evidence-recovery.tgz'
trackedArchive = git('show', PRIOR+':docs/reviews/hype-browser-fps-authorized-20261021-evidence.tgz')
result['priorArchiveSha256'] = sha(trackedArchive)
outer = 0
with tarfile.open(fileobj=io.BytesIO(trackedArchive)) as tf:
    for m in tf:
        if not m.isfile(): continue
        assert not m.name.startswith('/') and '..' not in pathlib.PurePosixPath(m.name).parts
        assert tf.extractfile(m).read() == (OLD/m.name).read_bytes(), m.name
        outer += 1
result['priorGitArchiveFilesMatched'] = outer
del trackedArchive
members = 0
with tarfile.open(archive) as tf:
    for m in tf:
        if not m.isfile(): continue
        assert not m.name.startswith('/') and '..' not in pathlib.PurePosixPath(m.name).parts
        b = tf.extractfile(m).read()
        assert b == (OLD/'recovered'/m.name).read_bytes(), m.name
        members += 1
result['archiveFilesMatchedToRecovered'] = members
tree = {}
for line in git('ls-tree', '-rl', BASE).decode().splitlines():
    header, p = line.split('\t', 1)
    mode, typ, oid, size = header.split()
    tree[p] = (oid, size)
manifest = read(OLD/'source-manifest.json')
assert manifest['base'] == BASE and len(manifest['files']) == 6731
for f in manifest['files']:
    assert tree[f['path']] == (f['oid'], str(f['bytes'])), f['path']
assert manifest == read(OLD/'recovered/evidence/source-manifest.json')
result['exactGitSourceIdentities'] = len(manifest['files'])
assets = read(OLD/'recovered/evidence/assets.json')
assert len(assets) == 59
for f in assets:
    b = (ROOT/f['path']).read_bytes()
    assert len(b) == f['bytes'] and sha(b) == f['sha256'], f['path']
result['readOnlyOriginalAssetsVerified'] = len(assets)
result['assetBytes'] = sum(f['bytes'] for f in assets)
owner = read(NEW/'evidence/session1/authenticated-owner.json')
exe = (ROOT/'test/binaries/candidates/hype-time-quest-demo/launch-game/MaiDFXvr_bleu.exe').read_bytes()
assert sha(exe) == '635f394121e50001227b97741dbf304f0a88f819c6f2ba2378cf61d9fa2a6344'
pe = struct.unpack_from('<I', exe, 0x3c)[0]
nsect = struct.unpack_from('<H', exe, pe+6)[0]
optlen = struct.unpack_from('<H', exe, pe+20)[0]
imagebase = struct.unpack_from('<I', exe, pe+24+28)[0]
def at(va, size):
    rva = va-imagebase
    for i in range(nsect):
        sec = pe+24+optlen+40*i
        vs, addr, rawsize, raw = struct.unpack_from('<IIII', exe, sec+8)
        if addr <= rva and rva+size <= addr+rawsize:
            return exe[raw+rva-addr:raw+rva-addr+size]
    raise AssertionError(hex(va))
assert at(0x43f610,64).hex() == owner['code']
# Independently authenticate registered finish/render callbacks and direct nested UI call.
install = bytes.fromhex('c7058c225b0080f14300c70590225b0010f64300')
assert exe.count(install) == 6  # mov [render],43f180; mov [finish],43f610
call = at(0x43f678,5)
assert call[0] == 0xe8 and 0x43f67d+struct.unpack('<i',call[1:])[0] == 0x422260
result['callbackBinaryMapping'] = {'address':'0x43f610','original64Bytes':owner['code'], 'registeredAt':'0x5b2290','nestedUiCall':'0x43f678 -> 0x422260'}
for f in read(NEW/'source-audit.json'):
    b = git('show',BASE+':'+f['path'])
    assert sha(b) == f['sha256']
    lines = b.decode().splitlines()
    for l in f['lines']: assert lines[l['line']-1] == l['text']
result['sourceAuditFiles'] = len(read(NEW/'source-audit.json'))
validator = git('show',BASE+':tools/hype-glide-emission-observer.js')
assert validator == (NEW/'source/hype-glide-emission-observer.js').read_bytes()
assert validator == (OLD/'source/tools/hype-glide-emission-observer.js').read_bytes()
assert git('show',BASE+':test/test-hype-glide-emission-observer.js') == (OLD/'source/test/test-hype-glide-emission-observer.js').read_bytes()
assert read(OLD/'validator-tests-exit.json')['exit'] == 0
assert 'tests 66' in (OLD/'validator-tests.tap').read_text() and 'pass 66' in (OLD/'validator-tests.tap').read_text()
assert (OLD/'recovered/evidence/canonical-build.exit').read_text().strip() == '0'
assert read(OLD/'git-api-table.json')['exitCode'] == 0
result['priorTestsReused'] = 66
result['priorCanonicalBuildReused'] = True
probes = read(NEW/'evidence/session1/owner-probes.json')
assert len(probes) == 4 and {p['slot'] for p in probes} == {0,1,2,3}
emitting = [p for p in probes if p['end']['count'] > p['initial']['count']]
assert len(emitting) == 1 and emitting[0]['slot'] == owner['slot']
life = read(NEW/'evidence/session1/worker-lifecycle.json')
assert life == read(NEW/'evidence/session1/worker-lifecycle-start.json')
events = [e for e in life if e['id'] == owner['creation']['id']]
assert events == [owner['creation'],owner['slotInitialization'],owner['initialization']]
assert owner['internalTid']+1 == owner['exportedID']
assert owner['slotInitialization']['slot'] == owner['slot']
assert owner['initialization']['tid'] == owner['internalTid']
assert owner['url'] == 'http://127.0.0.1:8080/'+owner['creation']['url']
raw = read(NEW/f"evidence/session1/logical-slot{owner['slot']}.json")
assert raw['events'] == [] and raw['sameInstance'] and raw['code'] == owner['code']
samples = raw['samples']; assert len(samples) == 108
assert samples == read(NEW/'measurement.json')['samples']
for s in samples:
    assert s['enabled'] and s['sameInstance'] and s['codeMatches']
    assert s['owner'] == samples[0]['owner'] and s['owner']['thread'] == owner['exportedID']
    assert s['clockOrigin'] == str(raw['origin']) and s['generation'] == samples[0]['generation']
for a,b in zip(samples,samples[1:]): assert b['hostMs']>a['hostMs'] and b['count']>=a['count']
delta = samples[-1]['count']-samples[0]['count']
ms = samples[-1]['hostMs']-samples[0]['hostMs']
assert delta == 188 and abs(ms-10708.68)<1e-8
result['independentArithmetic'] = {'first':samples[0], 'last':samples[-1], 'samples':len(samples), 'countDelta':delta,'ms':ms,'fps':delta*1000/ms,'sumAdjacentDeltas':sum(b['count']-a['count'] for a,b in zip(samples,samples[1:]))}
for p in probes:
    r = read(NEW/f"evidence/session1/restore-slot{p['slot']}.json")
    assert r['prior'] == r['restored'] == p['prior']
    rows = read(NEW/f"evidence/session1/logical-slot{p['slot']}.json")['samples']
    if p['slot'] != owner['slot']: assert all(s['count']==0 for s in rows)
for n in ['measurement.json','logical-raw.json','validation.json']:
    assert (NEW/'rejected-prior'/n).read_bytes() == (OLD/n).read_bytes()
costs = [s['sampleCostMs'] for s in samples]
result['independentOverhead'] = {'totalMs':sum(costs),'medianMs':sorted(costs)[len(costs)//2], 'maxMs':max(costs),'percent':sum(costs)*100/ms, 'maxPairReadMs':max(s['pairReadMs'] for s in samples)}
result['verdict'] = 'PASS bounded logical callback rate; authenticity review separate from validator'
print(json.dumps(result,indent=2))

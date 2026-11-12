"""Bounded offline integration verification. Never builds or executes WASM.

Run from this focused checkout with GIT_NO_LAZY_FETCH=1. Existing acceptance
verifiers write only through an intercepted Path.write_text into replayed/;
their donors stay immutable. No original inputs or accepted archives are copied.
"""
import contextlib, hashlib, io, json, os, pathlib, runpy, subprocess

E = pathlib.Path(__file__).resolve().parent
R = E.parents[2]
BASE = '89f1e9d2c67aa94d56d2319115589d07204d42e0'
SOURCE = '84f2a0165798f30d7a131dccdcc054a224fbf57b'
ENV = dict(os.environ, GIT_NO_LAZY_FETCH='1', PYTHONDONTWRITEBYTECODE='1')
os.environ.update(GIT_NO_LAZY_FETCH='1', PYTHONDONTWRITEBYTECODE='1')

def load(p): return json.loads(p.read_text())
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def git(*a): return subprocess.check_output(['git', '-C', str(R), *a], env=ENV)
def tree(rev):
    out = {}
    for row in git('ls-tree', '-rz', rev).split(b'\0'):
        if row:
            meta, p = row.split(b'\t'); mode, kind, oid = meta.decode().split()
            out[p.decode()] = (mode, oid)
    return out

evidence = [
    ('dsetup-independent-accept', '4d7c40955935ec466b9e30b44c520b60048335a6'),
    ('dsetup-census-fullmodule', '8a645bbdc386b426bb7aaf00ecf666b64446f757'),
    ('dsetup-region-fullmodule', 'e7adc994f4d56a1e8e6fc72267d6ac9cfc9b5d8c'),
    ('dsetup-fixture-fullmodule', '444c44404d4e9ab51e6d4d20898fd4c95db661a0'),
    ('static-dx-harness-qualification', '59367d20599e8935b5464a692350418f95bf9e19'),
    ('pinned-dependency-qualification', 'a90e0dac5bea1594825c6a135c3f39fc1a40dd0a'),
    ('genuine-dsetup-native-abi', '73d0d49f8d692028a90bac362647fdc24dcc4b14'),
]
source_chain = [BASE, '7a21579f9adb208164312961c249a0aa9080a8b7',
    'c2f50288da9e5a85995184c60bb2b94bdce35dd9',
    '0ee5103fbe521b9c5ea577716d67b155f14f9e11',
    'c9681105dd96ab31a8a709eeb61242ad5ad60cae', SOURCE]
for parent, child in zip(source_chain, source_chain[1:]):
    assert git('rev-parse', child + '^').decode().strip() == parent
index = {}
for row in git('ls-files', '--stage', '-z').split(b'\0'):
    if row:
        meta, p = row.split(b'\t'); mode, oid, stage = meta.decode().split()
        assert stage == '0'; index[p.decode()] = (mode, oid)
before, candidate = tree(BASE), tree(SOURCE)
paths = load(E/'source-paths.json')
assert [p for p in sorted(set(before)|set(candidate))
        if before.get(p) != candidate.get(p) and not p.startswith('scratch/')] == paths
for p in paths:
    assert index[p] == candidate[p]
    assert git('hash-object', p).decode().strip() == candidate[p][1]
    assert sha(R/p) == hashlib.sha256(git('show', SOURCE+':'+p)).hexdigest()
allowed = set(paths)
for p in set(before)|set(index):
    if before.get(p) != index.get(p):
        assert p in allowed or p.startswith(str(E.relative_to(R))+'/') or p in {
            'scratch/runs/20261022-shadow-man-dsetup-census-fullmodule/REVIEW.md',
            'docs/re-notes/shadow-man-dsetup-qualified-20261022.md'}, p
assert set(before) <= set(index), 'unrelated sparse absences must stay in index'
manifest = load(pathlib.Path('/home/user/wine-assembly-shadow-man-static-dx-harness-qualification-oct22')/
    'scratch/runs/20261022-shadow-man-static-dx-harness-qualification/remote-evidence/build-inputs.json')
assert manifest['revision'] == SOURCE and len(manifest['inputs']) == 3426
for row in manifest['inputs']:
    assert index[row['path']] == (row['mode'], row['blob']), row['path']

# Verify all committed donor evidence against exact evidence commit blob IDs.
# Resource/verification/publication outputs that were deliberately untracked
# remain live receipts, not silently substituted for committed acceptance.
associations = []
for name, commit in evidence:
    donor = pathlib.Path('/home/user/wine-assembly-shadow-man-'+name+'-oct22')
    de = donor/('scratch/runs/20261022-shadow-man-'+name)
    rows = []
    for p, (mode, oid) in tree(commit).items():
        if p.startswith(str(de.relative_to(donor))+'/'):
            f = donor/p; b = f.read_bytes()
            live_oid = hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
            changed_metrics = []
            if live_oid != oid:
                # Coordinator replays refresh only these resource measurements.
                # Compare to actual committed bytes, retaining the distinction.
                assert f.name in {'resources.json', 'verification.json'}, p
                committed = json.loads(git('show', commit+':'+p)); live = json.loads(b)
                changed_metrics = sorted(k for k in set(committed)|set(live)
                                         if committed.get(k) != live.get(k))
                assert set(changed_metrics) <= {'hostFree','total','amounts',
                    'localAllocated','localAllocatedByPath','localAllocatedTotal',
                    'localSizes','resources'}, (p, changed_metrics)
                if 'resources' in changed_metrics:
                    a, z = committed['resources'], live['resources']
                    assert {k:v for k,v in a.items() if k not in {'amounts','total','hostFree'}} == {
                        k:v for k,v in z.items() if k not in {'amounts','total','hostFree'}}
            rows.append(dict(path=p, committedBlob=oid, liveSHA256=sha(f),
                             refreshedResourceFields=changed_metrics))
    assert rows
    associations.append(dict(task=name, commit=commit, root=str(de), files=rows))

# Six accepted verifiers are strictly offline. The earlier independent
# verifier executes source fixtures, so reuse its committed five-check receipt.
ind = pathlib.Path(associations[0]['root'])
checks = load(ind/'checks.json')
assert len(checks) == 5 and all(r['exit'] == 0 for r in checks)
repair = pathlib.Path('/home/user/wine-assembly-shadow-man-dsetup-native-version-repair-oct22')/'scratch/runs/20261022-shadow-man-dsetup-native-version-repair'
assert len(load(repair/'checks.json')) == 23
assert all(r['exit'] == 0 for r in load(repair/'checks.json'))
assert len(load(repair/'mutation-results.json')) == 4
assert all(r['exit'] != 0 and 'AssertionError' in r['stderr'] for r in load(repair/'mutation-results.json'))
replays = []
original_write = pathlib.Path.write_text
for row in associations[1:]:
    de = pathlib.Path(row['root']); target = E/'replayed'/row['task']
    target.mkdir(parents=True, exist_ok=True)
    def redirected(p, data, *args, **kwargs):
        assert p.parent == de, str(p)
        return original_write(target/p.name, data, *args, **kwargs)
    output = io.StringIO()
    try:
        pathlib.Path.write_text = redirected
        with contextlib.redirect_stdout(output):
            runpy.run_path(str(de/'verify.py'), run_name='__main__')
    finally:
        pathlib.Path.write_text = original_write
    replays.append(dict(task=row['task'], result='PASS', verifierSHA256=sha(de/'verify.py')))
    (target/'stdout.json').write_text(output.getvalue())

commands = [
    ['node', 'test/test-directx-registry-metadata.js'],
    ['node', 'test/test-storage-registry.js'],
    ['node', str(E/'integration-checks.cjs')],
    ['node', 'ops/check-run-evidence.js', str(R)],
]
results = []
for command in commands:
    p = subprocess.run(command, cwd=R, env=ENV, capture_output=True, text=True, timeout=30)
    results.append(dict(command=command, exit=p.returncode, stdout=p.stdout, stderr=p.stderr))
    (E/'checks.json').write_text(json.dumps(results,indent=2)+'\n')
    assert p.returncode == 0, results[-1]
for p, digest in load(E/'protected-git-before.json').items():
    f = pathlib.Path(p); assert (sha(f) if f.exists() else None) == digest, p
adm = load(E/'admission.json')
sizes = {p:int(subprocess.check_output(['du','-s','-B1',p]).split()[0]) for p in [*adm['sizes'],str(R)]}
free = os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
assert sum(sizes.values())+8388608+1048576 < 67108864
assert free >= 2982150144
(E/'acceptance-associations.json').write_text(json.dumps(associations,indent=2)+'\n')
(E/'checks.json').write_text(json.dumps(results,indent=2)+'\n')
out = dict(verdict='PASS scoped source integration',base=BASE,source=SOURCE,
    sourcePaths=paths,qualifiedClosureInputs=3426,allBasePathsPreserved=len(before),
    offlineVerifierReplays=replays,cheapCommandExits=[r['exit'] for r in results],
    reusedIndependentChecks=5,reusedRepairChecks=23,reusedRepairRejects=4,
    newBuilds=0,newSourceCompiles=0,newRuntimeInstances=0,
    canonicalPrimarySHA256='ccd5b0a8e4fcb84d06bf539c8a4af28b377472072f3422750122048e9339f553',
    installedRegistry='UNKNOWN',gameplay='NOT QUALIFIED',
    protectedGit='UNCHANGED',localSizes=sizes,localAllocated=sum(sizes.values()),
    reserve=8388608,publicationAllowance=1048576,cap=67108864,hostFree=free)
(E/'verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out,indent=2))

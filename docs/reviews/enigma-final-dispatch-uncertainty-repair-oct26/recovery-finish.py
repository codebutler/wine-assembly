from common import *
E=R/'docs/reviews'/H.name
source=R/'tools/enigma-presented-menu-controller.cjs'
base=g('show',REV+':tools/enigma-presented-menu-controller.cjs')
now=source.read_bytes()
# Atomic branch, wireRunner and all presentation helpers remain byte-identical.
prefix=b'function createController(ask, filename) {'
assert base.split(prefix)[0]==now.split(prefix)[0]
save('source-relation.json',dict(base=REV,baseTree=g('rev-parse',REV+'^{tree}').decode().strip(),unchangedPrefixSHA256=sha(base.split(prefix)[0]),relation='All code before createController byte-identical: ATOMIC_BRANCH, wireRunner, presentation/readback/cleanup helpers and trust contract unchanged',sourceHashes={str(p.relative_to(R)):sha(p.read_bytes()) for p in [source,R/'test/test-enigma-presented-menu-controller.cjs',R/'test/fixtures/enigma-presented-menu-contract.json']},runner=json.load(open(D.parent/'ops/runner-git-identity.json')),priorGroupsRetained=[45,24,9],newGroups=dict(unit=10,independentProtocol=20,scopeDiagnostic=1),remaining='Fresh independent acceptance; coordinator integration; exact tracked test/run.js compatibility UNPROVEN; separate queue/runtime/delivery/gameplay qualification'))
assert g('ls-tree',REV,'test/run.js').decode().split()[2]=='4b8461338f4bcddde6b5d5504991523b28d3ac35'
# Preserve exact unchanged review/challenge/fixture identities rather than copy them.
prior=R/'docs/reviews/enigma-atomic-click-independent-accept-oct26'
save('retained-inputs.json',dict(priorManifestSHA256=sha((prior/'evidence-manifest.json').read_bytes()),fixtures={str(p.relative_to(R)):sha(p.read_bytes()) for p in [prior/'challenges.cjs',prior/'fixture.cjs',prior/'unchanged-before-oracle.cjs']},priorResultsSHA256=sha((prior/'results.json').read_bytes()),pinnedRunner=dict(path='/tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js',sha256='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809',gitBlob='423b40d4c00f01e3dbfa9ba1bcfdcfa249d07e2e',access='standing read-only input; not copied'),standingNode=dict(path=NODE,bytes=pathlib.Path(NODE).stat().st_size,sha256=hashlib.file_digest(open(NODE,'rb'),'sha256').hexdigest()),donor=dict(path=str(D),access='immutable read-only; required bounded objects copied and charged; no links/alternates retained')))
gate('prepublication')
for name in ['common.py','setup.py','finish.py']:
 shutil.copyfile(O/name,E/('supervisor.py' if name=='common.py' else 'recovery-'+name))
for name in ['configuration.json','node-startup.json','checkout.json','pins.json','source-relation.json','retained-inputs.json','checkpoint-unit.json','checkpoint-independent.json','incidents.json','admission-initial.json','admission-checkout.json','admission-focused-tests.json','admission-review.json','admission-prepublication.json']:
 shutil.copyfile(O/name,E/name)
print('Evidence identity/relation PASS')

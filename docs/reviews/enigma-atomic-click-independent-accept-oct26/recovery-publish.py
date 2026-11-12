from common import *
import signal
E=R/'docs/reviews'/H.name
gate('prepublication')
runner=pathlib.Path('/tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js').read_bytes()
row=g('ls-tree',REV,'test/run.js').decode().strip();oid=row.split()[2]
fixtureBlob=hashlib.sha1(b'blob '+str(len(runner)).encode()+b'\0'+runner).hexdigest()
assert fixtureBlob=='423b40d4c00f01e3dbfa9ba1bcfdcfa249d07e2e' and sha(runner)=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
save('runner-git-identity.json',dict(candidate=REV,path='test/run.js',candidateGitBlob=oid,testedPinnedRunnerBlob=fixtureBlob,relation='DIFFERENT: exact pinned donor runner only; candidate tracked runner compatibility NOT proven',sha256=sha(runner),bytes=len(runner),drainLines=[7545,7558],parserLines=[1929,2452],handlerLines=[7207,7384]))
with open(NODE,'rb') as f:nodehash=hashlib.file_digest(f,'sha256').hexdigest()
save('standing-inputs.json',dict(node=dict(path=NODE,sha256=nodehash,bytes=pathlib.Path(NODE).stat().st_size),donors=[dict(path=str(D),allocatedBytes=alloc(D),access='read only'),dict(path='/tmp/enigma-presented-controller-independent-accept-oct26/repo',access='read only'),dict(path='/tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js',bytes=len(runner),sha256=sha(runner),access='read only')],rootRefReceipt=json.load(open(ROOT/'scratch/usage-watch'/H.name/'root-ref-digest.json'))))
save('incidents.json',[
 dict(kind='resource denial',evidence='first-resource-denial.json',action='stopped acceptance until actual measured memory recovery; fresh admission passed'),
 dict(kind='ordinary internal capture error',error='FileExistsError at verify.py E.mkdir after pins saved; exit1',resolution='mkdir exist_ok; retained/reused all completed exact-revision pin checks'),
 dict(kind='checkpoint name collision',error='recovered verification admission replaced original failure filename',resolution='first exact failing measured diagnostic retained from tool output in first-resource-denial.json'),
 dict(kind='genuine runner identity mismatch',evidence='runner-identity-first-mismatch.json',error='candidate test/run.js blob4b846133 differs tested pinned donor blob423b40d4; publication identity assertion rejected',resolution='kept rejection; explicitly qualified runner evidence as pinned donor only, no compatibility claim or hash weakening'),
 dict(kind='missing immutable source object',error='root git cat-file blob4b846133 exit128 bad file',resolution='retained first diagnostic; no repeated lookup/acquisition needed for evidence-only rejection; candidate tracked runner acceptance remains unproven'),
])
for name in ['pins.json','checkpoint-inputs.json','checkpoint-focused.json','node-startup.json','configuration.json','checkout.json','first-resource-denial.json','admission-initial.json','admission-checkout.json','admission-verification.json','admission-focused-tests.json','admission-prepublication.json','runner-git-identity.json','runner-identity-first-mismatch.json','standing-inputs.json','incidents.json','failures.jsonl']:
 shutil.copyfile(O/name,E/name)
for name in ['common.py','setup.py','verify.py','build-fixture.py','test.py','publish.py']:
 shutil.copyfile(O/name,E/('supervisor.py' if name=='common.py' else 'recovery-'+name))
g('add','--sparse',str(E.relative_to(R)));g('diff','--cached','--check')
delta=g('diff','--cached','--name-only').decode().splitlines();assert delta and all(x.startswith('docs/reviews/'+H.name+'/') for x in delta)
manifest={str(p.relative_to(R)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(E.iterdir()) if p.is_file() and p.name!='evidence-manifest.json'}
(E/'evidence-manifest.json').write_text(json.dumps(dict(candidate=REV,testedTree=json.load(open(O/'pins.json'))['candidateTree'],verdict='REJECT_FALSE_NO_CLICK_AFTER_ATOMIC_ENQUEUE',files=manifest),indent=2)+'\n')
g('add','--sparse',str(E.relative_to(R)));g('diff','--cached','--check')
tree=g('write-tree','--missing-ok').decode().strip()
diff=g('diff-tree','--no-commit-id','--name-only','-r',REV,tree).decode().splitlines();assert diff and all(p.startswith('docs/reviews/'+H.name+'/') for p in diff)
commit=g('commit-tree',tree,'-p',REV,input=b'review: reject Enigma false no-click report after atomic enqueue\n').decode().strip()
g('update-ref','refs/heads/'+BR,commit,REV)
g('push','origin','HEAD:refs/heads/'+BR)
remote=g('ls-remote','origin','refs/heads/'+BR).decode().strip();assert remote==commit+'\trefs/heads/'+BR
for p,v in manifest.items():assert sha(g('show',commit+':'+p))==v['sha256']
assert not g('status','--porcelain').strip()
gate('published')
receipt=dict(verdict='REJECT_FALSE_NO_CLICK_AFTER_ATOMIC_ENQUEUE',candidate=REV,commit=commit,branch=BR,remote=remote,verified=True,testedTree=json.load(open(O/'pins.json'))['candidateTree'],publishedTree=tree,treeRelation='candidate production byte-identical; only independent review directory added',sourceHashes=json.load(open(O/'pins.json'))['sourceHashes'],fixtureHashes=json.load(open(O/'checkpoint-focused.json'))['fixtureHashes'],manifest=str(E/'evidence-manifest.json'),manifestSHA256=sha((E/'evidence-manifest.json').read_bytes()),results=dict(cases=21,protocolScenarios=20,diagnosticScenarios=1,blockingFailures=1,retainedPriorGroups=[45,24,9],newGuestExecutions=0),resources=json.load(open(O/'admission-published.json')),incidents=json.load(open(O/'incidents.json')),remaining='Minimal final-outcome-report repair; affected independent acceptance; coordinator integration; separate runtime queue/wiring/delivery/gameplay qualification. No integration authorized by this rejection.',box=dict(id=None,state='unassigned/not contacted',expiry=None,lifecycleOwner='coordinator'))
save('final-receipt.json',receipt)
os.kill(json.load(open(O/'watcher.json'))['pid'],signal.SIGTERM)
print(json.dumps(receipt))

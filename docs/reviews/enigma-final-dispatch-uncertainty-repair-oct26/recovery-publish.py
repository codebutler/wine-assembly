from common import *
import signal
E=R/'docs/reviews'/H.name
gate('publication')
# Recover sparse setup with the exact independent-review pattern that was
# corrected before any test in the original run.
p=O/'setup.py';s=p.read_text();needle="+'/docs/reviews/enigma-atomic-click-independent-accept-oct26/\\n'"
# Keep the original setup and explicitly retain its in-task correction recipe.
(E/'recovery-sparse-correction.py').write_text("from supervisor import *\np=R/'.git/info/sparse-checkout'\np.write_text(p.read_text()+'/docs/reviews/enigma-atomic-click-independent-accept-oct26/\\n')\ng('read-tree','-mu','HEAD')\n")
(E/'first-sparse-failure.txt').write_text("First verification exit1 before tests: FileNotFoundError: [Errno 2] No such file or directory: '/tmp/enigma-final-dispatch-uncertainty-repair-oct26/repo/docs/reviews/enigma-atomic-click-independent-accept-oct26/README.md'\nAt (R/p).read_bytes(), pathlib.read_bytes/open. Required immutable objects were present; sparse checkout pattern missing. Corrected once in same task; verification passed.\n")
for n in ['test.py','publish.py']:shutil.copyfile(O/n,E/('recovery-'+n))
shutil.copyfile(O/'admission-publication.json',E/'admission-publication.json')
# Check exact completed-group source and evidence identities; no test replay.
sourceHashes=json.load(open(O/'source-relation.json'))['sourceHashes']
for p,h in sourceHashes.items():assert sha((R/p).read_bytes())==h,p
for group,result in [('unit','focused-unit-results.txt'),('independent','unchanged-independent-results.json')]:
 checkpoint=json.load(open(O/('checkpoint-'+group+'.json')))
 assert sha((E/result).read_bytes())==checkpoint['evidenceSHA256']
 for p,h in checkpoint['sourceHashes'].items():assert sha((R/p).read_bytes())==h
unit=(E/'focused-unit-results.txt').read_text();assert '"pass":10' in unit
results=json.load(open(E/'unchanged-independent-results.json'));assert results['verdict']=='REVIEW'
manifest=dict(base=REV,verdict='REPAIRED_PENDING_INDEPENDENT_ACCEPTANCE',sourceHashes=sourceHashes,files={str(p.relative_to(R)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(E.iterdir()) if p.is_file() and p.name!='evidence-manifest.json'})
(E/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
owned=['tools/enigma-presented-menu-controller.cjs','test/test-enigma-presented-menu-controller.cjs','docs/reviews/'+H.name]
g('add','--sparse',*owned);g('diff','--cached','--check')
tree=g('write-tree','--missing-ok').decode().strip()
delta=g('diff-tree','--no-commit-id','--name-only','-r',REV,tree).decode().splitlines()
assert delta and all(p in owned[:2] or p.startswith(owned[2]+'/') for p in delta)
commit=g('commit-tree',tree,'-p',REV,input=b'fix: report unknown Enigma enqueue outcome after final dispatch\n').decode().strip()
g('update-ref','refs/heads/'+BR,commit,REV)
g('push','origin','HEAD:refs/heads/'+BR)
remote=g('ls-remote','origin','refs/heads/'+BR).decode().strip();assert remote==commit+'\trefs/heads/'+BR
for p,v in manifest['files'].items():assert sha(g('show',commit+':'+p))==v['sha256']
for p,h in sourceHashes.items():assert sha(g('show',commit+':'+p))==h
assert not g('status','--porcelain').strip()
gate('published')
receipt=dict(verdict=manifest['verdict'],base=REV,commit=commit,branch=BR,remote=remote,verified=True,baseTree=g('rev-parse',REV+'^{tree}').decode().strip(),publishedTree=tree,treeRelation='only owned controller, focused regression file and repair review directory differ from exact independent review base; atomic branch and all helpers before createController unchanged',changedPaths=delta,sourceHashes=sourceHashes,manifest=str(E/'evidence-manifest.json'),manifestSHA256=sha((E/'evidence-manifest.json').read_bytes()),evidenceHashes={p:v['sha256'] for p,v in manifest['files'].items()},results=dict(focusedUnit=10,unchangedIndependentProtocol=20,scopeDiagnostic=1,retainedPriorGroups=[45,24,9],guestExecutions=0),resources=json.load(open(O/'admission-published.json')),incidents=json.load(open(O/'incidents.json')),remaining=json.load(open(O/'source-relation.json'))['remaining'],runner=json.load(open(O/'source-relation.json'))['runner'],box=dict(id=None,state='unassigned/not contacted',expiry=None,lifecycleOwner='coordinator'),ownership='released after verified task-branch publication; STOP')
save('final-receipt.json',receipt)
os.kill(json.load(open(O/'watcher.json'))['pid'],signal.SIGTERM)
print(json.dumps({k:receipt[k] for k in ['verdict','commit','branch','remote','publishedTree','manifestSHA256','resources','remaining']}))

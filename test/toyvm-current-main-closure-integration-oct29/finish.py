import integrate as s
import json,pathlib,sys,ctypes,copy
s.configure_parent();ctypes.CDLL(None).prctl(36,1,0,0,0)
s.BASE=json.loads((s.OWN/'baseline.json').read_bytes());s.SEQ=sum(1 for _ in (s.OWN/'operations.jsonl').open())
PROD=['test/toyvm-bounded24-caller-wiring-oct28/qualify_accounted.py','test/toyvm-bounded24-caller-wiring-oct28/validate_receipt_offline.py']
PUB='test/'+s.TASK
def main():
    deps=json.loads((s.OWN/'dependency-review.json').read_bytes());assert all(v['matches'] for v in deps['backendPins'].values())
    # Verify exact candidate bytes; source review is restricted to the two production additions.
    for p,pin in s.D['sourcePins'].items():
        b=s.git('show',s.D['candidate']+':'+p);assert s.sha(b)==pin['sha256'] and b==(s.REPO/p).read_bytes()
    allpub=s.D['publicationPaths']
    existing=s.git('ls-tree',s.D['currentMain'],'--',*allpub).decode().splitlines()
    present={line.split('\t')[1]:line.split()[2] for line in existing}
    added=[]
    for p in allpub:
        if p in present:
            assert s.sha(s.git('show',present[p]))==s.D['publicationPins'][p]['sha256'],'divergent accepted evidence '+p
        else:added.append(p)
    s.write('integration-plan.json',dict(base=s.D['currentMain'],production=PROD,acceptedEvidenceMissing=added,acceptedEvidenceAlreadyIdentical=len(present),historicalTestsReused=[14,53,72,52],excludedSourceTests=list(set(s.D['sourcePins'])-set(PROD)),reason='Historical runners require absent task-specific mutable supervisors; do not execute or integrate those unaccepted dependencies. Exact accepted independent recipe/evidence is retained instead.'))
    s.mutate('config','user.name','Wine Ops')
    s.mutate('config','user.email','wine-ops@users.noreply.github.com')
    s.mutate('config','core.sparseCheckout','true')
    s.mutate('config','core.sparseCheckoutCone','false')
    s.mutate('config','index.sparse','true')
    s.mutate('update-ref','refs/heads/task/'+s.TASK,s.D['currentMain'])
    s.admit('write-sparse-patterns');info=s.REPO/'.git/info';info.mkdir(exist_ok=True)
    (info/'sparse-checkout').write_text('\n'.join('/'+p for p in [*PROD,*allpub,PUB+'/REPORT.md'])+'\n')
    s.mutate('read-tree',s.D['currentMain'])
    # No broad checkout: materialize only reviewed production/evidence from exact objects.
    for p in PROD:
        b=s.git('show',s.D['candidate']+':'+p);assert s.sha(b)==s.D['sourcePins'][p]['sha256'];s.admit('materialize-production');(s.REPO/p).write_bytes(b)
    # Existing supplied acceptance files were verified at startup; prove commit binding in one exact tree query.
    accepted=s.git('ls-tree',s.D['acceptedEvidenceCommit'],'--',*allpub).decode().splitlines()
    assert len(accepted)==133
    bindings={line.split('\t')[1]:line.split()[2] for line in accepted}
    for p in allpub:
        # Git blob binding is computed locally without spawning 133 redundant show commands.
        b=(s.REPO/p).read_bytes();assert __import__('hashlib').sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==bindings[p]
    fixture=s.OWN/'input.json';repro=s.REPO/'test/toyvm-nonfinite-repair-independent-accept-oct29/unchanged-reproducer.json'
    original=repro.read_bytes();base=json.loads(original);base.pop('metadata',None)
    limits=dict(live_limit=32768,write_limit=65536,file_limit=16384,rss_limit=134217728,cpu_limit=1.25,wall_limit=2.5,output_limit=4096)
    results=[]
    def check(name,raw,exit,*,target=None):
        s.admit('fixture-'+name);fixture.write_bytes(raw)
        argv=['/usr/bin/python3','-B',str(target or s.REPO/PROD[1]),'--result-json',str(fixture)]
        for k,v in limits.items():argv+=['--'+k.replace('_','-'),str(v)]
        out=s.run(argv,cwd=s.REPO,expect=exit,label=name);r=json.loads(out)
        assert r['accepted'] is (exit==0) and r['offlineValidationOnly'] is True and r['runtimeQualified'] is False
        assert len(out)<=4096 and 'backendReceipt' not in r
        results.append(dict(name=name,expectedExit=exit,inputSHA256=s.sha(raw),decision=r,argv=argv,sourceSHA256=s.sha(pathlib.Path(argv[2]).read_bytes())))
    # Earliest production boundary, exact unchanged reproducer first.
    check('integrated-unchanged-1e999',original,2)
    check('integrated-valid-control',json.dumps(base).encode(),0)
    bad=copy.deepcopy(base);bad['filesystemCleanup']['unmountExit']=False
    check('integrated-boolean-unmount',json.dumps(bad).encode(),1)
    mutant=s.OWN/'mutation';s.admit('create-mutation');mutant.mkdir()
    source=(s.REPO/PROD[1]).read_bytes();changed=source.replace(b', parse_float=finite_float',b'');assert changed!=source
    (mutant/'validate_receipt_offline.py').write_bytes(changed);(mutant/'qualify_accounted.py').write_bytes((s.REPO/PROD[0]).read_bytes())
    check('old-parser-mutant-killed',original,0,target=mutant/'validate_receipt_offline.py')
    assert results[-1]['decision']['accepted'] is True # Oracle requires exit 2; mutant incorrectly accepts.
    for p in mutant.iterdir():p.unlink()
    mutant.rmdir();fixture.unlink()
    s.write('focused-results.json',dict(PASS=True,productionChecks=3,mutationKilled=True,records=results,priorGroupsReused=[14,53,72,52],runtimeQualified=False))
    s.admit('prepare-report');pub=s.REPO/PUB;pub.mkdir(parents=True,exist_ok=True)
    report=f'''# Current-main offline ToyVM receipt integration\n\nBase main: {s.D['currentMain']}. Accepted candidate: {s.D['candidate']}. Independent acceptance publication: {s.D['acceptedEvidenceCommit']}.\n\nAdds only the byte-identical accepted offline validator and pinned production caller. All four caller backend dependencies already on main match their exact SHA-256 pins. No historical task tree or unaccepted test-supervisor dependency is applied. The historical standalone regression/test files are not integrated because their task-specific supervisors are absent; their unchanged accepted 14 + mutation and prior 53/72/52 results are reused by exact source pins.\n\nThe exact unchanged 1e999 receipt first reached the integrated production CLI and exited 2. A valid receipt exited 0, and boolean unmount exited 1. Removing parse_float=finite_float in an isolated copy caused the original overflow receipt to exit 0, killing the mutant under the expected-exit-2 oracle. See focused-results.json for exact argv, source/input pins and decisions.\n\nAccepted evidence files: {len(added)} additions, {len(present)} already identical. The 133 files are bound to exact publication Git blobs and dispatch SHA-256 pins. They retain original resource/publication incidents and limitations. Offline decisions describe supplied data only. Live CLI/backend/FUSE/browser qualification remains OPEN; runtimeQualified=false. No runtime allowance reset or public deployment. No box assigned; lifecycle owner remains coordinator.\n\nRecipe: task-owned integrate.py, continue.py and finish.py execute in /tmp/{s.TASK}; all subprocesses use keyword-only validated owned cwd, exact Git -C, identity validation before mutations, trusted SSH, fresh disk/RAM admission and prescribed limits. The empty canonical mount-parser receipt is reused by exact parser excerpt hash. A local wrapper initially compared its parser-excerpt hash to the full runner file, stopped before production checkout, and was corrected to the receipt's exact extraction range; no resource/access rejection occurred. Shared root/index/refs and donor configuration are read-only. Root-ref initial receipt is retained.\n'''
    (pub/'REPORT.md').write_text(report)
    for n in ['integration-plan.json','dependency-review.json','source-trees.json','focused-results.json','baseline.json','controls.json','mount-configuration.json']:(pub/n).write_bytes((s.OWN/n).read_bytes())
    for n in ['integrate.py','continue.py','finish.py','limit_contract.py']:(pub/n).write_bytes((s.OWN/n).read_bytes())
    paths=[*PROD,*added,*[str(p.relative_to(s.REPO)) for p in pub.iterdir()]]
    s.write('stage-paths.json',paths)
    s.mutate('add','--sparse','--',*paths)
    review=s.git('diff','--cached','--stat').decode();s.write('staged-review.json',dict(stat=review))
    staged=s.git('diff','--cached','--name-only').decode().splitlines();assert sorted(staged)==sorted(paths)
    s.git('diff','--cached','--check')
    s.mutate('commit','-m','Integrate accepted offline ToyVM receipt validator and nonfinite rejection')
    commit=s.git('rev-parse','HEAD').decode().strip();assert s.git('rev-parse','HEAD^').decode().strip()==s.D['currentMain']
    s.write('commit.json',dict(commit=commit,beforeMain=s.D['currentMain']))
    s.mutate('push',URL,'HEAD:refs/heads/task/'+s.TASK)
    witness=s.git('ls-remote',URL,'refs/heads/task/'+s.TASK).decode().strip();assert witness.split()[0]==commit
    s.write('task-remote.json',dict(commit=commit,witness=witness))
    # Ordinary non-force push is authorized only after exact review and checks. A moved main rejects safely.
    s.mutate('push',URL,'HEAD:refs/heads/main')
    mainWitness=s.git('ls-remote',URL,'refs/heads/main').decode().strip();assert mainWitness.split()[0]==commit
    s.write('canonical-receipt.json',dict(task=s.TASK,status='INTEGRATED_VERIFIED',beforeMain=s.D['currentMain'],afterMain=commit,branch='task/'+s.TASK,taskRemoteWitness=witness,mainRemoteWitness=mainWitness,sourcePins={p:s.D['sourcePins'][p] for p in PROD},acceptedPublication=s.D['acceptedEvidenceCommit'],acceptanceCanonicalSHA256=s.sha(pathlib.Path(s.D['canonicalAcceptance']).read_bytes()),tests=json.loads((s.OWN/'focused-results.json').read_bytes()),cleanup=dict(runtimeUsed=False,testBox=None,fixturesRemoved=True,operationGroupsCleaned=True,lifecycleOwner='coordinator'),allocationRetainedThroughCoordinatorCloseout=True,finalAdmission=s.admit('final')))
    (s.OWN/'publication-note.txt').write_text(f'{s.stamp()} {s.TASK}: INTEGRATED_VERIFIED main {s.D["currentMain"]} -> {commit}; task/{s.TASK} remote exact SHA verified. Focused CLI 1e999 rejection/valid acceptance/bool cleanup rejection passed; old-parser mutation killed; prior14/53/72/52 reused. Canonical: {s.OWN}/canonical-receipt.json. Offline only; runtime/FUSE/browser gap OPEN. No box assigned. Allocation retained; coordinator closeout/board delivery.\n')
    print(json.dumps(dict(status='INTEGRATED_VERIFIED',commit=commit,mainWitness=mainWitness)))
if __name__=='__main__':
    try:main()
    except Exception as ex:
        s.write('blocked-receipt.json',dict(at=s.stamp(),status='BLOCKED',error=str(ex),task=s.TASK,runtimeUsed=False,allocationRetainedThroughCoordinatorCloseout=True));(s.OWN/'publication-note.txt').write_text(f'{s.TASK} BLOCKED: {str(ex)[:1000]}; receipt {s.OWN}/blocked-receipt.json. No runtime/box. Allocation retained.\n');print(str(ex)[:2000]);sys.exit(1)

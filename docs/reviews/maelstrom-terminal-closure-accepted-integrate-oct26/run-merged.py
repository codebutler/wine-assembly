from control import *
limits()
inputs=json.loads(read(O/'merged-inputs.json'));T=inputs['testedTree']
repro='docs/reviews/maelstrom-state-acceptance-retained-closeout-oct26/remaining-independent.cjs'
scalar='test/maelstrom-adapter-scalar-anchor.test.cjs'
groups=[('repair-26',repro,dict(groups=26,cases=74)),('regression68','test/maelstrom-terminal-callback-closure.test.cjs',dict(cases=68)),('independent174',str(O/'challenge.cjs'),dict(cases=174)),('scalar13',scalar,dict(groups=13,cases=3748)),('ten',str(O/'status-event-independent.cjs'),dict(groups=10)),('nineteen',str(O/'independent.cjs'),dict(groups=19)),('semantic7','test/maelstrom-status-event-validation.test.cjs',dict(groups=7,cases=924)),('adapter7','test/maelstrom-original-errno-adapter.cjs',dict(groups=7)),('rejection14','test/maelstrom-native-latch-rejection.test.cjs',dict(groups=14,failureCombinations=511))]
remaining=[g[0] for g in groups]+['retained-unaffected','publication','cleanup']
for label,p,result in groups:
 for name,h in inputs['pins'].items():assert sha(R/name)==h,(label,name)
 assert git('pre-tree-'+label,'write-tree')==T
 out=run(label,['node',p])
 if label=='repair-26':
  q=R/pathlib.Path(repro).parent/'remaining-results.json';v=json.loads(read(q));assert(v['passed'],v['failed'],v['cases'])==(26,0,74)
  shutil.copyfile(q,O/'repair-26-results.json')
  git('restore-historical-failure-receipt','restore','--worktree','--source=bbcc8685a900c1714e11b2eda4b7ac99f3d6f105','--',str(q.relative_to(R)))
 if label in ['ten','nineteen','independent174']:
  q=O/({'ten':'status-event-results.json','nineteen':'independent-results.json','independent174':'challenge-results.json'}[label]);v=json.loads(read(q))
  assert v['failed']==0
  assert v['passed']==result.get('groups',result.get('cases'))
 if label=='scalar13':assert '3748' in out and '13' in out
 if label=='regression68':assert '68' in out
 if label=='semantic7':assert '924' in out
 if label=='rejection14':assert '511' in out
 assert git('post-tree-'+label,'write-tree')==T
 remaining.remove(label);checkpoint(label,dict(**result,failed=0,passAll=True),[p],list(remaining))
 print(label,'PASS',json.dumps(result),flush=True)
u=inputs['unaffected']
for p,h in u['inputPins'].items():assert sha(pathlib.Path(p) if p.startswith('/') else R/p)==h
assert sha('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/source-inputs.json')==u['standingSourceManifest']
manifest=json.loads(read('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/source-inputs.json'))
standing=[]
for f in manifest['files']:
 p=pathlib.Path('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/pinned-source')/f['path'];assert sha(p)==f['sha256'];standing.append(dict(path=str(p),sha256=sha(p),bytes=p.stat().st_size,allocated=blocks(p)))
for p in [pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25/vfs/maelstrom')/n for n in ['Maelstrom.exe','SDL_net.dll']]+[pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25/runtime/system/msvcrt.dll')]:
 standing.append(dict(path=str(p),sha256=sha(p),bytes=p.stat().st_size,allocated=blocks(p)))
dump(O/'standing-source.json',standing)
dump(O/'standing-tools.json',{p:dict(realpath=os.path.realpath(p),sha256=sha(os.path.realpath(p)),allocated=blocks(pathlib.Path(os.path.realpath(p)))) for p in ['/usr/bin/node','/usr/bin/python3','/usr/bin/git']})
dump(O/'retained-unaffected.json',dict(**u,mergedTree=T,exactInputHashesVerified=True))
checkpoint('retained-unaffected',dict(groups=20,reused=True,passAll=True),[p for p in u['inputPins'] if not p.startswith('/')],['publication','cleanup'])
assert git('final-merged-tree','write-tree')==T
assert git('unstaged-after-tests','diff','--exit-code')==''
dump(O/'merged-results.json',dict(verdict='ACCEPT',candidate=inputs['candidate'],independentAcceptance=inputs['acceptance'],base=BASE,testedTree=T,pins=inputs['pins'],results={label:dict(**r,failed=0) for label,p,r in groups},reusedUnaffected20=True,fixtureReconciliation=inputs['fixtureReconciliation'],candidateFailures=0,remaining=['publication','cleanup']))
print('ALL MERGED SUITES PASS',T,json.dumps(gate('after-tests')))

import pathlib,json,hashlib,gzip,shutil,time
O=pathlib.Path(__file__).parent; R=O.parent/'repo'; d=json.loads((O/'readiness.json').read_text())
P=R/'reports/airstrike-accepted-input-observer-main-integrate-oct27'; P.mkdir(parents=True,exist_ok=True)
def sha(p):
 h=hashlib.sha256()
 with open(p,'rb') as f:
  for b in iter(lambda:f.read(65536),b''):h.update(b)
 return h.hexdigest()
changes=[l.split('\t')[1] for l in (O/'source-scope.stdout').read_text().splitlines()]
assert sorted(changes)==sorted(d['changedPaths'])
index={l.split('\t')[1]:l.split()[1] for l in (O/'source-index.stdout').read_text().splitlines()}
accepted={l.split('\t')[1]:l.split()[2] for l in (O/'accepted-blobs.stdout').read_text().splitlines()}
assert index==accepted
new=['node-startup','syntax-runner','syntax-trace','syntax-state','merged-state','merged-pins','pre-checkout-corrected','source-whitespace']
for n in new:
 r=json.loads((O/(n+'.json')).read_text()); assert r['exit']==0 and r['stopReason'] is None and r['cleanupComplete'],n
clock=pathlib.Path('/tmp/airstrike-input-consumption-observer-implementation-oct27/ops/clock-regression.json')
assert sha(clock)=='1782306b787f6525893f59e90d9a1b3839dfb1b7336a2739583f10dad71e335f'
cr=json.loads(clock.read_text());assert cr['exit']==0 and not cr['stopReason'] and cr['cleanupComplete']
shutil.copyfile(clock,P/'reused-clock-regression.json')
reuse=pathlib.Path('/tmp/airstrike-input-observer-independent-accept-oct27/ops/reuse-clock.json')
shutil.copyfile(reuse,P/'reused-clock-pins.json')
source=(R/'test/run.js').read_text(); regions=[]
for start,end in [('  const inputConsumptionTrace =','  // Every OTHER import table'),('  let lastInputEvent = null;','  let lastMouseTracePos ='),('  const controlSafeValue =','  const control = (CONTROL || CONTROL_STDIN)')]:
 a=source.index(start);b=source.index(end,a);raw=source[a:b].encode();regions.append(dict(start=start,end=end,utf8ByteStart=len(source[:a].encode()),bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest()))
tools={str(p):dict(realpath=str(pathlib.Path(p).resolve()),sha256=sha(p)) for p in ['/usr/local/bin/node','/usr/bin/python3','/usr/bin/git','/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py']}
payloads=[]
for p in sorted(O.iterdir()):
 if not p.is_file() or p.name in ('accepted-manifest.json','receipt-manifest.json') or p.name.startswith('board-watch') or p.name.startswith('package-report.'):continue
 if p.suffix in ('.json','.py','.js'):
  dest=P/p.name;shutil.copyfile(p,dest)
 elif p.suffix in ('.stdout','.stderr','.supervisor-output'):
  dest=P/(p.name+'.gz');dest.write_bytes(gzip.compress(p.read_bytes(),mtime=0))
 else:continue
 payloads.append(dict(path=dest.name,bytes=dest.stat().st_size,sha256=sha(dest),originalSHA256=sha(p)))
m=dict(verdict='PASS_MERGED_SOURCE_ONLY',candidate=d['candidate'],acceptedCommit='a5db83b10d153b2822ccde106a43107e9432ec33',mainParent=d['main'],changedPaths=d['changedPaths'],sourcePins=json.loads((O/'merged-pins.json').read_text()),acceptedGitBlobs=accepted,dependencyGitBlobs=(O/'main-dependencies.stdout').read_text(),productionExtraction=regions,tools=tools,independentAcceptance=dict(path=d['acceptanceManifest'],sha256=d['acceptanceSHA256'],publishedBranch='task/airstrike-input-observer-independent-accept-oct27',coordinatorVerifiedPayloadsReused=145,groups='production CLI/default-off/init/hooks/frozen-state/host-routing/hostile/counters/unknown-export/guard-omission',rerun=False),clockRegression=dict(receipt='reused-clock-regression.json',sha256=sha(clock),rerun=False),newChecks=new,resourcePolicy=dict(allocation=268435456,sourceIncrementalCeiling=1048576,fetchBytes=0,gitRSS=268435456,gitDataOnly=536870912,nodeRSS=805306368,nodeHeapFlag='--max-old-space-size=512',pythonRSS=134217728,cpu=90,wall=120,file=25165824,output=2097152,displayPerOperation=8192,cumulativeDisplay=1048576,pools='Git two permits plus flock /tmp/wine-ops-production-git.lock; Python/Node one permit',admission='per-operation *.admission.json; actual live clients only, full WAL once'),incidents=['Coordinator retained main-paths.stderr/json: ls-tree -rl required omitted blobs; never replayed here.','Initial own pre-checkout assertion incorrectly counted donor report paths as source changes. Failure retained; next tool orchestration prematurely performed reversible isolated checkout. Corrected scope requires exactly four non-report paths and verifies donor reports absent; exact remote and dependency checks had already passed. No source/dependency pin changed; all publication checks passed after correction.'],qualification='Instrumentation disabled by default and read-only. No guest execution; SDL completion and actual guest consumption remain unknown.',publication=dict(branch='task/airstrike-accepted-input-observer-main-integrate-oct27',remote='git@github.com:vgrichina/wine-assembly.git',main='conditional normal fast-forward after fresh remote-main equality',closeout=str(O/'publication-closeout.json'),selfHashCycle='External closeout binds exact commit/main/ref and this immutable canonical manifest SHA.'),cleanup=dict(supervisedOperations='all passing operations cleanupComplete; failed assertion also cleaned',watcher='owned session89549; final termination recorded in external closeout',runtimeBox=None,rootRefs='initial launcher stream digest reused; no root Git mutation operations'),payloads=payloads)
m['incidents'].extend(['Normal git commit failed building the index tree because an unchanged PNG blob intentionally omitted from the coordinator-filtered main store was unavailable. Original commit.stderr/stdout retained. No fetch or source change; use write-tree --missing-ok then compare exact resulting tree delta against main before commit-tree.', 'Initial tool orchestration continued after failed commit, so push-task published unchanged baseline 097f3b29 to the task branch only. Main untouched; no accepted-change publication claim from that push. Corrected execution checks every exit sequentially before dependencies and later normal push advances the task ref to the tested commit.'])
m['publication']['commitMethod']='write-tree --missing-ok preserves intentionally omitted unchanged blobs by identity; metadata-only diff-tree proves full current-main preservation; commit-tree with exact main parent then normal local update-ref and non-force remote pushes'
(O/'receipt-manifest.json').write_text(json.dumps(m,indent=2)+'\n');shutil.copyfile(O/'receipt-manifest.json',P/'receipt-manifest.json')
(P/'README.md').write_text('''# Accepted Airstrike observer integration

Integrates exactly four independently accepted source/test/doc files onto current main 097f3b2904d833ca8fb152e686032c156c16e39a. Other main tree entries are preserved; predecessor report trees are excluded.

The optional `--trace-input-dispatch` observer remains disabled by default and read-only. New affected merged checks: exact source/dependency identities, exact Node startup limits, three JS syntax checks, and the production-extracted input-consumption state test. Independent acceptance and the unchanged clock-domain regression are reused by immutable identity. No guest, SDL completion or actual game input consumption was proved.

`receipt-manifest.json` is the canonical receipt. Local external `publication-closeout.json` binds its hash to the final commit and exact verified remote task/main refs without a self-hash cycle. Diagnostic streams use lossless gzip; decompress with `gzip -dc FILE.gz`. Failed setup and corrected scope diagnostics are retained. No lazy fetch, donor mutation, full checkout, repack, deployment, compiler or runtime box.
''')
print(json.dumps(dict(canonicalSHA256=sha(O/'receipt-manifest.json'),payloads=len(payloads),reportBytes=sum(p.stat().st_size for p in P.iterdir() if p.is_file()),sourceScope=changes,acceptedBlobsMatch=True)))

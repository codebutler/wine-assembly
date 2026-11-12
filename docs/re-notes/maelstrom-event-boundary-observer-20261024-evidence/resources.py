import hashlib,json,pathlib,shutil,subprocess,sys,time
b=pathlib.Path('/tmp/maelstrom-event-triggered-boundary-observer-oct24');ops=b/'ops'
admission=json.loads((ops/'admission.json').read_text());reserve=8*1024*1024
def size(p):
 return sum(f.stat().st_size for f in p.rglob('*') if f.is_file()) if p.exists() else 0
thread='01a16ee0-5832-7d10-94b5-dbe1e9302f3a'
sessions=list(pathlib.Path('/home/user/.codex/sessions/2026/10/24').glob('*-'+thread+'.jsonl'))
assert len(sessions)==1
session=sessions[0];launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-event-triggered-boundary-observer-oct24')
current={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*') if p.is_file()}
positive=sum(max(0,n-admission['sqliteBaseline'].get(p,0)) for p,n in current.items())
charges={'ownedTreeGitOps':size(b),'sessionFull':session.stat().st_size,'launcherFull':size(launcher),
 'positiveSQLiteGrowth':positive,'temporaryCLIPeakAlreadyCleaned':2066301,
 'futurePublicationSessionSQLite':12*1024*1024,'reserve':reserve}
peak=sum(charges.values());free=shutil.disk_usage('/tmp').free
mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
assert peak<=64*1024*1024 and free-peak>=2982150144 and mem>=805306368
receipt=dict(at=time.time(),charges=charges,projectedPeak=peak,cap=64*1024*1024,
 free=free,afterConservativeFullPeak=free-peak,memAvailable=mem,passGate=True,
 session=str(session),launcher=str(launcher),sqliteNow=current,
 priorHistoricalPeakRetained=admission['priorHistoricalLedger']['peak'],
 priorLedger='admission.json retains entire prior resource ledger and historical read-accounting deficiency; unchanged read-only donors are standing inputs, not newly materialized task charges',
 priorNewOnlyCorrectionRetained='Prior reason8 ledger correction and every old charge/reserve preserved verbatim in admission priorHistoricalLedger; no retroactive qualification upgrade.',
 inspection='Narrow explicit Git blobs/paths and <=8192-byte code excerpts; full pinned inputs are read by the authorized transform/tests and digest verification, no broad tree listing or clone.',
 standingInputs=[dict(path=str(p),bytes=p.stat().st_size,readOnly=True) for p in
  [pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js'),pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/13-exports.wat'),
   pathlib.Path('/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm')]],
 tools=[dict(path=str(pathlib.Path(shutil.which(name)).resolve()),bytes=pathlib.Path(shutil.which(name)).resolve().stat().st_size,
  version=subprocess.check_output([name,'--version'],text=True).strip()) for name in ['node','git','python3']],
 resourceLimits=dict(nodeHeapMiB=256,cpuSeconds=60,wallSeconds=60,outputBytes=131072,perFileBytes=25165824,termKillReapSeconds=5),
 accessRejections=0,localCorrection='Packaging list-of-bytes join TypeError corrected once; failed receipt retained; no unchanged retry',
 cleanup=dict(cliTemporaryCopies='deleted after successful guards/syntax check',moduleReadOrLoaded=False,guests=0,boxesAccessed=0,workersSpawned=0))
(ops/'resource-final.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({'resource':'PASS','projectedPeak':peak,'cap':receipt['cap'],'free':free,'memAvailable':mem,'owned':charges['ownedTreeGitOps'],'session':charges['sessionFull'],'sqlitePositive':positive}))

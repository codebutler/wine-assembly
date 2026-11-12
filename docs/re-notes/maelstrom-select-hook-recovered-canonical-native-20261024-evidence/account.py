import pathlib,json,os,time,sys,hashlib,shutil
root=pathlib.Path(__file__).parent.parent;ops=root/'ops';h=pathlib.Path('/home/user/.codex')
def manifest(paths):
 seen=set();out=[]
 for p in paths:
  if not p.is_file() or p.is_symlink():continue
  s=p.stat();key=(s.st_dev,s.st_ino)
  if key in seen:continue
  seen.add(key);out.append(dict(path=str(p),bytes=s.st_size,allocated=s.st_blocks*512))
 return out
def total(rows):return sum(max(r['bytes'],r['allocated']) for r in rows)
baseline=ops/'sqlite-baseline.json'
if not baseline.exists():baseline.write_text(json.dumps({str(p):p.stat().st_size for p in h.glob('*.sqlite') if p.is_file()}))
initial=json.loads(baseline.read_text())
owned=manifest(root.rglob('*'));launcher=manifest(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-select-hook-recovered-canonical-native-oct24').rglob('*'));session=manifest((h/'sessions/2026/10/24').glob('*01a17029-917d-73e3-ad21-aa5fafe5d663.jsonl'));wal=manifest(h.glob('*.sqlite-wal'))
charges=dict(owned=total(owned),externalLauncher=total(launcher),session=total(session),fullWAL=total(wal),positiveSQLite=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in initial.items()),rootBoardGrowthAllowance=4096,futureCheckoutGit=2097152,futureBothModules=16777216,futureOpsEvidence=1048576,futurePublicationTransitiveGit=2097152,futureSessionLauncherDB=8388608,reserve=8388608)
# Projection is remaining growth; measured bytes are already charged in owned.
repoBytes=total(manifest((root/'repo').rglob('*')))
moduleBytes=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in ops.glob('*.wasm'))
opsBytes=max(0,total(owned)-repoBytes-moduleBytes)
charges['futureCheckoutGit']=max(0,2097152-repoBytes)
charges['futureBothModules']=max(0,16777216-moduleBytes)
charges['futureOpsEvidence']=max(0,1048576-opsBytes)
if (ops/'static-abi.json').exists():
 assert json.loads((ops/'static-abi.json').read_text())['status']=='PASS'
 charges['futureBothModules']=0 # Both actual sealed outputs are complete and already in owned.
if (ops/'publication-plan.json').exists():
 plan=json.loads((ops/'publication-plan.json').read_text())
 charges['futurePublicationCopies']=max(0,plan['copyBytes']-total(manifest((root/'repo/docs/re-notes/maelstrom-select-hook-recovered-canonical-native-20261024-evidence').rglob('*'))))
free=shutil.disk_usage(root).free;mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable')))*1024
future=sum(v for k,v in charges.items() if k.startswith('future') or k=='reserve');peak=sum(charges.values())
tools=[]
for name in ['node','git','python3','ssh']:
 p=pathlib.Path(shutil.which(name)).resolve();tools.append(dict(name=name,path=str(p),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),newBytes=0))
d=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,afterProjection=free-future,memAvailable=mem,minimumMemory=2684354560,verdict='PASS' if peak<=67108864 and free-future>=2982150144 and mem>=2684354560 else 'FAIL',manifest=dict(owned=owned,launcher=launcher,session=session,wal=wal),toolsStandingReadonly=tools,standingInputs='Canonical 140-file 21207647B closure and installed compiler reused IN PLACE; donor flattened object stores readonly; no copies',preAdmission='Instruction/identity reads and small ops setup only. Historical failed admission receipts preserved in prior ops; this fresh gate charges current full WAL and current launcher/session. SQLite baseline starts here, earlier growth retained by historical receipts, current full WAL charged.',limits=dict(compilerCPUWall=900,compilerHeapMiB=2048,compilerAggregateOutput=524288,nativeCPU=90,nativeWall=60,nativeHeapMiB=512,arenaMiB=512,cheapCPUWall=60,cheapHeapMiB=256,cheapNativeOutput=131072,perFile=25165824,capture=2097152,termKillReap=5))
(ops/(sys.argv[1] if len(sys.argv)>1 else 'resource-current.json')).write_text(json.dumps(d,indent=2));print(json.dumps({k:d[k] for k in ['charges','peak','afterProjection','memAvailable','verdict']}));assert d['verdict']=='PASS'

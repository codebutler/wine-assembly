import pathlib,json,shutil,subprocess,sys,time
O=pathlib.Path(__file__).parent;H=O.parent
initial=json.loads((O/'resource-precheckout.json').read_text())
def files(p):
 return [p] if p.is_file() else [x for x in p.rglob('*') if x.is_file()]
def allocated(paths):return sum(x.stat().st_blocks*512 for x in paths)
owned=files(H)
external=[]
for s in initial['session']:external+=files(pathlib.Path(s))
external+=files(pathlib.Path(initial['launcher']))
sql={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*sqlite*') if p.is_file()}
growth=sum(max(0,n-initial['sqlBaseline'].get(p,0)) for p,n in sql.items())
future=8<<20;reserve=8<<20;publication=4<<20
total=allocated(owned)+allocated(external)+growth+future+reserve+publication
free=shutil.disk_usage(H).free
mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
r=dict(time=time.time(),ownedAllocated=allocated(owned),ownedApparent=sum(p.stat().st_size for p in owned),fullExternalAllocated=allocated(external),externalFiles={str(p):p.stat().st_size for p in external},positiveSQLiteGrowth=growth,sqlCurrent=sql,futureAllowance=future,reserve=reserve,publicationAllowance=publication,total=total,allocation=64<<20,free=free,freeAfterConservativeProjection=free-total,memAvailable=mem,largestOwnedFile=max(p.stat().st_size for p in owned),passGate=total<=64<<20 and free-total>=2982150144 and mem>=805306368 and all(p.stat().st_size<=24<<20 for p in owned))
(O/sys.argv[1]).write_text(json.dumps(r,indent=2));print(json.dumps({k:r[k] for k in ['total','freeAfterConservativeProjection','memAvailable','passGate']}));assert r['passGate']

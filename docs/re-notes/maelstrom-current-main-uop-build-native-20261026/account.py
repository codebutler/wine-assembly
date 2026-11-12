import pathlib,json,sys,time,shutil
O=pathlib.Path(__file__).resolve().parent;H=O.parent;C=pathlib.Path('/home/user/.codex');L=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')/H.name
alloc=lambda p:max(p.lstat().st_size,p.lstat().st_blocks*512)
def size(p):return sum(alloc(f) for f in [p,*p.rglob('*')])
sessions=list((C/'sessions/2026/10/26').glob('*01a17760-c040-73e1-97d8-0224b44ae0b9.jsonl'));assert len(sessions)==1
base=json.load(open(O/'db-baseline.json'));positive=sum(max(0,pathlib.Path(p).stat().st_size-v) for p,v in base.items())
charges=dict(owned=size(H),launcher=size(L),session=sum(alloc(p) for p in sessions),positiveDB=positive,WALSHM=sum(alloc(p) for p in C.glob('*.sqlite-*')),remoteStagingModulesLogsFuture=12*1048576,futureLocalPublication=2*1048576,futureSessionLauncherDB=2*1048576,reserve=8*1048576)
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024;free=shutil.disk_usage(H).free;peak=sum(charges.values());j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,memAvailable=mem,client=536870912,heap=16777216,diskFree=free,passChecks=peak<=67108864 and mem-536870912-16777216>=805306368 and free-(charges['futureLocalPublication']+charges['futureSessionLauncherDB']+charges['reserve'])>=2982150144)
(O/(sys.argv[1] if len(sys.argv)>1 else 'resource-current.json')).write_text(json.dumps(j,indent=2));print(json.dumps(j));assert j['passChecks'],'admission failed'

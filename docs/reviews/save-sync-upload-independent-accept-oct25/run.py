import sys,importlib.util,os,json
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('guard','/tmp/save-sync-owned-upload-repair-oct25/ops/run.py'); g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)
g.ROOT=Path('/tmp/save-sync-upload-independent-accept-oct25');g.OPS=g.ROOT/'ops';g.REPO=g.ROOT/'repo'
g.env['GIT_ALTERNATE_OBJECT_DIRECTORIES']='/tmp/save-sync-owned-upload-repair-oct25/repo/.git/objects:'+g.env['GIT_ALTERNATE_OBJECT_DIRECTORIES']
g.env['GIT_CONFIG_COUNT']='4';g.env['GIT_CONFIG_KEY_2']='user.name';g.env['GIT_CONFIG_VALUE_2']='Wine Ops';g.env['GIT_CONFIG_KEY_3']='user.email';g.env['GIT_CONFIG_VALUE_3']='wine-ops@localhost'
def admission(label):
 import shutil,time
 roots=[g.ROOT,Path('/home/user/wine-assembly/scratch/usage-watch/save-sync-upload-independent-accept-oct25')]
 allocated=sum(p.stat().st_blocks*512 for root in roots for p in root.rglob('*') if p.is_file())
 session=Path('/home/user/.codex/sessions/2026/10/25/rollout-2026-10-25T22-55-28-01a17546-aaf8-78a1-8f35-80039c92358f.jsonl')
 sessionBytes=session.stat().st_blocks*512
 shared=Path('/home/user/.codex');walshm=sum(p.stat().st_blocks*512 for pattern in ['*.sqlite-wal','*.sqlite-shm'] for p in shared.glob(pattern))
 initial=json.load(open(g.OPS/'shared-db-checkpoint.json'))['databaseAllocated']
 growth=sum(max(0,p.stat().st_blocks*512-initial.get(str(p),p.stat().st_blocks*512)) for p in shared.glob('*.sqlite'))
 prior=8*1024**2;future=8*1024**2;reserve=8*1024**2
 projected=allocated+sessionBytes+walshm+growth+prior+future+reserve
 ram=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024;free=shutil.disk_usage(g.ROOT).free
 rec=dict(label=label,at=time.time(),allocatedTaskAndLaunch=allocated,session=sessionBytes,sharedWALSHM=walshm,positiveDBgrowth=growth,conservativePriorDBgrowthAllowance=prior,futureCheckoutObjectsPublicationEvidenceCaptureSessionSharedGrowth=future,reserve=reserve,projected=projected,cap=64*1024**2,ram=ram,free=free,standing='readonly flat objects and installed tools executed in place; measured focused-manifest.json',passGate=projected<=64*1024**2 and ram>=1024**3 and free-(prior+future+reserve)>=2982150144)
 (g.OPS/(label+'-admission.json')).write_text(json.dumps(rec,indent=2));assert rec['passGate'],rec
 return rec
g.admission=admission
if __name__=='__main__':
 g.admission(sys.argv[1]);code,out=g.run(sys.argv[2:],cwd=g.REPO if g.REPO.exists() else g.ROOT,check=False);(g.OPS/(sys.argv[1]+'.log')).write_bytes(out);print(out.decode(errors='replace'));sys.exit(code)

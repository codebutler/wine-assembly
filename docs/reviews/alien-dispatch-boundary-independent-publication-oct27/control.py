import sys, pathlib, os, json, shutil, time, hashlib, subprocess
DONOR=pathlib.Path('/tmp/alien-terminal-dispatch-boundary-repair-oct26')
sys.path.insert(0,str(DONOR/'ops'))
import common as c
H=pathlib.Path('/tmp/alien-dispatch-boundary-independent-publication-oct27');O=H/'ops';R=H/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly');NAME=H.name
REV='18d369e8677330b241b5a69603e6e204d0446e33';TREE='aee56dccfac30ac970d4504133c1edb2fe993695'
MAIN='ddaff339bd7e1b10b2579a7ab7aed71d86d8edcd';BR='task/'+NAME
c.H=H;c.O=O;c.R=R
def save(n,j):c.save(n,j)
def gate(stage):
 clients=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   argv=p.joinpath('cmdline').read_bytes().split(b'\0')
   if argv[0].endswith(b'/codex'):clients.append(dict(pid=int(p.name),rss=int(p.joinpath('status').read_text().split('VmRSS:')[1].split()[0])*1024,argv=[a.decode() for a in argv if a]))
  except (OSError,IndexError):pass
 baseline=O/'db-baseline.json'
 if not baseline.exists():save(baseline.name,{str(p):c.alloc(p) for p in pathlib.Path('/home/user/.codex').glob('*-wal')})
 wal=sum(max(0,c.alloc(pathlib.Path(p))-v) for p,v in json.loads(baseline.read_text()).items())
 tid=os.environ.get('CODEX_THREAD_ID','NONE')
 session=sum(c.alloc(p) for p in pathlib.Path('/home/user/.codex/sessions/2026/10').glob('*/*'+tid+'*'))
 charges=dict(own=c.alloc(H),launcher=c.alloc(ROOT/'scratch/usage-watch'/NAME)+sum(c.alloc(p) for p in (ROOT/'scratch/usage-watch').glob(NAME+'.*')),session=session,positiveWAL=wal)
 measured=sum(charges.values());allocation=48*1048576
 peers={}
 for n,cap in [('gl-output-file-confinement-repair-oct27',60),('enigma-native-corpus-independent-accept-oct27',48)]:
  actual=c.alloc(pathlib.Path('/tmp')/n)+c.alloc(ROOT/'scratch/usage-watch'/n)+sum(c.alloc(p) for p in (ROOT/'scratch/usage-watch').glob(n+'.*'))
  peers[n]=dict(measuredLowerBound=actual,remainingUpperBound=max(0,cap*1048576-actual))
 free=shutil.disk_usage(H).free;mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 future=max(0,allocation-measured);projected=free-future-sum(v['remainingUpperBound'] for v in peers.values());need=(768+256+64*len(clients))*1048576
 j=dict(at=time.time(),stage=stage,charges=charges,allocation=allocation,allocationParts=dict(gitSourceTestsEvidence=16777216,sessionEventsPositiveWALGrowthOnce=16777216,publication=8388608,reserve=8388608),measuredTaskBytes=measured,incrementalFuture=future,free=free,projectedFree=projected,diskFloor=2982150144,memAvailable=mem,requiredMemory=need,sharedPhysicalPool=268435456,residentRSSAlreadyInMemAvailable=True,prospectiveClients=0,peers=peers,clients=clients)
 j['pass']=measured+8388608<=allocation and projected>=2982150144 and mem>=need
 save('admission-'+stage+'.json',j)
 assert j['pass'],{k:v for k,v in j.items() if k!='clients'}
c.gate=gate
def run(cmd,label,git=False,cwd=None,inputPath=None):
 req=O/('request-'+label+'.json');save(req.name,dict(cmd=cmd,label=label,git=git,cwd=str(cwd or (R if R.exists() else H)),inputPath=str(inputPath) if inputPath else None))
 # Replace idle controller before entering pool and installed supervisor.
 os.execv('/usr/bin/python3',['/usr/bin/python3',c.POOL,'--slots','2' if git else '1','--','/usr/bin/python3',__file__,'invoke',str(req)])
if __name__=='__main__':
 mode=sys.argv[1]
 if mode=='invoke':
  a=json.load(open(sys.argv[2]));c.supervised(a['cmd'],a['git'],a['label'],a['cwd'],a.get('inputPath'))
 elif mode=='gate':gate(sys.argv[2]);print('admission PASS')
 elif mode=='git':run(['git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*sys.argv[3:]],sys.argv[2],True,cwd=os.environ.get('TASK_GIT_CWD'))
 elif mode=='test':run(sys.argv[3:],sys.argv[2])

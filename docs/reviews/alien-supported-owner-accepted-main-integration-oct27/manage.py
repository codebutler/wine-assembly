import os,sys,json,time,hashlib,shutil,subprocess,fcntl,importlib.util
from pathlib import Path
sys.dont_write_bytecode=True
O=Path(__file__).parent; H=O.parent; R=H/'repo'
ROOT=Path('/home/user/wine-assembly')
DONOR=Path('/tmp/alien-supported-owner-acceptance-publication-oct27/repo')
DOPS=DONOR.parent/'ops'
SOURCE='d8694f71a82df09be05ea3e9222ff1c535da47a3'
REPORT='fec9ebb5b501a4a584f868e1e580022fac88494a'
BR='task/'+H.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
SUP=Path('/tmp/gl-required-version-independent-integrate-oct26/repo/test/helpers/palette-browser-supervisor.py')
POOL=ROOT/'scratch/usage-watch/light-execution-pool-oct26.py'
MiB=1048576
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,v):
 p=O/n;t=p.with_suffix(p.suffix+'.new');t.write_text(json.dumps(v,indent=2)+'\n');os.replace(t,p)
def alloc(paths):
 seen=set();total=0
 for p in paths:
  for q in ([p,*p.rglob('*')] if p.is_dir() else [p]):
   try:s=q.lstat()
   except FileNotFoundError:continue
   k=s.st_dev,s.st_ino
   if k not in seen:seen.add(k);total+=s.st_blocks*512
 return total
def gate(label):
 wals=list(Path('/home/user/.codex').glob('*-wal'));bp=O/'wal-baseline.json'
 if not bp.exists():save(bp.name,{str(p):alloc([p]) for p in wals})
 base=json.loads(bp.read_text());wal=sum(max(0,alloc([p])-base.get(str(p),0)) for p in wals)
 session=list(Path('/home/user/.codex/sessions/2026/10/27').glob('*'+os.environ['CODEX_THREAD_ID']+'*'))
 launch=list((ROOT/'scratch/usage-watch').glob(H.name+'*'))
 source=alloc([R]);events=alloc(session+launch)+wal;evidence=alloc([O])
 used=source+events+evidence+alloc([H])-alloc([R,O])
 remaining=max(0,24*MiB-source)+max(0,8*MiB-events)+max(0,8*MiB-evidence)+8*MiB
 # Only new task futures, once; used peer bytes already reduce host free.
 peers=[]
 for name,thread in [('airstrike-focus-menu-independent-accept-oct27','01a17b52-78bb-7a02-9e3d-fc556a530293'),('penguin-retained-contract-accept-publication-oct27','01a17b52-78c7-7041-8889-467b327f252e')]:
  peerSessions=list(Path('/home/user/.codex/sessions/2026/10/27').glob('*'+thread+'*'))
  peerUsed=alloc([Path('/tmp')/name,*peerSessions,*list((ROOT/'scratch/usage-watch').glob(name+'*'))])
  peers.append(dict(task=name,used=peerUsed,remainingFuture=max(8*MiB,32*MiB-peerUsed),reservationRetainedConservatively=True))
 peerFuture=sum(p['remainingFuture'] for p in peers)
 free=shutil.disk_usage(H).free;mem=int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 clients=[]
 for p in Path('/proc').glob('[0-9]*'):
  try:
   cmd=p.joinpath('cmdline').read_bytes()
   if b'/bin/codex' in cmd and (b'exec\0' in cmd or b'resume\0' in cmd):clients.append(dict(pid=int(p.name),rss=int(p.joinpath('status').read_text().split('VmRSS:')[1].split()[0])*1024))
  except (OSError,IndexError):pass
 reserved=max(3,len(clients))*320*MiB+128*MiB+805306368
 j=dict(at=time.time(),sourceGit=source,sessionEventsWAL=events,evidence=evidence,used=used,allocation=48*MiB,categoriesMiB=dict(sourceGit=24,sessionEventsWAL=8,evidence=8,reserve=8),remainingFuture=remaining,peerFuture=peerFuture,peers=peers,positiveWALCountedOnce=wal,free=free,projectedFree=free-remaining-peerFuture,floor=2982150144,memAvailable=mem,reservedRam=reserved,clients=clients,aggregateClientRSS=sum(c['rss'] for c in clients),releasedOldProspectiveReservationsOnly=True)
 j['pass']=source<=24*MiB and events<=8*MiB and evidence<=8*MiB and used+8*MiB<=48*MiB and j['projectedFree']>=j['floor'] and mem>=reserved
 save('admission-'+label+'.json',j);assert j['pass'],j
 return j
def supervisor():
 assert sha(SUP)=='9d10f7c8c75b5f0dfebff2299eef8ddc27988cf112e0e9c255e89f772c2cee85'
 s=importlib.util.spec_from_file_location('physical_supervisor',SUP);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);return m
def git(*args,repo=None):
 label='git-'+str(time.time_ns())
 cmd=[sys.executable,'-B',str(POOL),'--slots','2','--',sys.executable,'-B',__file__,'git-child',label,str(repo or R),*args]
 r=subprocess.run(cmd,capture_output=True);assert r.returncode==0,(r.stdout[:8192],r.stderr[:8192],label)
 return (O/(label+'-output.log')).read_bytes().rstrip(b'\n')
def checkpoint(group,**kw):save('checkpoint.json',dict(task=H.name,source=SOURCE,acceptedReport=REPORT,completedGroup=group,**kw))
if __name__=='__main__':
 if sys.argv[1]=='git-child':
  _,_,label,repo,*args=sys.argv
  with open('/tmp/wine-ops-production-git.lock','a') as lock:
   fcntl.flock(lock,fcntl.LOCK_EX);gate(label);os.environ['GIT_SSH_COMMAND']=SSH
   cmd=['prlimit','--data=536870912:536870912','git','-c','gc.auto=0','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m','-C',repo,*args]
   r=supervisor().supervise(cmd,rss_limit=256*MiB,cpu_limit=90,wall_limit=120,output_limit=2*MiB)
   out=r.pop('output');save(label+'-execution.json',dict(**r,argv=cmd,ssh=SSH,limitsPlacement='DATA only direct Git subprocess'));(O/(label+'-output.log')).write_bytes(out)
   sys.exit(1 if r['stopReason'] or not r['cleanupComplete'] else r['exit'] or 0)
 elif sys.argv[1]=='light-child':
  label=sys.argv[2];gate(label)
  r=supervisor().supervise(sys.argv[3:],rss_limit=128*MiB,cpu_limit=90,wall_limit=120,output_limit=2*MiB)
  out=r.pop('output');save(label+'-execution.json',r);(O/(label+'-output.log')).write_bytes(out)
  print(out[:8192].decode(errors='replace'));print(json.dumps(r))
  sys.exit(1 if r['stopReason'] or not r['cleanupComplete'] else r['exit'] or 0)
 elif sys.argv[1]=='gate':print(json.dumps(gate(sys.argv[2])))

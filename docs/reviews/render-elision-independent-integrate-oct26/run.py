import os,sys,pathlib,resource,subprocess,signal,time,json,selectors,shutil
O=pathlib.Path(__file__).parent;B=O.parent;R=pathlib.Path('/home/user/wine-assembly');H=pathlib.Path('/home/user/.codex');SID='01a175e6-f1ff-7990-bb95-14df3eaacb9c'
def alloc(root):
 n=0
 if not root.exists():return 0
 for p,ds,fs in os.walk(root,followlinks=False):
  n+=os.lstat(p).st_blocks*512
  for f in fs:n+=os.lstat(os.path.join(p,f)).st_blocks*512
  for d in ds:
   q=os.path.join(p,d)
   if os.path.islink(q):n+=os.lstat(q).st_blocks*512
 return n
def gate(label,extra=0):
 dbp=O/'db-baseline.json'
 if not dbp.exists():dbp.write_text(json.dumps({str(p):p.stat().st_size for p in H.glob('*.sqlite')}))
 db=json.loads(dbp.read_text()); sessions=list((H/'sessions/2026/10/26').glob('*'+SID+'*'))
 parts={'owned':alloc(B),'launcher':alloc(R/'scratch/usage-watch/render-elision-independent-integrate-oct26'),'session':sum(p.stat().st_blocks*512 for p in sessions),'sharedWALSHM':sum(p.stat().st_blocks*512 for pat in ['*.sqlite-wal','*.sqlite-shm'] for p in H.glob(pat)),'positiveDBgrowth':max(2097152,sum(max(0,p.stat().st_size-db.get(str(p),p.stat().st_size)) for p in H.glob('*.sqlite'))),'future':6*2**20,'reserve':8*2**20,'operationGrowth':extra}
 mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024;free=shutil.disk_usage(B).free
 r={'label':label,'at':time.time(),'parts':parts,'projected':sum(parts.values()),'memoryAvailable':mem,'memoryRequired':2**30+201326592,'free':free,'projectedFree':free-parts['future']-parts['reserve']-extra}
 r['pass']=r['projected']<=67108864 and mem>=r['memoryRequired'] and r['projectedFree']>=2982150144
 (O/('gate-'+label+'.json')).write_text(json.dumps(r,indent=2))
 if not r['pass']:raise SystemExit('RESOURCE GATE STOP '+json.dumps(r))
 return r
def limits():
 os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(24*2**20,24*2**20))
def main():
 name=sys.argv[1];cmd=sys.argv[2:];gate(name)
 if (O/(name+'.json')).exists():raise SystemExit('LABEL COLLISION STOP')
 start=time.monotonic();out=bytearray();incident=None
 env={**os.environ,'NODE_OPTIONS':'--max-old-space-size=128','PYTHONDONTWRITEBYTECODE':'1','GIT_SSH_COMMAND':'ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'}
 p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=limits,env=env);sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ)
 while sel.get_map():
  if time.monotonic()-start>60:incident='wall';break
  for key,_ in sel.select(.05):
   d=os.read(key.fd,4096)
   if not d:sel.unregister(key.fileobj);continue
   if len(out)+len(d)>131072:incident='output';break
   out.extend(d)
  if incident:break
 if incident:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=5)
 else:
  try:p.wait(timeout=max(.1,60-(time.monotonic()-start)))
  except subprocess.TimeoutExpired:
   incident='reap';os.killpg(p.pid,signal.SIGTERM)
   try:p.wait(timeout=5)
   except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=5)
 (O/(name+'.log')).write_bytes(out)
 r={'argv':cmd,'exitCode':p.returncode,'seconds':time.monotonic()-start,'outputBytes':len(out),'incident':incident,'controls':'CPU/wall60; file24MiB; output128KiB; excerpt8KiB; read64KiB; TERM/KILL/reap5; NODE128MiB'}
 (O/(name+'.json')).write_text(json.dumps(r,indent=2));print(json.dumps(r));print(out[:8192].decode(errors='replace'));sys.exit(p.returncode or bool(incident))
if __name__=='__main__':main()

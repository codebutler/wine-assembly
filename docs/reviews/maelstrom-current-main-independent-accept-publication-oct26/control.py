import pathlib, json, os, time, hashlib, subprocess, resource, selectors, shutil
O=pathlib.Path(__file__).resolve().parent
P=O.parent
R=P.parent/'repo'
W=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
C=pathlib.Path('/home/user/.codex')
TASK='maelstrom-current-main-independent-accept-publication-oct26'
BASE='e486b6814a00518a6d9cb14ef376e69ab2f92c49'
CAND='aaa6254e7f4c55ad7019478089868dd374be2080'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
def save(name,j):
 p=O/name; t=p.with_suffix('.tmp');t.write_text(json.dumps(j,indent=2)+'\n');t.replace(p)
def admission(name):
 alloc=lambda p:max(p.lstat().st_size,p.lstat().st_blocks*512)
 def size(p):return sum(alloc(f) for f in [p,*p.rglob('*')])
 tasks=['maelstrom-current-main-uop-build-native-oct26','maelstrom-current-main-retained-accept-publication-oct26',TASK]
 ids=['01a17760-c040-73e1-97d8-0224b44ae0b9','01a1777d-8472-7cd0-a309-19869f365fdd',os.environ['CODEX_SESSION_ID']]
 sessions=[next((C/'sessions/2026/10/26').glob('*'+i+'.jsonl')) for i in ids]
 base=json.loads((P/'db-baseline.json').read_text())
 charges=dict(ownedAllMetadata=size(P.parent),launchers=sum(size(W/t) for t in tasks),sessions=sum(alloc(s) for s in sessions),positiveDB=sum(max(0,pathlib.Path(p).stat().st_size-v) for p,v in base.items()),WALSHMOnce=sum(alloc(p) for p in C.glob('*.sqlite-*')),remoteRetained=10985472+8192,futureOnce=2097152,reserve=8388608)
 mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
 free=shutil.disk_usage(O).free
 j=dict(at=time.time(),charges=charges,peak=sum(charges.values()),cap=67108864,memAvailable=mem,ramRequired=1895825408,diskFree=free,diskFloor=2982150144,sessionIDs=ids,remoteCalls=False)
 j['pass']=j['peak']<=j['cap'] and mem>=j['ramRequired'] and free-charges['futureOnce']-charges['reserve']>=j['diskFloor']
 save(name,j);assert j['pass'],j
 return j
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def git(*args):
 p=subprocess.Popen(['git','-c','pack.threads=1','-c','pack.window=0','-c','pack.windowMemory=16m',*args],cwd=R,env=dict(os.environ,GIT_SSH_COMMAND=SSH),preexec_fn=limits,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 sel=selectors.DefaultSelector();sel.register(p.stdout,1,'stdout');sel.register(p.stderr,1,'stderr');out=dict(stdout=bytearray(),stderr=bytearray());deadline=time.monotonic()+120
 try:
  while sel.get_map():
   assert time.monotonic()<deadline,'wall120'
   for key,_ in sel.select(0.5):
    b=os.read(key.fileobj.fileno(),8192)
    if not b:sel.unregister(key.fileobj);continue
    assert sum(map(len,out.values()))+len(b)<=131072,'capture131072'
    out[key.data].extend(b)
  p.wait(timeout=max(.01,deadline-time.monotonic()))
 finally:
  if p.poll() is None:p.kill();p.wait()
  sel.close()
 row=dict(argv=args,exit=p.returncode,stdout=out['stdout'].decode(),stderr=out['stderr'].decode(),gitDATA=536870912)
 with (O/'git.jsonl').open('a') as f:f.write(json.dumps(row)+'\n')
 assert p.returncode==0,row
 return row['stdout'].strip()
if __name__=='__main__':print(json.dumps(admission('admission-initial.json')))

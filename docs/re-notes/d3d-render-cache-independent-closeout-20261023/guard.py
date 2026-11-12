import os,sys,time,json,subprocess,selectors,signal,resource
from pathlib import Path
BASE=Path('/tmp/d3d-render-cache-independent-closeout-oct23'); REPO=BASE/'repo'
EXT=Path('/home/user/wine-assembly/scratch/usage-watch/d3d-render-cache-independent-closeout-oct23')
SESSION=Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T20-20-46-01a16a6c-524a-7d20-87a6-f732f697d4db.jsonl')
CAP=524288; CAPFILE=BASE/'capture-count'; RESERVE=8388608; FUTURE=16777216; PUB=1048576

def size(p):
 try:return p.stat().st_size
 except FileNotFoundError:return 0

def scan(p):
 total=0; biggest=0
 for root,ds,fs in os.walk(p):
  for f in fs:
   n=size(Path(root)/f); total+=n;biggest=max(biggest,n)
 return total,biggest

def check():
 own,big=scan(BASE);private,_=scan(REPO);external,_=scan(EXT)
 sqlite=sum(size(Path('/home/user/.codex')/n) for n in ['state_5.sqlite','state_5.sqlite-wal','state_5.sqlite-shm'])
 session=size(SESSION); projected=own+max(0,8388608-private)+external+sqlite+session+FUTURE+RESERVE+PUB
 free=os.statvfs(BASE).f_bavail*os.statvfs(BASE).f_frsize
 mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
 d=dict(own=own,private=private,external=external,sqliteFull=sqlite,session=session,future=FUTURE,reserve=RESERVE,publication=PUB,projected=projected,limit=67108864,hostFree=free,hostAfter=free-(projected-own),memAvailable=mem)
 if projected>67108864 or private>8388608 or big>25165824 or d['hostAfter']<2982150144 or mem<805306368:raise RuntimeError('GUARD '+json.dumps(d))
 return d

def run(args):
 before=check(); start=time.monotonic(); used=int(CAPFILE.read_text()) if CAPFILE.exists() else 100000
 def limits():
  resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 env=dict(os.environ,TMPDIR=str(BASE/'tmp'),NODE_OPTIONS='--max-old-space-size=256',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts')
 (BASE/'tmp').mkdir(exist_ok=True)
 p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,env=env,start_new_session=True,preexec_fn=limits)
 sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);out=bytearray();failure=None
 try:
  while sel.get_map():
   check()
   if time.monotonic()-start>60:raise RuntimeError('wall60')
   for key,_ in sel.select(.05):
    b=os.read(key.fd,4096)
    if not b:sel.unregister(key.fileobj);continue
    used+=len(b)
    if used>CAP:raise RuntimeError('capture cap')
    out.extend(b)
  rc=p.wait(timeout=1);after=check()
 except Exception as e:
  failure=str(e);os.killpg(p.pid,signal.SIGKILL);p.wait();rc=125;after={}
 CAPFILE.write_text(str(used))
 with (BASE/'execution.jsonl').open('a') as f:f.write(json.dumps(dict(args=args,rc=rc,before=before,after=after,failure=failure,seconds=time.monotonic()-start))+'\n')
 with (BASE/'checks.log').open('ab') as f:f.write(out)
 sys.stdout.buffer.write(out)
 if failure:print(failure)
 return rc
if __name__=='__main__':
 if len(sys.argv)==1: print(json.dumps(check(),indent=2))
 else:sys.exit(run(sys.argv[1:]))

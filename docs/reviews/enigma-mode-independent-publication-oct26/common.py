import hashlib,json,os,resource,shutil,subprocess,time
from pathlib import Path
H=Path(__file__).resolve().parent; R=H.parent/'repo'
ROOT=Path('/home/user/wine-assembly')
D=Path('/tmp/enigma-staging-mode-preservation-repair-oct26/repo')
A=Path('/tmp/enigma-staging-footprint-independent-accept-oct26/repo')
V='34a398198467052f8dc3633c94b08234199eedd6'
AV='00bdb5504bc28e1ef17e15c15dbbc81773dbb5f8'
MAIN='9b98bf52af912382d6526df90f88c73936387fc9'
BRANCH='task/enigma-mode-independent-publication-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
L=ROOT/'scratch/usage-watch/enigma-mode-independent-publication-oct26'
SESSION=Path('/home/user/.codex/sessions/2026/10/26/rollout-2026-10-26T07-59-40-01a17738-e655-7912-aa2c-3fa07ab18ae5.jsonl')
E='docs/reviews/enigma-mode-independent-publication-oct26'
# Driver Python uses a 16 MiB soft data limit; only the admitted Git child
# raises its data envelope to 256 MiB in preexec. Test children hard-cap 16 MiB.
resource.setrlimit(resource.RLIMIT_DATA,(16777216,268435456))
resource.setrlimit(resource.RLIMIT_CPU,(60,60))
resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def save(name,value):
 p=H/name; t=H/(name+'.new');t.write_text(json.dumps(value,indent=2)+'\n');os.replace(t,p)
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  while b:=f.read(8192):h.update(b)
 return h.hexdigest()
def alloc(p):
 if not p.exists():return 0
 seen=set();total=0
 for root,ds,fs in os.walk(p) if p.is_dir() else [(p.parent,[],[p.name])]:
  for q in ([Path(root)] if p.is_dir() else [])+[Path(root)/n for n in fs]:
   st=q.lstat();key=st.st_dev,st.st_ino
   if key not in seen:total+=st.st_blocks*512;seen.add(key)
 return total
def admission(phase):
 b=H/'sqlite-baseline.json'
 if not b.exists():save(b.name,{str(p):alloc(p) for p in Path('/home/user/.codex').glob('*sqlite*')})
 baseline=json.loads(b.read_text());high=H/'sqlite-highwater.json'
 delta=max(sum(max(0,alloc(Path(p))-v) for p,v in baseline.items()),json.loads(high.read_text()) if high.exists() else 0)
 save(high.name,delta)
 charges=dict(checkoutGitTempEvidence=alloc(H.parent),launcherSession=alloc(L)+alloc(SESSION)+alloc(Path(str(L)+'.task.txt'))+alloc(Path(str(L)+'-admission.json')),positiveWALDBOnce=delta,futureSessionDBOnce=12582912,futureGitEvidencePackOnce=16777216,reserve=8388608)
 mem=int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 free=shutil.disk_usage(H).free
 j=dict(phase=phase,time=time.time(),charges=charges,peak=sum(charges.values()),cap=67108864,memAvailable=mem,client=536870912,pythonHeap=16777216,memFloor=805306368,freeDisk=free,growth=58720256,diskFloor=2982150144)
 j['pass']=j['peak']<=j['cap'] and mem-536870912-16777216>=805306368 and free-58720256>=2982150144
 save('admission-'+phase+'.json',j);assert j['pass'],j
 return j
def limits(git=False):
 resource.setrlimit(resource.RLIMIT_DATA,((268435456,)*2) if git else ((16777216,)*2))
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 os.umask(0o002)
def run(args,git=False,check=True,cwd=None):
 # Exact command/envelope recorded before execution. Single client; no threads.
 rec=dict(argv=[str(a) for a in args],git=git,data=268435456 if git else 16777216,cpu=60,wall=65,file=25165824,capture=2097152,output=131072,time=time.time())
 with (H/'commands.jsonl').open('a') as f:f.write(json.dumps(rec)+'\n')
 env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1',TMPDIR=str(H),GIT_CONFIG_COUNT='3',GIT_CONFIG_KEY_0='core.preloadIndex',GIT_CONFIG_VALUE_0='false',GIT_CONFIG_KEY_1='index.threads',GIT_CONFIG_VALUE_1='1',GIT_CONFIG_KEY_2='pack.threads',GIT_CONFIG_VALUE_2='1')
 # File-backed capture prevents an unbounded buffer; every child FSIZE bounded.
 out=H/'capture.stdout';err=H/'capture.stderr'
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.run([str(a) for a in args],stdout=o,stderr=e,cwd=cwd,env=env,preexec_fn=lambda:limits(git),timeout=65)
 assert out.stat().st_size+err.stat().st_size<=2097152,'capture gate'
 stdout=out.read_bytes();stderr=err.read_bytes()
 assert len(stdout)+len(stderr)<=131072,'output gate'
 if check and p.returncode:raise RuntimeError(str(args)+': '+str(p.returncode)+' '+stderr[:8192].decode(errors='replace'))
 return p.returncode,stdout,stderr
def git(*args,repo=R,check=True):return run(['git','-C',repo,*args],True,check)
def blobhash(repo,rev,path):
 # Stream blobs in bounded chunks; never print payloads.
 args=['git','-C',str(repo),'show',rev+':'+path]
 with (H/'commands.jsonl').open('a') as f:f.write(json.dumps(dict(argv=args,data=268435456,cpu=60,wall=65,streamChunk=8192,capture=0))+'\n')
 p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,preexec_fn=lambda:limits(True))
 h=hashlib.sha256();size=0;start=time.monotonic()
 while b:=p.stdout.read(8192):
  size+=len(b);assert size<=25165824 and time.monotonic()-start<65;h.update(b)
 p.stdout.close();assert p.wait(timeout=5)==0
 return h.hexdigest(),size

import os,sys,json,subprocess,resource,shutil,time,signal,selectors
from pathlib import Path
ROOT=Path('/tmp/save-sync-owned-upload-repair-oct25'); OPS=ROOT/'ops'; REPO=ROOT/'repo'
r=json.load(open('/tmp/seh-coordinator-object-view-oct25/receipt.json'))
env=os.environ.copy();env['GIT_ALTERNATE_OBJECT_DIRECTORIES']=r['gitAlternateObjectDirectories'];env['NODE_OPTIONS']='--max-old-space-size=128';env['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env['GIT_CONFIG_COUNT']='2';env['GIT_CONFIG_KEY_0']='gc.auto';env['GIT_CONFIG_VALUE_0']='0';env['GIT_CONFIG_KEY_1']='maintenance.auto';env['GIT_CONFIG_VALUE_1']='false'
def admission(label):
 used=sum(p.stat().st_blocks*512 for p in ROOT.rglob('*') if p.is_file()); ram=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024;free=shutil.disk_usage(ROOT).free
 projected=used+40*1024**2+8*1024**2
 rec=dict(label=label,at=time.time(),allocated=used,projected=projected,cap=64*1024**2,reserve=8*1024**2,futureAllowance=40*1024**2,futureIncludes='objects checkout publication evidence session shared WAL/SHM positive DB growth',ram=ram,free=free,standingInputs='flat readonly object views; installed python/git/node executed in place',mount='No runtime/mount argv; canonical mount gate inapplicable',ssh=env['GIT_SSH_COMMAND'],passGate=projected<=64*1024**2 and ram>=1024**3 and free-(projected-used)>=2982150144)
 (OPS/(label+'-admission.json')).write_text(json.dumps(rec,indent=2));assert rec['passGate'],rec

def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
def run(args,cwd=None,check=True):
 p=subprocess.Popen(args,cwd=cwd or REPO,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
 chunks=[]; size=0; deadline=time.monotonic()+60
 selector=selectors.DefaultSelector();selector.register(p.stdout,selectors.EVENT_READ)
 try:
  while selector.get_map():
   if time.monotonic()>=deadline:raise RuntimeError('timeout')
   for key,_ in selector.select(min(0.1,max(0,deadline-time.monotonic()))):
    block=os.read(key.fileobj.fileno(),8192)
    if not block:selector.unregister(key.fileobj);continue
    size+=len(block)
    if size>128*1024:raise RuntimeError('capture overflow')
    chunks.append(block)
  p.wait(timeout=max(0.01,deadline-time.monotonic()))
 except Exception:
  os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=2.5)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=2.5)
  raise
 finally:selector.close();p.stdout.close()
 out=b''.join(chunks)
 if check and p.returncode:raise RuntimeError(str(args)+' '+out.decode(errors='replace'))
 return p.returncode,out
if __name__=='__main__':
 admission(sys.argv[1]);code,out=run(sys.argv[2:],check=False);(OPS/(sys.argv[1]+'.log')).write_bytes(out);print(out.decode(errors='replace'));sys.exit(code)

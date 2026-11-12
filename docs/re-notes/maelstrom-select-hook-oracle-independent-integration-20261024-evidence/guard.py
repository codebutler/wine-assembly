import subprocess,sys,os,signal,resource,time,json,selectors,pathlib
ops=pathlib.Path(__file__).parent
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
(ops/'tmp').mkdir(exist_ok=True)
prior=sum(p.stat().st_size for p in ops.glob('capture-*.txt'))
assert prior+131072<=2097152, 'aggregate capture reservation exhausted'
env=dict(os.environ,TMPDIR=str(ops/'tmp'),NODE_OPTIONS='--max-old-space-size=256',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes',GIT_OPTIONAL_LOCKS='0')
assert int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024>=805306368
p=subprocess.Popen(sys.argv[1:],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits,env=env)
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);out=bytearray();start=time.monotonic();reject=None
while s.get_map():
 if time.monotonic()-start>60:reject='wall cap';break
 for key,_ in s.select(.1):
  x=os.read(key.fd,4096)
  if not x:s.unregister(key.fileobj);continue
  out.extend(x)
  if len(out)>131072:reject='output cap';break
 if reject:break
try:os.killpg(p.pid,signal.SIGTERM)
except ProcessLookupError:pass
try:p.wait(timeout=2)
except subprocess.TimeoutExpired:
 os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=3)
sys.stdout.buffer.write(out[:131072])
capture=ops/('capture-%d.txt'%p.pid);capture.write_bytes(out[:131072])
with (ops/'commands.jsonl').open('a') as f:f.write(json.dumps({'argv':sys.argv[1:],'exit':p.returncode,'rejection':reject,'bytes':len(out),'seconds':time.monotonic()-start,'pid':p.pid,'reaped':True})+'\n')
sys.exit(99 if reject else p.returncode)

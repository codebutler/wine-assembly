import subprocess,sys,os,signal,resource,time,json
ops=os.path.dirname(__file__)
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60)); resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
env=dict(os.environ,NODE_OPTIONS="--max-old-space-size=256",GIT_SSH_COMMAND="ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes")
p=subprocess.Popen(sys.argv[1:],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits,env=env)
import selectors
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);out=bytearray();start=time.monotonic();reject=None
while s.get_map():
 if time.monotonic()-start>60: reject="wall cap";break
 for key,_ in s.select(.1):
  x=os.read(key.fd,4096)
  if not x:s.unregister(key.fileobj);continue
  out.extend(x)
  if len(out)>131072:reject="output cap";break
 if reject:break
if reject:
 os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=2)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL)
p.wait(timeout=3)
sys.stdout.buffer.write(out[:131072]);
with open(ops+"/commands.jsonl","a") as f:f.write(json.dumps({"argv":sys.argv[1:],"exit":p.returncode,"rejection":reject,"bytes":len(out),"seconds":time.monotonic()-start})+"\n")
sys.exit(99 if reject else p.returncode)

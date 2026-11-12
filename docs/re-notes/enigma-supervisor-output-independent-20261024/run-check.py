import os,sys,pathlib,json,time,subprocess,resource,signal,selectors,re
H=pathlib.Path(__file__).resolve().parents[1];R=H/'repo';O=H/'ops'
name=sys.argv[1];args=sys.argv[2:];assert args
mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
assert mem>=805306368
before=dict(command=args,memAvailable=mem,heapMiB=256,cpu=60,wall=60,maxOutput=131072)
(O/(name+'-admission.json')).write_text(json.dumps(before,indent=2))
def limits():resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
env=dict(os.environ,NODE_OPTIONS='--max-old-space-size=256',TMPDIR=str(H/'tmp'));(H/'tmp').mkdir(exist_ok=True)
p=subprocess.Popen(args,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
start=time.monotonic();out=bytearray();guard=None;s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ)
try:
 while s.get_map():
  if time.monotonic()-start>60:guard='wall';break
  for key,_ in s.select(.1):
   part=os.read(key.fileobj.fileno(),8192)
   if not part:s.unregister(key.fileobj);continue
   if len(out)+len(part)>131072:guard='output';out.extend(part[:131072-len(out)]);break
   out.extend(part)
  if guard:break
finally:
 if guard or p.poll() is None:
  try:os.killpg(p.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:p.wait(timeout=1)
  except subprocess.TimeoutExpired:
   os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=3)
 p.wait();p.stdout.close();s.close()
(O/(name+'.log')).write_bytes(out)
row=dict(before,exit=p.returncode,guard=guard,elapsed=time.monotonic()-start,outputBytes=len(out));(O/(name+'-result.json')).write_text(json.dumps(row,indent=2))
print(json.dumps(row));sys.exit(1 if guard else p.returncode)

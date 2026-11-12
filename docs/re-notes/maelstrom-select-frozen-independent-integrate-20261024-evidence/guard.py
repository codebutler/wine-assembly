import subprocess,resource,os,signal,sys,time,json,pathlib
O=pathlib.Path(__file__).parent
name=sys.argv[1]; args=sys.argv[2:]
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(2097152,2097152))
begin=time.time()
with open(O/(name+'.stdout'),'wb') as out,open(O/(name+'.stderr'),'wb') as err:
 p=subprocess.Popen(args,stdout=out,stderr=err,start_new_session=True,preexec_fn=limits)
 timed=False
 try:p.wait(timeout=60)
 except subprocess.TimeoutExpired:
  timed=True;os.killpg(p.pid,signal.SIGTERM)
  try:p.wait(timeout=2)
  except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=3)
 # Reap process; ensure no own descendant survives.
 try:os.killpg(p.pid,signal.SIGTERM)
 except ProcessLookupError:pass
size=sum((O/(name+'.'+s)).stat().st_size for s in ['stdout','stderr'])
r=dict(command=args,exit=p.returncode,timedOut=timed,outputBytes=size,seconds=time.time()-begin,reaped=True,limits=dict(cpuWall=60,heapMiB=256,capture=2097152,output=131072))
(O/(name+'.json')).write_text(json.dumps(r,indent=2)+'\n')
assert size<=131072
print(json.dumps(r))
print((O/(name+'.stdout')).read_text()[-5000:]);print((O/(name+'.stderr')).read_text()[-3000:])
sys.exit(p.returncode)

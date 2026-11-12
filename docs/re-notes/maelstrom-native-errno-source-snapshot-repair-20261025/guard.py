import subprocess,os,signal,time,resource,json,pathlib,selectors,sys
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
env=dict(os.environ,MNE_SOURCE_ROOT='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23',MNE_ORIGINAL_ROOT='/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6',MNE_CRT='/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll')
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(24<<20,24<<20))
name=sys.argv[1];cmd=['node','--max-old-space-size=256']+sys.argv[2:]
start=time.monotonic();f=open(O/(name+'.log'),'xb');p=subprocess.Popen(cmd,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
timed=False;capped=False;total=0;s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ)
while s.get_map():
 if time.monotonic()-start>=60:timed=True;break
 for key,_ in s.select(min(1,max(0,60-(time.monotonic()-start)))):
  data=os.read(key.fd,8192)
  if not data:s.unregister(key.fileobj);continue
  keep=data[:max(0,131072-total)];f.write(keep);total+=len(keep)
  if len(keep)!=len(data):capped=True;break
 if capped:break
if not timed and not capped:
 try:p.wait(timeout=max(.01,60-(time.monotonic()-start)))
 except subprocess.TimeoutExpired:timed=True
reapStart=time.monotonic()
if timed or capped:
 os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=2)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=3)
s.close();p.stdout.close();f.close()
receipt=dict(command=cmd,env={k:v for k,v in env.items() if k.startswith('MNE_')},returncode=p.returncode,timedOut=timed,capped=capped,limits=dict(heapMiB=256,cpuSeconds=60,wallSeconds=60,outputBytes=131072,perFileBytes=24<<20,narrowCaptureBytes=2<<20,reapSeconds=5),elapsed=time.monotonic()-start,reapElapsed=time.monotonic()-reapStart,bytes=total,reaped=True,passChecks=p.returncode==0 and not timed and not capped)
(O/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt));sys.exit(0 if receipt['passChecks'] else 1)

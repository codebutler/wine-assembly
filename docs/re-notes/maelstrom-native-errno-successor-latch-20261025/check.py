import subprocess,os,signal,time,resource,json,pathlib,selectors
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
env=dict(os.environ,MNE_SOURCE_ROOT='/home/user/wine-assembly-shadow-man-span-static-canonical-oct23',MNE_ORIGINAL_ROOT='/tmp/maelstrom-original-win32-closure-oct24/extracted/Maelstrom-3.0.6',MNE_CRT='/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll')
def limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(24<<20,24<<20))
name=os.sys.argv[1] if len(os.sys.argv)>1 else 'tests'
cmd=['node','--max-old-space-size=256','test/maelstrom-native-errno-latch.test.cjs']
if name=='transform':cmd=['node','--max-old-space-size=256','tools/maelstrom-native-errno-latch.cjs','--enable-exact-native-latch',str(O/'transform-config.json'),str(O/'fragments')]
if name=='transform-corrected':cmd=['node','--max-old-space-size=256','tools/maelstrom-native-errno-latch.cjs','--enable-exact-native-latch',str(O/'transform-config.json'),str(O/'fragments-corrected')]
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
if timed or capped:
 os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=2)
 except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=3)
s.close();p.stdout.close()
f.close()
receipt=dict(command=cmd,env={k:v for k,v in env.items() if k.startswith('MNE_')},returncode=p.returncode,timedOut=timed,capped=capped,limits=dict(heapMiB=256,cpuSeconds=60,wallSeconds=60,outputBytes=131072,perFileBytes=24<<20,reapSeconds=5),elapsed=time.monotonic()-start,bytes=(O/(name+'.log')).stat().st_size,reaped=True,passChecks=p.returncode==0 and not timed and not capped)
(O/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps(receipt));print((O/(name+'.log')).read_text()[-12000:])
raise SystemExit(p.returncode or int(timed))

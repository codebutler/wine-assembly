import os,sys,json,pathlib,time,subprocess,resource,signal,selectors,ctypes,shutil
H=pathlib.Path(__file__).parent
def save(n,x):(H/n).write_text(json.dumps(x,indent=2)+'\n')
def mem():return int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
def group_members(pgid):
 out=[]
 for p in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   s=(p/'stat').read_text().rsplit(')',1)[1].split()
   if int(s[2])==pgid:out.append(int(p.name))
  except (FileNotFoundError,ProcessLookupError,PermissionError):pass
 return out
def execute(argv,wall=90,threshold=2684354560):
 admission=dict(memAvailable=mem(),free=shutil.disk_usage(H).free,argv=argv,wall=wall,cpu=90,oldspaceMB=512,arenaMB=512,at=time.time())
 save('guest-admission.json',admission)
 assert admission['memAvailable']>=threshold,'memory guard rejected'
 assert admission['free']-16*1048576>=2982150144,'disk guard rejected'
 ctypes.CDLL(None).prctl(36,1,0,0,0)
 def limits():resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1048576,24*1048576))
 started=time.time();p=subprocess.Popen(argv,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits,cwd=str(H.parent/'runner'))
 save('guest-process.json',dict(pid=p.pid,pgid=p.pid,started=started,argv=argv))
 sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);total=0;terminal='exited';fault=False
 with (H/'output.log').open('wb') as log:
  while sel.get_map():
   if time.time()-started>wall:terminal='wall guard';break
   for key,_ in sel.select(.1):
    data=os.read(key.fd,8192)
    if not data:sel.unregister(key.fileobj);continue
    if total+len(data)>1048576:terminal='log byte guard';break
    log.write(data);log.flush();total+=len(data)
    if b'*** CRASH' in data or b'Fatal error:' in data:fault=True
   if terminal!='exited':break
 actions=[]
 if p.poll() is None or group_members(p.pid):
  try:os.killpg(p.pid,signal.SIGTERM);actions.append('TERM')
  except ProcessLookupError:pass
  until=time.time()+5
  while time.time()<until and group_members(p.pid):
   p.poll();time.sleep(.05)
  if group_members(p.pid):
   try:os.killpg(p.pid,signal.SIGKILL);actions.append('KILL after 5s')
   except ProcessLookupError:pass
 try:p.wait(timeout=5)
 except subprocess.TimeoutExpired:raise RuntimeError('unreaped primary')
 while True:
  try:
   pid,_=os.waitpid(-1,os.WNOHANG)
   if pid==0:break
  except ChildProcessError:break
 remaining=group_members(p.pid)
 if fault and terminal=='exited':terminal='first guest fault; harness fail-stop'
 save('terminal.json',dict(pid=p.pid,pgid=p.pid,returncode=p.returncode,elapsed=time.time()-started,reason=terminal,fault=fault,signals=actions,remaining=remaining,logBytes=total,finished=time.time()))
 assert not remaining,'descendants remain'
 return p.returncode
if __name__=='__main__':
 if sys.argv[1]=='self-test':
  dest=H/'sentinel';
  try:execute([sys.executable,'-c','open('+repr(str(dest))+',"w").write("bad")'],threshold=10**20)
  except AssertionError:pass
  else:raise AssertionError('guard accepted')
  assert not dest.exists();print('rejecting admission control PASS; sentinel absent')
 else:
  R=H.parent;game=R/'game';runner=R/'runner'
  dll=['SDL.dll','SDL_image.dll','SDL_mixer.dll','jpeg.dll','libpng1.dll','msvcr70.dll','msvcrt.dll','zlib.dll']
  schedule=['1600:keydown:13','1610:keyup:13','2100:keydown:188','3000:png:'+str(H/'before.png'),'3100:keydown:37','3200:keydown:190','3600:png:'+str(H/'movement-fire.png'),'3800:keyup:37','3900:keyup:190','4000:keyup:188','4400:png:'+str(H/'after.png')]
  argv=['node','--max-old-space-size=512','--require',str(H/'abi-preload.cjs'),str(runner/'test/run.js'),'--no-build','--wasm='+str(runner/'build/wine-assembly.wasm'),'--exe='+str(game/'airstrike-pre6a.exe'),'--dlls='+','.join(str(game/x) for x in dll),'--vfs-include=airstrikerc','--vfs-include=data/**/*','--cwd=C:\\','--quiet-api','--quiet-blocks','--no-threads','--memory-mb=512','--max-seconds=60','--max-batches=4500','--batch-size=20000','--tick-ms-per-batch=5','--trace-input','--screen=800x600','--input='+','.join(schedule),'--png='+str(H/'final.png')]
  execute(argv)

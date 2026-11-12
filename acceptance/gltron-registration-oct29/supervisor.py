import os,sys,json,time,hashlib,resource,subprocess,signal,pathlib,datetime
ROOT=pathlib.Path('/tmp/gltron-registration-independent-accept-oct29'); REPO=ROOT/'repo'; E=ROOT/'evidence'; M=1024*1024
HOST=pathlib.Path('/home/user/wine-assembly'); BASE=HOST/'scratch/usage-watch'; TASK='gltron-registration-independent-accept-oct29'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ORIG_DATA=resource.getrlimit(resource.RLIMIT_DATA)
resource.setrlimit(resource.RLIMIT_DATA,(128*M,ORIG_DATA[1]))
def save(name,data):
 p=E/name; p.write_text(json.dumps(data,indent=2)+'\n')
def sizes(p):
 return sum(f.stat().st_size for f in p.rglob('*') if f.is_file() and not f.is_symlink())
def admission(op):
 s=os.statvfs(ROOT); mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
 a=json.loads((BASE/(TASK+'-admission.json')).read_text()); own=sizes(ROOT); b=json.loads((E/'baseline.json').read_text()) if (E/'baseline.json').exists() else {}
 session=pathlib.Path(b.get('sessionPath','/nonexistent')); growth=max(0,session.stat().st_size-b.get('sessionBytes',0)) if session.exists() else 0
 wal=pathlib.Path('/home/user/.codex/state_5.sqlite-wal'); wg=max(0,wal.stat().st_size-b.get('walBytes',0)) if wal.exists() else 0
 r={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'operation':op,'device':ROOT.stat().st_dev,'f_bavail':s.f_bavail,'blockSize':s.f_frsize,'freeBytes':s.f_bavail*s.f_frsize,'aggregateVersion':hashlib.sha256((BASE/(TASK+'-admission.json')).read_bytes()).hexdigest(),'aggregate':a['aggregate'],'ownBytes':own,'sessionGrowth':growth,'positiveSharedWALGrowthCountedOnce':wg,'projection':a['aggregate'],'allocation':48*M,'MemAvailable':mem,'requiredMem':2*1024*M}
 r['PASS']=r['freeBytes']-r['projection']>=2982150144 and mem>=r['requiredMem'] and own+growth+wg<=48*M
 with (E/'admissions.jsonl').open('a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('ADMISSION REJECTION '+json.dumps(r))
def valid(cwd):
 p=pathlib.Path(cwd).resolve(strict=True)
 if p!=ROOT and ROOT not in p.parents:raise ValueError('outside owned task cwd')
 return p
ENV=os.environ.copy(); ENV['GIT_SSH_COMMAND']=SSH; ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(json.loads((BASE/(TASK+'-object-stores.json')).read_text())['stores']); ENV['GIT_TERMINAL_PROMPT']='0'; ENV['TMPDIR']=str(ROOT)
def run(argv,*,cwd,git=False,mutate=False,init=False):
 cwd=valid(cwd)
 if git:
  if argv[:3]!=['git','-C',str(REPO)]:raise ValueError('git -C mismatch')
  if init:
   if cwd!=REPO or (REPO/'.git').exists():raise ValueError('init containment')
  elif mutate:
   for opt,expected in [('--show-toplevel',REPO),('--absolute-git-dir',REPO/'.git')]:
    out=run(['git','-C',str(REPO),'rev-parse',opt],cwd=REPO,git=True)
    if pathlib.Path(out.decode().strip()).resolve()!=expected:raise ValueError('git identity')
 admission(' '.join(argv)[:260]); n=len(list(E.glob('op-*.json'))); stem=E/f'op-{n:03d}'
 def limits():
  resource.setrlimit(resource.RLIMIT_DATA,(256*M,256*M) if git else ORIG_DATA)
  if pathlib.Path(argv[0]).name.startswith('python'):resource.setrlimit(resource.RLIMIT_DATA,(128*M,128*M))
  resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M)); resource.setrlimit(resource.RLIMIT_CORE,(0,0))
 t=time.monotonic(); peak=0; reason=None
 with open(str(stem)+'.out','wb') as out,open(str(stem)+'.err','wb') as err:
  p=subprocess.Popen(argv,cwd=str(cwd),env=ENV,stdout=out,stderr=err,start_new_session=True,preexec_fn=limits)
  try:
   while p.poll() is None:
    rss=0
    for d in pathlib.Path('/proc').iterdir():
     if not d.name.isdigit():continue
     try:
      st=(d/'stat').read_text().split(') ',1)[1].split()
      if int(st[2])==p.pid:
       physical=int(st[21])*os.sysconf('SC_PAGE_SIZE');rss+=physical
       if pathlib.Path(argv[0]).name.startswith('python') and physical>128*M:reason='Python RSS'
     except (OSError,ValueError,IndexError):pass
    peak=max(peak,rss)
    if rss>512*M:reason='group RSS'
    if time.monotonic()-t>120:reason='wall'
    if out.tell()+err.tell()>2*M:reason='capture'
    if reason:break
    time.sleep(.02)
  finally:
   try:os.killpg(p.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   p.wait()
 r={'argv':argv,'cwd':str(cwd),'exit':p.returncode,'peakGroupRSS':peak,'seconds':time.monotonic()-t,'reason':reason,'cleanup':'kill process group and reap'};save(stem.name+'.json',r)
 data=pathlib.Path(str(stem)+'.out').read_bytes();errors=pathlib.Path(str(stem)+'.err').read_bytes()
 if reason or p.returncode:raise RuntimeError(json.dumps(r)+'\n'+errors[:2000].decode(errors='replace'))
 return data
if __name__=='__main__':
 if sys.argv[1]=='init':
  pins={}
  for name,expected in [('dispatch','2ddbf839c859526da2cb4b6d52765e81e6f0dbcee51f26fe6425aa7e54f8afa1'),('admission','43ffef5b8b43b464a8e35f36f97a6c785402c1e6c2b603b2c56f48456d220927')]:
   p=BASE/(TASK+'-'+name+'.json'); actual=hashlib.sha256(p.read_bytes()).hexdigest();assert actual==expected;pins[name]=actual
  session=pathlib.Path('/home/user/.codex/sessions/2026/10/29/rollout-2026-10-29T02-14-15-01a1856f-bc6a-7c81-9423-be88ec372df0.jsonl');wal=pathlib.Path('/home/user/.codex/state_5.sqlite-wal')
  save('baseline.json',{'sessionPath':str(session),'sessionBytes':session.stat().st_size,'walPath':str(wal),'walBytes':wal.stat().st_size if wal.exists() else 0,'inheritedLimits':{k:resource.getrlimit(getattr(resource,k)) for k in ['RLIMIT_DATA','RLIMIT_AS','RLIMIT_CPU','RLIMIT_FSIZE']},'originalData':ORIG_DATA,'pins':pins,'mountArgv':[],'incidents':['Initial read-only policy/receipt inspection exceeded 8192B terminal cap; truncated. No production acceptance result derived from it.']})
  controls=[]
  for bad in [None,str(HOST),'/tmp/gltron-original-launch-registration-oct29/repo','/tmp']:
   try:
    if bad is None:run(['/usr/bin/touch',str(ROOT/'BAD')])
    else:run(['/usr/bin/touch',str(ROOT/'BAD')],cwd=bad)
    raise AssertionError('accepted bad cwd')
   except (TypeError,ValueError):controls.append(str(bad))
  assert not (ROOT/'BAD').exists()
  sentinel=run(['/bin/pwd'],cwd=REPO).decode().strip();assert sentinel==str(REPO)
  save('containment.json',{'rejected':controls,'sentinel':sentinel,'badSentinelAbsent':True})
  run(['git','-C',str(REPO),'init'],cwd=REPO,git=True,init=True)
  run(['git','-C',str(REPO),'config','user.name','Wine Ops acceptance worker'],cwd=REPO,git=True,mutate=True)
  run(['git','-C',str(REPO),'config','user.email','wine-ops@localhost'],cwd=REPO,git=True,mutate=True)
  run(['git','-C',str(REPO),'config','core.sparseCheckout','true'],cwd=REPO,git=True,mutate=True)
  (REPO/'.git/info/sparse-checkout').write_text('/lib/\n/host.js\n/test/run.js\n/test/test-gltron-original-registration.js\n/tools/stage-gltron-original.js\n/tools/recover-gltron-original.js\n/docs/recipes/gltron-original-launch.md\n')
  run(['git','-C',str(REPO),'checkout','-b','task/'+TASK,'9b32086c679c690988ecd7824bdcc4401cd344f6'],cwd=REPO,git=True,mutate=True)
  print('initialized')
 elif sys.argv[1]=='exec':
  args=sys.argv[2:];print(run(args,cwd=REPO).decode()[:7500])

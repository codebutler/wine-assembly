import os,sys,json,time,signal,subprocess,resource,pathlib,datetime,hashlib
OWN=pathlib.Path('/tmp/gltron-fixture-authorized-integrity-repair-oct29').resolve()
REPO=OWN/'repo'; E=OWN/'evidence'; M=1024*1024
ORIGINAL_DATA=resource.getrlimit(resource.RLIMIT_DATA)
resource.setrlimit(resource.RLIMIT_DATA,(128*M,ORIGINAL_DATA[1]))
resource.setrlimit(resource.RLIMIT_CPU,(90,90))
resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
STORES=json.load(open('/home/user/wine-assembly/scratch/usage-watch/gltron-required-asset-integrity-repair-oct29-object-stores.json'))['stores']
ENV=os.environ.copy();ENV['GIT_ALTERNATE_OBJECT_DIRECTORIES']=':'.join(STORES)
ENV['GIT_SSH_COMMAND']='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV['GIT_CONFIG_NOSYSTEM']='1';ENV['GIT_CONFIG_GLOBAL']='/dev/null'
def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def contained(cwd):
 p=pathlib.Path(cwd).resolve(strict=True)
 if p!=OWN and OWN not in p.parents: raise ValueError('outside owned task: '+str(p))
 return p
def admission(label):
 s=os.statvfs(OWN);mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
 base=json.load(open(E/'baseline.json'));wal=sum(max(0,pathlib.Path(p).stat().st_size-n) for p,n in base['walInitial'].items())
 usage=sum(p.stat().st_blocks*512 for p in OWN.rglob('*') if p.is_file())
 r=dict(at=stamp(),label=label,device=OWN.stat().st_dev,f_bavail=s.f_bavail,blockSize=s.f_frsize,free=s.f_bavail*s.f_frsize,aggregate=125829120,allocation=50331648,forecast='Git/source8 fixture5 tests3 evidence1 events/WAL8 publication3 buffer20 MiB',ownedPhysical=usage,positiveWAL=wal,MemAvailable=mem,required=3175088128,memRequired=2147483648)
 evidence=sum(p.stat().st_size for p in E.rglob('*') if p.is_file())
 r['evidenceBytes']=evidence
 r['PASS']=r['free']-125829120>=3175088128 and mem>=2147483648 and usage+wal<=50331648 and evidence<=M
 with open(E/'admissions.jsonl','a') as f:f.write(json.dumps(r)+'\n')
 if not r['PASS']:raise RuntimeError('FIRST ADMISSION FAILURE: '+json.dumps(r))
def run(argv,*,cwd,label='operation',git=False,initial=False,check=True):
 p=contained(cwd)
 if git:
  if argv[:3]!=['git','-C',str(REPO)] or p!=REPO:raise ValueError('Git requires owned explicit -C and cwd')
  if initial:
   if (REPO/'.git').exists() or argv[3]!='init':raise ValueError('initialization only once in own repo')
  else:
   for flag,wanted in [('--show-toplevel',str(REPO)),('--absolute-git-dir',str(REPO/'.git'))]:
    result=run(['git','-C',str(REPO),'rev-parse',flag],cwd=REPO,label='identity-'+flag)
    if result.strip()!=wanted:raise ValueError('Git identity mismatch '+result)
 admission(label)
 idx=len(list(E.glob('op-*.json')));stem=E/f'op-{idx:03d}'
 def limits():
  os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(12*M,12*M))
  # Python's data cap is process-specific. Node retains the launcher limit.
  resource.setrlimit(resource.RLIMIT_DATA,((256*M if argv[0]=='git' else ORIGINAL_DATA[0]),ORIGINAL_DATA[1]))
 start=time.monotonic();peak=0;violation=None
 with open(str(stem)+'.out','wb') as out,open(str(stem)+'.err','wb') as err:
  proc=subprocess.Popen(argv,cwd=p,env=ENV,stdout=out,stderr=err,preexec_fn=limits)
  try:
   while proc.poll() is None:
    supervisorRSS=int(pathlib.Path('/proc/self/statm').read_text().split()[1])*os.sysconf('SC_PAGE_SIZE')
    total=supervisorRSS
    if supervisorRSS>128*M:violation='supervisor Python RSS'
    for entry in pathlib.Path('/proc').iterdir():
     if not entry.name.isdigit():continue
     try:
      st=(entry/'stat').read_text().rsplit(')',1)[1].split()
      if int(st[2])!=proc.pid:continue
      rss=int(st[21])*os.sysconf('SC_PAGE_SIZE');total+=rss
      if argv[0].endswith('python3') and rss>128*M:violation='Python RSS'
     except (OSError,ValueError,IndexError):pass
    peak=max(peak,total)
    if total>512*M:violation='group RSS'
    if time.monotonic()-start>120:violation='wall'
    if out.tell()+err.tell()>2*M:violation='capture'
    if violation:os.killpg(proc.pid,signal.SIGKILL);break
    time.sleep(.025)
   proc.wait()
  finally:
   try:os.killpg(proc.pid,signal.SIGKILL)
   except ProcessLookupError:pass
 r=dict(at=stamp(),argv=argv,cwd=str(p),exit=proc.returncode,peakRSS=peak,wall=time.monotonic()-start,violation=violation,descendantCleanup=True)
 pathlib.Path(str(stem)+'.json').write_text(json.dumps(r)+'\n')
 output=pathlib.Path(str(stem)+'.out').read_text();error=pathlib.Path(str(stem)+'.err').read_text()
 if not label.startswith('identity-'):
  print(json.dumps(r));print((output+error)[:3500])
 if violation or (check and proc.returncode):raise RuntimeError('operation failed '+label)
 return output
def git(*args,initial=False,check=True):return run(['git','-C',str(REPO),*args],cwd=REPO,label='git-'+args[0],git=True,initial=initial,check=check)
if __name__=='__main__':
 if sys.argv[1]=='controls':
  results=[]
  for cwd in [None,'/home/user/wine-assembly','/tmp/gltron-registration-independent-accept-oct29/repo','/tmp']:
   try:
    if cwd is None:run(['/usr/bin/touch',str(OWN/'forbidden-sentinel')])
    else:run(['/usr/bin/touch',str(OWN/'forbidden-sentinel')],cwd=cwd)
    raise AssertionError('containment failed')
   except (TypeError,ValueError):results.append({'cwd':cwd,'rejectedBeforeSpawn':True})
  assert not (OWN/'forbidden-sentinel').exists()
  run(['/bin/pwd'],cwd=REPO,label='owned-sentinel')
  (E/'containment.json').write_text(json.dumps(results)+'\n')
 elif sys.argv[1]=='git':git(*sys.argv[2:],initial=sys.argv[2]=='init')
 elif sys.argv[1]=='node':run(['/usr/bin/node','--max-old-space-size=96',*sys.argv[2:]],cwd=REPO,label='node',check='--allow-failure' not in sys.argv)

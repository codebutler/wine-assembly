import os, sys, json, pathlib, resource, subprocess, time, hashlib, shutil, signal
P=pathlib.Path('/tmp/dashboard-sidebar-independent-publication-oct26'); R=P/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly'); LAUNCH=ROOT/'scratch/usage-watch'/P.name
MAIN='a18735d3b0e6dcb49a6cd1d65d054111d54340ff'; CAND='96be105a5b5b650ca99fd26024e9043aa0ddd7b9'
BRANCH='task/'+P.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
NODE='/usr/local/bin/node'
SESSION=next(pathlib.Path('/home/user/.codex/sessions').rglob('*01a179ac-ff95-7641-b32c-4cfe6a9a77a8.jsonl'))
def save(n,x):
 p=P/n;p.parent.mkdir(parents=True,exist_ok=True);t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(x,indent=2)+'\n');t.replace(p)
def sha(p):
 h=hashlib.sha256()
 with pathlib.Path(p).open('rb') as f:
  for b in iter(lambda:f.read(8192),b''):h.update(b)
 return h.hexdigest()
def size(p):
 try:return max(p.stat().st_size,p.stat().st_blocks*512)
 except FileNotFoundError:return 0
def wal():return {str(p):size(p) for p in pathlib.Path('/home/user/.codex').glob('*.sqlite-wal')}
def gate(label):
 clients=[];nodes=[]
 for q in pathlib.Path('/proc').glob('[0-9]*'):
  try:
   exe=(q/'exe').resolve().name;args=(q/'cmdline').read_bytes().split(b'\0');rss=int((q/'statm').read_text().split()[1])*4096
   if 'codex' in exe:clients.append(dict(pid=int(q.name),rss=rss,flags=[a.decode() for a in args if a.startswith(b'model_') or a==b'gpt-6.1-sol']))
   if exe=='node':nodes.append(dict(pid=int(q.name),rss=rss,argv=[a.decode(errors='replace') for a in args[:-1]]))
  except (OSError,ValueError):pass
 mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 baseline=json.loads((P/'wal-baseline.json').read_text());current=wal();positive=sum(max(0,v-baseline.get(k,0)) for k,v in current.items())
 actual=sum(size(f) for root in [P,LAUNCH] for f in root.rglob('*') if f.is_file() and not f.is_symlink())+size(SESSION)+positive
 # Four new clients reserved once; current RSS is already reflected in MemAvailable.
 # One task Node at a time; three other newly assigned lightweight Node lanes reserved.
 required=4*268435456+4*335544320+805306368
 projected=max(40*1024**2,actual+8*1024**2+8*1024**2)
 free=shutil.disk_usage(P).free
 x=dict(label=label,at=time.time(),MemAvailable=mem,clients=clients,aggregateClientRSS=sum(c['rss'] for c in clients),standingNodes=nodes,newClientReserveAggregate=4*268435456,nodePhysicalAllowanceEach=335544320,concurrentNodeReservations=4,physicalFloor=805306368,requiredAvailable=required,ownedBytesIncludingLauncherSessionAndPositiveWALOnce=actual,session=str(SESSION),wal=current,positiveWALGrowth=positive,projectedBytesIncluding8MiBReserve=projected,hardBytes=67108864,hostFree=free,hostRemainingProjected=free-(projected-actual))
 x['pass']=mem>=required and projected<=67108864 and x['hostRemainingProjected']>=2982150144
 save('resources-'+label+'.json',x)
 if not x['pass']:raise RuntimeError('resource admission denied: '+label)
 return x
def limits(git):
 resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
 if git:resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def run(name,argv,git=False,cwd=None,expected=0):
 out=P/(name+'.stdout');err=P/(name+'.stderr');env=os.environ.copy()
 env.update(GIT_SSH_COMMAND=SSH,NODE_OPTIONS='--max-old-space-size=192',GIT_TERMINAL_PROMPT='0',TMPDIR=str(P/'tmp'))
 (P/'tmp').mkdir(exist_ok=True)
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.Popen(argv,cwd=cwd,env=env,stdout=o,stderr=e,preexec_fn=lambda:limits(git),start_new_session=True);start=time.monotonic();peak=0
  while p.poll() is None:
   try:peak=max(peak,int(pathlib.Path(f'/proc/{p.pid}/statm').read_text().split()[1])*4096)
   except (OSError,ValueError):pass
   if time.monotonic()-start>120 or out.stat().st_size+err.stat().st_size>2097152:
    os.killpg(p.pid,signal.SIGKILL);p.wait();raise RuntimeError('command wall/output cap')
   time.sleep(.02)
 receipt=dict(argv=argv,cwd=str(cwd),exitCode=p.returncode,elapsed=time.monotonic()-start,peakSampledRSS=peak,gitDataOnly=git,stdout=str(out),stderr=str(err),stdoutSHA256=sha(out),stderrSHA256=sha(err),cpuSeconds=90,wallSeconds=120,fileBytes=25165824,outputBytes=2097152,nodeOptions=env['NODE_OPTIONS'],ssh=SSH)
 save(name+'.json',receipt)
 if p.returncode!=expected:raise RuntimeError(f'Unexpected exit {p.returncode}: {name}.json')
 b=out.read_bytes()
 return b[:8192].decode(errors='replace').strip()
def git(name,*args,**kw):return run(name,['git',*args],git=True,cwd=kw.pop('cwd',R),**kw)
if __name__=='__main__':
 save('wal-baseline.json',wal());gate('precheckout')
 for f in ['/home/user/.ssh/wine_github_ed25519','/home/user/.ssh/wine_github_known_hosts']:assert pathlib.Path(f).is_file()
 startup=json.loads(run('startup',[NODE,'--max-old-space-size=192','-e','const fs=require("fs");console.log(JSON.stringify({execPath:process.execPath,execArgv:process.execArgv,limits:fs.readFileSync("/proc/self/limits","utf8"),rss:process.memoryUsage().rss,NODE_OPTIONS:process.env.NODE_OPTIONS,startup:true}))']))
 save('node-startup.json',startup)
 assert 'unlimited' in next(x for x in startup['limits'].splitlines() if x.startswith('Max data size'))
 assert 'unlimited' in next(x for x in startup['limits'].splitlines() if x.startswith('Max address space'))
 text=(ROOT/'test/run.js').read_text();parser=text[text.index('const getArg ='):text.index('// Was `--name=...`')]
 parsed=json.loads(run('mount-empty',[NODE,'--max-old-space-size=192','-e','const args=[];'+parser+';console.log(JSON.stringify({tree:getArgs("vfs-tree"),mount:getArgs("vfs-mount")}))']))
 assert parsed==dict(tree=[],mount=[])
 save('launch-configuration.json',dict(ssh=SSH,actualMountArgv=[],intendedFiles=[],parsed=parsed,canonicalParserSHA256=hashlib.sha256(parser.encode()).hexdigest(),noGuestOrMount=True,nodeStartup='node-startup.json',rootRefReceipt=json.loads((LAUNCH/'root-ref-digest.json').read_text())))
 R.mkdir();git('init','init','-b',BRANCH);git('author-name','config','user.name','Codex');git('author-email','config','user.email','codex@users.noreply.github.com');git('remote-add','remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
 # Only own small loose stores are copied. Shared root is an immutable standing input.
 donors=[pathlib.Path('/tmp/corpus-complete-contract-independent-publication-oct26/repo'),pathlib.Path('/tmp/dashboard-sidebar-distinct-count-repair-oct26/repo')]
 copied=[]
 for d in donors:
  for f in (d/'.git/objects').glob('[0-9a-f][0-9a-f]/*'):
   if not f.is_file():continue
   target=R/'.git/objects'/f.parent.name/f.name
   if target.exists():assert sha(target)==sha(f);continue
   target.parent.mkdir(exist_ok=True);shutil.copyfile(f,target);copied.append(dict(source=str(f),bytes=f.stat().st_size,sha256=sha(f)))
 (R/'.git/objects/info/alternates').write_text(str(ROOT/'.git/objects')+'\n')
 save('flat-closure.json',dict(copied=copied,totalBytes=sum(f['bytes'] for f in copied),standingAlternate=str(ROOT/'.git/objects'),warningEvidence='/tmp/blocker-count-private-dashboard-activation-oct26/repo/docs/reviews/blocker-count-private-dashboard-activation-oct26/git-warnings.json',noSharedMutation=True))
 assert git('main-type','cat-file','-t',MAIN)=='commit';assert git('candidate-type','cat-file','-t',CAND)=='commit'
 git('sparse-config','config','core.sparseCheckout','true');git('sparse-cone','config','core.sparseCheckoutCone','false')
 (R/'.git/info/sparse-checkout').write_text('/ops/app.js\n/ops/blocker-model.js\n/ops/dashboard-sidebar-count.test.js\n/ops/dashboard-sidebar-independent.test.js\n/docs/reviews/'+P.name+'/\n')
 git('set-branch','update-ref','refs/heads/'+BRANCH,MAIN);git('checkout','read-tree','-mu',MAIN)
 print(json.dumps(dict(startup='PASS',mount='PASS empty actual argv',flatClosureBytes=sum(f['bytes'] for f in copied),resources='PASS',main=MAIN,candidate=CAND)))

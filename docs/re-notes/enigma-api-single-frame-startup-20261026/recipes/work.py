import pathlib,subprocess,json,os,hashlib,shutil,time,shlex,base64,zlib,resource,importlib.util
H=pathlib.Path(__file__).parent
P=pathlib.Path('/tmp/enigma-provider-complete-startup-oct24')
D=pathlib.Path('/tmp/maelstrom-terminal-closure-accepted-integrate-oct26/repo')
R='/home/user/enigma-api-single-frame-startup-oct26'
BOX='bx_7qwjxps7';B='/home/user/.ascii/boat'
REV='44e344fdb26daab9a07210656597902ba27cb5f7'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
spec=importlib.util.spec_from_file_location('account','/home/user/wine-assembly/scratch/usage-watch/owned-storage-accounting-oct24.py');account=importlib.util.module_from_spec(spec);spec.loader.exec_module(account)
assert hashlib.sha256(pathlib.Path(spec.origin).read_bytes()).hexdigest()=='c683aa3aef60cb92f7907a4779cbf2c2c58d36d675d3025be047b59056942651'
allocated=account.allocated
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,j):
 p=H/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(j,indent=2)+'\n')
def remote(cmd,timeout=30,allow_exit=False):
 assert len(cmd.encode())<=36000
 p=subprocess.run([B,'--no-update','--json','exec','--timeout',str(timeout),BOX,cmd],capture_output=True,text=True,timeout=timeout+15)
 with (H/'api-history.jsonl').open('a') as f:f.write(json.dumps(dict(at=time.time(),command=cmd if len(cmd)<2000 else None,commandSHA256=sha(cmd.encode()),requestBytes=len(cmd.encode()),responseBytes=len(p.stdout.encode())+len(p.stderr.encode())))+'\n')
 try:j=json.loads(p.stdout)
 except Exception:save('first-rejection.json',dict(status=p.returncode,stdout=p.stdout,stderr=p.stderr));raise
 if (p.returncode or j.get('exitCode')!=0) and not allow_exit or j.get('stdoutTruncated') or j.get('stderrTruncated'):
  save('first-rejection.json',j);raise RuntimeError('remote rejection retained')
 return j
def py(code,timeout=30):return remote('python3 -c '+shlex.quote(code),timeout)
def payload(x):
 return subprocess.check_output(['git','-C',x['donor'],'show',x['revision']+':'+x['path']],stderr=subprocess.DEVNULL) if x['kind']=='git' else pathlib.Path(x['path']).read_bytes()
def git(*args):
 r=subprocess.run(['git','-C',str(H/'repo'),*args],capture_output=True,text=True,env=dict(os.environ,GIT_SSH_COMMAND=SSH));assert r.returncode==0,r.stderr;return r.stdout
def measure(stage,remoteActual=None,publicationOnly=False):
 base=json.load(open(H/'sqlite-baseline.json'));db=sum(max(0,allocated(pathlib.Path(p))-v) for p,v in base.items())
 prior=json.load(open(H/'sqlite-highwater.json'))['bytes'] if (H/'sqlite-highwater.json').exists() else 0
 db=max(db,prior);save('sqlite-highwater.json',dict(bytes=db))
 a=json.load(open(H/'session.json'));launcher=pathlib.Path(a['launcher'])
 external=allocated(pathlib.Path(a['session']))+allocated(launcher)+sum(allocated(pathlib.Path(str(launcher)+s)) for s in ['-dispatch.json','.task.txt','.task.runtime.json'])
 # Conservative floors include remaining checkout/index and full 2 MiB PNG publication.
 local=allocated(H);remoteBytes=remoteActual if remoteActual is not None else 43327488+348160+131072
 png=allocated(H/'repo/docs/re-notes/enigma-api-single-frame-startup-20261026/startup.png')
 newGit=max(0,allocated(H/'repo/.git/objects')-16384)
 charges=dict(localOwned=local,remoteOwned=remoteBytes,sessionLauncherFull=external,positiveSQLiteHighwater=db,sqliteAndSessionFuture=2097152,checkoutGitAndHelpersFuture=max(0,3145728-allocated(H/'repo')),captureAndPublicationFuture=max(0,4194304-png-newGit),transferOverlap=1048576,reserve=8388608)
 if publicationOnly:
  # Distinct closeout operation: no guest/capture is allowed after rejection.
  # Existing payload, history and highwater charges remain; only unused future
  # PNG work is replaced by a conservative bounded report/Git-copy allowance.
  charges['captureAndPublicationFuture']=524288
 peak=sum(charges.values());free=shutil.disk_usage(H).free
 rf=json.loads(json.load(open(H/'remote-admission.json'))['stdout'])['free']
 mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
 rss=int(pathlib.Path('/proc/2057103/status').read_text().split('VmRSS:')[1].split()[0])*1024
 largest=max((p.lstat().st_size for p in H.rglob('*') if p.is_file() and not p.is_symlink()),default=0)
 j=dict(at=time.time(),stage=stage,operation='bounded failure publication only; guest permanently stopped' if publicationOnly else 'conditional guest',charges=charges,peak=peak,cap=67108864,free=free,remoteFree=rf,projectedLocalAfter=free-peak,projectedRemoteAfter=rf-peak,memAvailable=mem,clientRSS=rss,projectedExtraClient=536870912,localMemoryFloor=805306368,largestLocal=largest,passAdmission=peak<=67108864 and min(free,rf)-peak>=2982150144 and mem-536870912>=805306368 and largest<=25165824)
 save('resource-'+stage+'.json',j)
 assert j['passAdmission'],j
 return j

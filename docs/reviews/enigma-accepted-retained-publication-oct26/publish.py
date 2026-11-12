import os,sys,json,time,hashlib,resource,subprocess,shutil
from pathlib import Path
H=Path(__file__).resolve().parent; R=H.parent/'repo'
ROOT=Path('/home/user/wine-assembly'); D=Path('/tmp/enigma-mode-independent-publication-oct26/repo')
OLD=D.parent/'ops'; L=ROOT/'scratch/usage-watch/enigma-accepted-retained-publication-oct26'
C='3dd9dda1717b9cd6087a5050224134e8ba9a92a3'; M='9b98bf52af912382d6526df90f88c73936387fc9'
T='3cf4e313888bfc697d3e9468be3dda13cdc54349'; F='6b4c08c1c132f621eadfdc1f2253a43cc1fcc85e'
B='task/enigma-accepted-retained-publication-oct26'; E='docs/reviews/enigma-accepted-retained-publication-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
URL='git@github.com:vgrichina/wine-assembly.git'
resource.setrlimit(resource.RLIMIT_DATA,(16777216,536870912))
resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
resource.setrlimit(resource.RLIMIT_CPU,(120,120))
def save(n,j):
 p=H/n; q=H/(n+'.new');q.write_text(json.dumps(j,indent=2)+'\n');os.replace(q,p)
def sha(p):
 h=hashlib.sha256()
 with Path(p).open('rb') as f:
  while b:=f.read(8192):h.update(b)
 return h.hexdigest()
def alloc(p):
 if not p.exists():return 0
 seen=set();s=0
 for d,ds,fs in os.walk(p) if p.is_dir() else [(p.parent,[],[p.name])]:
  for q in ([Path(d)] if p.is_dir() else [])+[Path(d)/n for n in fs]:
   st=q.lstat();k=st.st_dev,st.st_ino
   if k not in seen:s+=st.st_blocks*512;seen.add(k)
 return s
def admission(phase):
 baseline=json.loads((H/'sqlite-baseline.json').read_text());delta=sum(max(0,alloc(Path(p))-v) for p,v in baseline.items())
 high=H/'sqlite-highwater.json';delta=max(delta,json.loads(high.read_text()) if high.exists() else 0);save(high.name,delta)
 charges=dict(checkoutGitTempEvidence=alloc(H.parent),launcherSession=alloc(L)+alloc(SESSION)+alloc(Path(str(L)+'.task.txt')),positiveWALGrowthOnce=delta,futureSessionDBOnce=12582912,futureGitEvidenceOnce=16777216,reserve=8388608)
 mem=int(Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024;disk=shutil.disk_usage(H).free
 j=dict(phase=phase,time=time.time(),charges=charges,total=sum(charges.values()),cap=67108864,memAvailable=mem,gitData=536870912,client=536870912,helper=16777216,combined=1090519040,memFloor=805306368,diskFree=disk,projectedGrowth=58720256,diskFloor=2982150144)
 j['pass']=j['total']<=67108864 and mem-1090519040>=805306368 and disk-58720256>=2982150144
 save('admission-'+phase+'.json',j);assert j['pass'],j
 return j
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));os.umask(0o002)
def git(*args,repo=R):
 argv=['git','-c','pack.windowMemory=16m','-c','pack.threads=1','-c','pack.window=0','-c','core.preloadIndex=false','-c','index.threads=1','-C',str(repo),*args]
 with (H/'commands.jsonl').open('a') as f:f.write(json.dumps(dict(argv=argv,time=time.time(),data=536870912,threads=1,file=25165824,capture=2097152,output=131072,wall=120))+'\n')
 out=H/'capture.stdout';err=H/'capture.stderr'
 with out.open('wb') as o,err.open('wb') as e:
  p=subprocess.run(argv,stdout=o,stderr=e,env=dict(os.environ,GIT_SSH_COMMAND=SSH,TMPDIR=str(H)),preexec_fn=limits,timeout=120)
 assert out.stat().st_size+err.stat().st_size<=2097152
 assert out.stat().st_size+err.stat().st_size<=131072
 a=out.read_bytes();b=err.read_bytes()
 with (H/'commands.jsonl').open('a') as f:f.write(json.dumps(dict(exit=p.returncode,stdout=a.decode(errors='replace'),stderr=b.decode(errors='replace')))+'\n')
 if p.returncode:raise RuntimeError(f'Git exit {p.returncode}: '+b[:8192].decode(errors='replace'))
 return a.decode().strip()
def remote():
 return {x.split()[1]:x.split()[0] for x in git('ls-remote',URL,'refs/heads/main','refs/heads/'+B,repo=D).splitlines()}
def checkpoint(phase,**kw):save('checkpoint.json',dict(phase=phase,acceptedCommit=C,branch=B,**kw))
try:
 argv=[x.decode() for x in Path('/proc/2318315/cmdline').read_bytes().split(b'\0') if x]
 for v in ['gpt-6.1-sol','model_reasoning_effort="medium"','model_auto_compact_token_limit=200000','model_auto_compact_token_limit_scope="total"']:assert v in argv
 sid=json.loads((L/'events.jsonl').open().readline())['thread_id']
 SESSION=next(Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'.jsonl'))
 save('launch.json',dict(pid=2318315,session=sid,argv=argv,actual=True))
 if not (H/'sqlite-baseline.json').exists():save('sqlite-baseline.json',{str(p):alloc(p) for p in Path('/home/user/.codex').glob('*sqlite*')})
 admission('precheckout')
 old=json.loads((OLD/'result.json').read_text());assert old['commit']==C and old['testedTree']==T and old['finalTree']==F and old['acceptance']=='ACCEPT'
 root=json.loads((ROOT/'scratch/usage-watch/enigma-accepted-root-closeout-oct26.json').read_text());assert root['acceptedCommit']==C and root['committedManifestPayloadsVerified']==65
 cfg=json.loads((OLD/'configuration.json').read_text());assert cfg['ssh']==SSH
 parser=D/'docs/re-notes/enigma-staging-footprint-repair-20261026/parser.json'
 assert sha(parser)==cfg['canonicalMountReceiptSHA256']
 pj=json.loads(parser.read_text());c=cfg['receipt'];assert pj['status']==0 and pj['argv']==c['argv'] and pj['enumeration']==c['enumeration'] and pj['commaFilenames']==c['commaFilenames'] and c['treeMount']
 save('configuration.json',dict(ssh=SSH,canonicalParserReceipt=str(parser),sha256=sha(parser),sameTaskValidated=True,reusedUnchangedExactConfiguration=True,argv=c['argv'],enumeration=c['enumeration'],commaFilenames=c['commaFilenames'],noExecution=True))
 assert git('rev-parse','HEAD',repo=D)==C and git('rev-parse',C+'^{tree}',repo=D)==F
 pins={'tools/enigma-bounded-staging.py':'d3b2a9c152de0a7cfbe61facf1d847d6192e4bd399e1638091417070ffdb1f3b','test/test-enigma-staging-modes.py':'c997e0c733fdfb74dbe437ee5878d7d80695d9adac71914e7abe193ac1c07a4f'}
 for p,h in pins.items():assert sha(D/p)==h
 changes=git('diff','--name-only',T,F,repo=D).splitlines();assert changes and all(p.startswith('docs/reviews/enigma-mode-independent-publication-oct26/') for p in changes)
 manifest=D/'docs/reviews/enigma-mode-independent-publication-oct26/evidence-manifest.json'
 save('reuse.json',dict(acceptedCommit=C,testedTree=T,finalTree=F,postTestDelta=changes,pins=pins,manifest=str(manifest),manifestSHA256=sha(manifest),payloads=65,verification='REUSED coordinator exact-commit verification; no repeated payload rehash or acceptance',rootVerification=root,rootRefReceipt=json.loads((L/'root-ref-digest.json').read_text()),oldIdentityGroup='original readonly-write PermissionError retained; NOT PASS',noGameplayClaim=True,remainingGates=old['remainingGates'][1:]))
 objects=set()
 def visit(p):
  p=p.resolve()
  if p in objects:return
  objects.add(p);a=p/'info/alternates'
  if a.exists():
   for x in a.read_text().splitlines():visit(Path(x) if Path(x).is_absolute() else p/x)
 visit(D/'.git/objects')
 sparse=list(pins)+['docs/reviews/enigma-mode-independent-publication-oct26',E]
 rows=git('ls-tree','-rl',C,'--',*sparse,repo=D).splitlines();size=sum(int(x.split('\t')[0].split()[3]) for x in rows);assert size<8388608
 save('inputs.json',dict(commit=C,sparse=sparse,trackedBytes=size,readonlyDonorObjects=[dict(path=str(p),allocated=alloc(p)) for p in sorted(objects)],standingTools={p:dict(bytes=Path(p).stat().st_size,sha256=sha(p)) for p in ['/usr/bin/git',sys.executable]},donorObjectsChargedSeparately=True))
 refs=remote();save('remote-initial.json',refs);assert refs.get('refs/heads/'+B) is None,'fresh branch already exists'
 assert refs['refs/heads/main']==M,'remote main advanced: integration dependency requires separate affected reconciliation; stop before push'
 git('init','-q',str(R),repo=H)
 (R/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(objects)))
 for k,v in [('user.name','Wine Ops'),('user.email','wine-ops@local'),('core.sparseCheckout','true'),('core.sparseCheckoutCone','false'),('core.sshCommand',SSH),('gc.auto','0'),('pack.windowMemory','16m'),('pack.threads','1'),('pack.window','0')]:git('config',k,v)
 (R/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in sparse))
 git('checkout','-qb',B,C);git('remote','add','origin',URL)
 assert git('status','--porcelain')==''
 admission('pretaskpush');checkpoint('PREPARED_ACCEPTED_COMMIT_TASK_PUSH',remoteBackup=False)
 git('push','origin','HEAD:refs/heads/'+B)
 refs=remote();assert refs['refs/heads/'+B]==C;save('remote-accepted-backup.json',refs);checkpoint('ACCEPTED_COMMIT_REMOTE_BACKUP_VERIFIED',remoteBackup=True,remote=refs)
 print(json.dumps(dict(status='ACCEPTED_REMOTE_BACKUP_VERIFIED',commit=C,refs=refs)),flush=True)
except Exception as e:
 save('failure.json',dict(error=str(e),time=time.time(),noRetry=True));print(json.dumps(dict(status='STOP',error=str(e))),flush=True);sys.exit(1)

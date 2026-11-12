import pathlib as P, subprocess as S, os, json, hashlib, shutil, time, resource, sys, re
T=P.Path('/tmp/vfs-read-abort-main-publication-oct26'); O=T/'ops'; R=T/'repo'
L=P.Path('/home/user/wine-assembly/scratch/usage-watch/vfs-read-abort-main-publication-oct26')
D=P.Path('/tmp/vfs-read-abort-accepted-merged-branch-oct26/repo')
M=P.Path('/tmp/browser-key-reentrant-main-publication-oct26/repo')
MAIN='6449fbab9d0537783ad5fdc5cfdfca826d0153c8'; ACCEPT='2cb2c4a6b36a6d1db25e227fa423dac1ea05d566'
ACCEPT_TREE='0b4372afcb0ce86073d7b22f76d23905cfba4d79'; ACCEPT_TESTED='95cc5acead30a50a0a66097264d5b5625a037801'
B='task/vfs-read-abort-main-publication-oct26'; DOC='docs/reviews/vfs-read-abort-main-publication-oct26'
SOURCE='lib/vfs-persistence.js'; SOURCE_SHA='fc8caa5757face2be6ae9bef9a564d7dfb58fe905d0d7d5fe386ce530cd27351'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0',GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null')
resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def sha(b):return hashlib.sha256(b).hexdigest()
def filehash(p):
 h=hashlib.sha256();n=0
 with p.open('rb') as f:
  while b:=f.read(8192):h.update(b);n+=len(b)
 return dict(bytes=n,sha256=h.hexdigest())
def save(n,x):
 p=O/n;q=p.with_suffix(p.suffix+'.tmp');q.write_text(json.dumps(x,indent=2)+'\n');q.replace(p)
def run(a,cwd=None,inp=None):
 p=S.run(a,cwd=cwd,env=ENV,input=inp,stdout=S.PIPE,stderr=S.PIPE,timeout=90)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072,('capture bound',a)
 assert p.returncode==0,(a,p.returncode,p.stderr[:8192])
 return p.stdout
def git(*a,repo=R,inp=None):return run(['git','-C',str(repo),*a],inp=inp)
def txt(*a):return git(*a).decode().strip()
def blob(rev,p):return git('show',rev+':'+p)
def entries(rev):return {x.split(b'\t',1)[1].decode():x.split(b'\t',1)[0].decode() for x in git('ls-tree','-r',rev).splitlines()}
def measure(stage):
 sid=json.loads((L/'events.jsonl').open().readline())['thread_id']
 paths=[p for d in [T,L] for p in d.rglob('*') if p.is_file() and not p.is_symlink()]
 paths+=list(P.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'*'))
 paths+=[L.with_suffix('.task.txt'),L.with_name(L.name+'-wake.json')]
 seen=set();rows=[]
 for p in paths:
  if not p.exists():continue
  st=p.stat();key=(st.st_dev,st.st_ino)
  if key in seen:continue
  seen.add(key);rows.append(dict(path=str(p),logical=st.st_size,charged=max(st.st_size,st.st_blocks*512)))
 initial=json.loads((O/'admission-baseline.json').read_text())['walInitial']
 wal={str(p):max(0,p.stat().st_size-initial.get(str(p),0)) for p in P.Path('/home/user/.codex').glob('*-wal')}
 used=sum(x['charged'] for x in rows)+sum(wal.values());future=12582912;reserve=8388608;remaining=8388608 if stage=='precheckout' else 4194304
 mem=int(next(x.split()[1] for x in P.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 free=shutil.disk_usage(T).free;peak=used+future+reserve+remaining
 x=dict(stage=stage,at=time.time(),sessionId=sid,files=rows,used=used,positiveWALOnce=wal,futureOnce=future,reserve=reserve,remainingCheckoutGitEvidence=remaining,projectedPeak=peak,allocation=67108864,memAvailable=mem,client=536870912,nodeHeap=16777216,memoryAfter=mem-553648128,memoryFloor=805306368,freeDisk=free,projectedAdmissionGrowth=58720256,diskAfter=free-58720256,diskFloor=2982150144)
 x['pass']=peak<=67108864 and x['memoryAfter']>=805306368 and x['diskAfter']>=2982150144
 save('resources-'+stage+'.json',x);assert x['pass'],{k:v for k,v in x.items() if k!='files'}
 print(stage,'PASS',peak)
 return x
def setup():
 measure('precheckout')
 args=[a.decode() for a in P.Path('/proc/2295474/cmdline').read_bytes().split(b'\0') if a]
 for s in ['gpt-6.1-sol','model_reasoning_effort="medium"','model_auto_compact_token_limit=200000','model_auto_compact_token_limit_scope="total"']:assert s in args
 save('configuration.json',dict(workerPid=2295474,actualArgv=args,ssh=SSH,mountArgv=[],intendedMountFiles=[],mountValidation='N/A offline Git/hash publication only; no guest/mount invocation',trustedGitConfig='system/global disabled; explicit dedicated identity/known-hosts, BatchMode, IdentitiesOnly, StrictHostKeyChecking',commandsCompatible=True,noNativeRuntime=True))
 shutil.copyfile(L/'root-ref-digest.json',O/'initial-root-ref-digest.json')
 tools={}
 for name in ['node','git','python3','ssh']:
  p=P.Path(shutil.which(name)).resolve();tools[name]=dict(path=str(p),**filehash(p),allocated=p.stat().st_blocks*512,standingExecutedInPlace=True)
 save('standing-tools.json',tools)
 stores=set()
 def flat(p):
  p=p.resolve()
  if p in stores:return
  assert p.is_dir();stores.add(p);a=p/'info/alternates'
  if a.exists():
   for s in a.read_text().splitlines():flat(P.Path(s) if s.startswith('/') else p/s)
 for d in [D,M]:flat(d/'.git/objects')
 save('readonly-objects.json',dict(flatAlternates=list(map(str,sorted(stores))),standingBytes=sum(p.stat().st_size for d in stores for p in d.rglob('*') if p.is_file()),copiedBytes=0,donors=[str(D),str(M)]))
 assert not R.exists()
 run(['git','init','-q',str(R)]);(R/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(stores)))
 for k,v in [('gc.auto','0'),('maintenance.auto','false'),('user.name','Wine Ops'),('user.email','wine-ops@localhost'),('pack.threads','1'),('pack.windowMemory','16m')]:git('config',k,v)
 git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
 remote=txt('ls-remote','--refs','origin','refs/heads/main','refs/heads/task/vfs-read-abort-accepted-merged-branch-oct26','refs/heads/'+B)
 save('remote-main-initial.json',dict(exact=remote,ssh=SSH))
 assert set(remote.splitlines())=={MAIN+'\trefs/heads/main',ACCEPT+'\trefs/heads/task/vfs-read-abort-accepted-merged-branch-oct26'},'remote inputs moved or target exists'
 assert txt('rev-parse',ACCEPT+'^{tree}')==ACCEPT_TREE
 before=entries(ACCEPT_TESTED);after=entries(ACCEPT)
 accepted_docs_delta=[p for p in set(before)|set(after) if before.get(p)!=after.get(p)]
 assert all(p.startswith('docs/reviews/vfs-read-abort-accepted-merged-branch-oct26/') for p in accepted_docs_delta)
 base=txt('merge-base',MAIN,ACCEPT)
 result=txt('merge-tree','--write-tree',MAIN,ACCEPT);assert len(result)==40,('unexpected merge output',result[:8192])
 tree=result;main=entries(MAIN);merged=entries(tree);accepted=entries(ACCEPT)
 changed=[p for p in sorted(set(main)|set(merged)) if main.get(p)!=merged.get(p)]
 assert [p for p in changed if not p.startswith(('docs/','test/'))]==[SOURCE]
 for p in changed:assert merged.get(p)==accepted.get(p),('nonexact incoming path',p)
 assert sha(blob(tree,SOURCE))==SOURCE_SHA
 git('symbolic-ref','HEAD','refs/heads/'+B);git('update-ref','refs/heads/'+B,MAIN);git('read-tree',tree)
 # Full index, no full checkout. Only inspected production and identity proof files materialized.
 for p in [SOURCE]:
  out=R/p;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(blob(tree,p));out.chmod(int(merged[p].split()[0],8)&0o777)
 git('update-index','--skip-worktree','-z','--stdin',inp=git('ls-files','-z'))
 save('preservation.json',dict(main=MAIN,acceptance=ACCEPT,mergeBase=base,testedTree=tree,acceptedTestedTree=ACCEPT_TESTED,acceptedFinalTree=ACCEPT_TREE,acceptedDocsOnlyDelta=sorted(accepted_docs_delta),changedPaths=changed,allIncomingEntriesEqualAccepted=True,allUnrelatedBytesAndModesPreserved=True,semanticResolutions=0,rawDiff=git('diff','--raw',MAIN,tree).decode()))
 save('tested-tree.json',dict(main=MAIN,acceptance=ACCEPT,testedTree=tree,productionSha256=SOURCE_SHA))
 save('checkpoint-merged.json',dict(completed='conflict-free actual merge, exact accepted incoming entries, complete unrelated bytes/modes preservation',testedTree=tree,remaining=['source/fixture/dependency/tools proof','docs commit','verified task/main publication']))
 measure('merged');print('merged',tree,'changed paths',len(changed))
def validate():
 measure('prevalidation');tree=json.loads((O/'tested-tree.json').read_text())['testedTree'];ent=entries(tree);old=entries(ACCEPT)
 folder='docs/reviews/vfs-read-abort-accepted-merged-branch-oct26';identity=json.loads(blob(ACCEPT,folder+'/identity-reuse.json'))
 verified={}
 for name,expected in [('vfs-read-abort-accepted-merged-branch-oct26',14),('vfs-read-abort-independent-accept-oct26',23),('vfs-indexeddb-read-abort-repair-oct26',17),('vfs-bounded-restore-merged-branch-oct26',23)]:
  root='docs/reviews/'+name;data=blob(ACCEPT,root+'/evidence-manifest.json');m=json.loads(data);payload=m.get('payloads',m);assert len(payload)==expected
  rows=[]
  for p,e in payload.items():
   full=p if p.startswith(('lib/','test/','docs/')) else root+'/'+p
   b=blob(ACCEPT,full);assert dict(bytes=len(b),sha256=sha(b))=={k:e[k] for k in ['bytes','sha256']};assert blob(tree,full)==b
   rows.append(dict(path=full,bytes=len(b),sha256=sha(b)))
  verified[name]=dict(manifest=dict(bytes=len(data),sha256=sha(data)),payloads=rows)
 save('accepted-payload-verification.json',dict(acceptance=ACCEPT,testedTree=tree,manifests=verified,total=77))
 rows={}
 def visit(p):
  if p in rows:return
  data=blob(ACCEPT,p);assert blob(tree,p)==data and ent[p]==old[p],('changed relevant source dependency',p)
  rows[p]=dict(entry=ent[p],bytes=len(data),sha256=sha(data))
  for rel in re.findall(rb"require\(['\"](\.[^'\"]+)['\"]\)",data):
   path=os.path.normpath(str(P.Path(p).parent/rel.decode()))
   if path not in ent and path+'.js' in ent:path+='.js'
   assert path in ent,('unresolved local dependency',p,path)
   visit(path)
 for p,e in identity['closure'].items():
  visit(p);assert rows[p]['sha256']==e['sha256'] and rows[p]['bytes']==e['bytes']
  if 'blob' in e:assert ent[p].split()[-1]==e['blob']
 for f,e in identity['tools'].items():assert filehash(P.Path(f))==e
 # Relevant inherited environment does not alter the accepted fixture invocation.
 assert not os.environ.get('NODE_OPTIONS') and not os.environ.get('NODE_PATH')
 save('closure-reuse.json',dict(accepted=ACCEPT,acceptedTestedTree=ACCEPT_TESTED,mergedTestedTree=tree,sourceFixturesDependencies=rows,tools=identity['tools'],environment={'NODE_OPTIONS':None,'NODE_PATH':None},groupsReused=identity['reused'],changedDependencies=[],newTestRuns=0,affectedCompatibility='none: production, fixtures, recursive CommonJS dependencies and installed tools identical; app-files/browser publications disjoint from this closure'))
 save('checkpoint-validated.json',dict(status='VALIDATED',candidate=ACCEPT,testedTree=tree,sourceFixtureDependencyIdentity=True,evidence='closure-reuse.json and accepted-payload-verification.json',groupsReused=identity['reused'],newTestRuns=0,remaining=['documentation-only finalization','task push exact verification','ordinary FF main exact verification','real browser durability/reload/restart/storage failure','runtime/gameplay']))
 measure('validated');print('77 accepted payloads verified; exact closure and tools; passing groups REUSED, zero reruns')
if __name__=='__main__':globals()[sys.argv[1]]()

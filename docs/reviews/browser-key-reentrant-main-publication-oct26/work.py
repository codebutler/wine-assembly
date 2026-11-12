import pathlib as P, subprocess as S, os, json, hashlib, shutil, time, resource, sys, re
ROOT=P.Path('/tmp/browser-key-reentrant-main-publication-oct26'); O=ROOT/'ops'; R=ROOT/'repo'
L=P.Path('/home/user/wine-assembly/scratch/usage-watch/browser-key-reentrant-main-publication-oct26')
D=P.Path('/tmp/browser-key-reentrant-accepted-merged-branch-oct26/repo'); M=P.Path('/tmp/app-files-merged-main-publication-oct26/repo')
BASE='af39b18a9afa37df2e37bb0f27db004ff4cbc20a'; MAIN='f008f78fcb1c33f91d3c2f02d49c79a8fff148fa'; ACCEPT='aaf61ce5ff3560d3c8fd7c3b439f6498b9947ee9'
B='task/browser-key-reentrant-main-publication-oct26'; DOC='docs/reviews/browser-key-reentrant-main-publication-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0',GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL='/dev/null')
resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,x): (O/n).write_text(json.dumps(x,indent=2)+'\n')
def run(a,cwd=None):
 p=S.run(a,cwd=cwd,env=ENV,stdout=S.PIPE,stderr=S.PIPE,timeout=60)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072,'capture/output limit'
 assert p.returncode==0,(a,p.returncode,p.stderr[:2000])
 return p.stdout
def git(*a,repo=R):return run(['git','-C',str(repo),*a])
def blob(rev,p):return git('show',rev+':'+p)
def entries(rev):return {x.split(b'\t',1)[1].decode():x.split(b'\t',1)[0].decode() for x in git('ls-tree','-r',rev).splitlines()}
def measure(stage):
 sid=json.loads((L/'events.jsonl').open().readline())['thread_id']
 files=[p for d in [ROOT,L] for p in d.rglob('*') if p.is_file() and not p.is_symlink()]
 files+=list(P.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'*'))
 files+=list(P.Path('/home/user/.codex').glob('*-wal'))
 files+=[L.with_suffix('.task.txt'),L.with_name(L.name+'-wake.json')]
 seen=set();rows=[]
 for p in files:
  if not p.exists():continue
  st=p.stat();key=(st.st_dev,st.st_ino)
  if key in seen:continue
  seen.add(key);rows.append(dict(path=str(p),logical=st.st_size,charged=max(st.st_size,st.st_blocks*512)))
 used=sum(x['charged'] for x in rows);future=12582912;reserve=8388608;remaining=8388608 if stage=='precheckout' else 4194304
 mem=int(next(x.split()[1] for x in P.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 free=shutil.disk_usage(ROOT).free; projected=used+future+reserve+remaining
 # Entire current shared WAL charged once: conservative superset of positive task delta.
 x=dict(stage=stage,at=time.time(),sessionId=sid,files=rows,used=used,walAccounting='entire current WAL charged once, conservative positive-delta superset',futureOnce=future,reserve=reserve,remainingCheckoutGitEvidence=remaining,projectedPeak=projected,allocation=67108864,memAvailable=mem,client=536870912,nodeHeap=16777216,memoryAfter=mem-553648128,memoryFloor=805306368,freeDisk=free,projectedAdmissionGrowth=58720256,diskAfter=free-58720256,diskFloor=2982150144)
 x['pass']=projected<=67108864 and x['memoryAfter']>=805306368 and x['diskAfter']>=2982150144
 save('resources-'+stage+'.json',x);assert x['pass'],{k:v for k,v in x.items() if k!='files'}
 print(stage,'PASS',projected)
def setup():
 measure('precheckout')
 argv=P.Path('/proc/2288703/cmdline').read_bytes().split(b'\0');args=[a.decode() for a in argv if a]
 assert 'gpt-6.1-sol' in args and 'model_reasoning_effort="medium"' in args and 'model_auto_compact_token_limit=200000' in args and 'model_auto_compact_token_limit_scope="total"' in args
 save('configuration.json',dict(workerPid=2288703,actualArgv=args,ssh=SSH,trustedGitConfiguration=dict(globalDisabled=True,systemDisabled=True,origin='git@github.com:vgrichina/wine-assembly.git'),mountArgv=[],intendedMountFiles=[],mountValidation='N/A: no guest or mount invocation; no conditional runtime authorized',limits=dict(file=25165824,output=131072,capture=2097152,excerpt=8192,instructions=65536,nodeHeap=16777216,nodeWallSeconds=30)))
 shutil.copyfile(L/'root-ref-digest.json',O/'initial-root-ref-digest.json')
 tools={}
 for name in ['node','git','python3','ssh']:
  p=P.Path(shutil.which(name)).resolve();st=p.stat();tools[name]=dict(path=str(p),bytes=st.st_size,allocated=st.st_blocks*512,sha256=sha(p.read_bytes()),standingExecutedInPlace=True)
 save('standing-tools.json',tools)
 stores=set()
 def flat(p):
  p=p.resolve()
  if p in stores:return
  assert p.is_dir();stores.add(p);a=p/'info/alternates'
  if a.exists():
   for s in a.read_text().splitlines():flat(P.Path(s) if s.startswith('/') else p/s)
 for d in [D,M]:flat(d/'.git/objects')
 save('readonly-objects.json',dict(flatAlternates=list(map(str,sorted(stores))),standingBytes=sum(p.stat().st_size for d in stores for p in d.rglob('*') if p.is_file()),copiedBytes=0))
 run(['git','init','-q',str(R)]);(R/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(stores)))
 git('config','gc.auto','0');git('config','maintenance.auto','false');git('config','user.name','Wine Ops');git('config','user.email','wine-ops@localhost')
 git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
 remote=git('ls-remote','--refs','origin','refs/heads/main').decode().strip()
 save('remote-main-initial.json',dict(exact=remote,readCount=1,ssh=SSH));assert remote==MAIN+'\trefs/heads/main','main moved; immutable donor reconciliation needed'
 assert git('rev-parse',ACCEPT+'^').decode().strip()==BASE
 assert git('rev-parse',ACCEPT+'^{tree}').decode().strip()=='516e9d4e503aeba231b9b7aa3c193d45e10d7182'
 base=entries(BASE);main=entries(MAIN);accepted=entries(ACCEPT)
 changed={p for p in set(base)|set(accepted) if base.get(p)!=accepted.get(p)}
 intervening={p for p in set(base)|set(main) if base.get(p)!=main.get(p)}
 assert not changed&intervening,('semantic overlap',sorted(changed&intervening))
 assert [p for p in sorted(changed) if not p.startswith(('docs/','test/'))]==['lib/browser-input.js']
 git('symbolic-ref','HEAD','refs/heads/'+B);git('update-ref','refs/heads/'+B,MAIN);git('read-tree',MAIN)
 for p in sorted(changed):
  assert p in accepted,'unexpected accepted deletion'
  mode,typ,oid=accepted[p].split();git('update-index','--add','--cacheinfo',mode+','+oid+','+p)
 tested=git('write-tree').decode().strip();merged=entries(tested)
 assert {p for p in set(main)|set(merged) if main.get(p)!=merged.get(p)}==changed
 for p in changed:assert merged[p]==accepted[p]
 assert sha(blob(tested,'lib/browser-input.js'))=='5b2c47fa0b901f0323bc04df34ff27d8c50e47a001d77e9dcae3f2986a3477f0'
 assert sha(blob(tested,'lib/vfs-persistence.js'))=='2224f8b74469606696065ea799931bc192982a608dc2a7ec0e9a690d20a4552e'
 # Sparse checkout: retain complete index, materialize only production and tests required by this task.
 paths=['lib/browser-input.js','lib/renderer-input.js','lib/mem-utils.js','lib/region-map.generated.js']+[p for p in changed if p.startswith('test/')]
 for p in paths:
  out=R/p;out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(blob(tested,p));out.chmod(int(merged[p].split()[0],8)&0o777)
 tracked=git('ls-files','-z');q=S.run(['git','-C',str(R),'update-index','--skip-worktree','-z','--stdin'],input=tracked,stdout=S.PIPE,stderr=S.PIPE,env=ENV);assert q.returncode==0
 save('preservation.json',dict(base=MAIN,accepted=ACCEPT,acceptedParent=BASE,testedTree=tested,changedPaths=sorted(changed),interveningPaths=sorted(intervening),overlap=[],allOtherBytesAndModesPreserved=True,rendererPreserved=True,vfsBoundsSha256=sha(blob(tested,'lib/vfs-persistence.js')),rawDiff=git('diff','--raw',MAIN,tested).decode()))
 save('tested-tree.json',dict(main=MAIN,accepted=ACCEPT,testedTree=tested,acceptedTestedTree='283017349df763344984847095ee3ffb198e383f'))
 print('disjoint merged tree',tested)
def validate():
 measure('prevalidation');tested=json.loads((O/'tested-tree.json').read_text())['testedTree'];folder='docs/reviews/browser-key-reentrant-accepted-merged-branch-oct26'
 checked={}
 def manifest_check(folder,expected):
  manifest=json.loads(blob(ACCEPT,folder+'/evidence-manifest.json'));assert len(manifest)==expected
  rows=[]
  for p,e in manifest.items():
   full=p if p.startswith(('lib/','test/','docs/')) else folder+'/'+p
   data=blob(ACCEPT,full);assert sha(data)==e['sha256'] and len(data)==e['bytes'];assert blob(tested,full)==data
   rows.append(dict(path=full,sha256=sha(data),bytes=len(data)))
  checked[folder]=rows
 manifest_check(folder,20)
 manifest_check('docs/reviews/browser-key-reentrant-retained-accept-oct26',61)
 manifest_check('docs/reviews/renderer-side-polling-merged-branch-oct26',46)
 save('accepted-payload-verification.json',dict(accepted=ACCEPT,manifests=checked,total=127))
 identity=json.loads(blob(ACCEPT,folder+'/identity-reuse.json'));rows={};ent=entries(tested)
 # Complete source and all accepted test fixtures are invariant. Resolve explicit
 # local CommonJS dependencies recursively; no changed dependency may reuse tests.
 def visit(p):
  if p in rows:return
  data=blob(ACCEPT,p);assert blob(tested,p)==data and ent[p]==entries(ACCEPT)[p],('changed dependency',p)
  rows[p]=dict(entry=ent[p],sha256=sha(data),bytes=len(data))
  for rel in re.findall(rb"require\(['\"](\.[^'\"]+)['\"]\)",data):
   path=os.path.normpath(str(P.Path(p).parent/rel.decode()))
   if path not in ent and path+'.js' in ent:path+='.js'
   assert path in ent,('unresolved local dependency',p,path)
   visit(path)
 for row in identity['sourceClosure']:
  visit(row['path']);assert rows[row['path']]['sha256']==row['sha256']
 for p in entries(ACCEPT):
  if p.startswith('test/') and (p.endswith(('.js','.cjs')) and ('browser-key' in p or 'keyboard-focus-renderer' in p or 'renderer-input' in p or 'renderer-side' in p)):
   visit(p)
 for p in identity['acceptancePaths']:
  if p.startswith('test/'):visit(p)
 tools=[]
 for row in identity['tools']:
  path=P.Path(shutil.which(row['name'])).resolve()
  assert str(path)==row['path'] and path.stat().st_size==row['bytes'] and sha(path.read_bytes())==row['sha256']
  tools.append(row)
 assert all(os.environ.get(k)==v for k,v in identity['environmentOverrides'].items())
 assert identity['historicalAggregateFailures']==3 and identity['changedDependencies']==[]
 assert identity['groupsReused']==dict(unchanged=7,reentrant=7,crosslayer=25,rejectingControls=2,renderer='119 plus legacy')
 save('closure-reuse.json',dict(accepted=ACCEPT,mergedTestedTree=tested,sourceFixtures=rows,tools=tools,groupsReused=identity['groupsReused'],changedDependencies=[],newTestExecutions=0,historicalAggregateFailures=3,reason='All accepted sources, fixtures, recursively resolved local dependencies, installed Node and environment identities unchanged. Intervening app-files changes have no edge into these tests.'))
 save('checkpoint.json',dict(status='VALIDATED',candidate=ACCEPT,testedTree=tested,sourceDependencyIdentity=True,groupsReused=identity['groupsReused'],newTestExecutions=0,historicalAggregateFailures=3,remaining=['docs finalization','task branch push','serialized FF main','exact remote refs','actual browser focus/removal','guest/runtime/gameplay']))
 measure('validated');print('127 payloads verified; unchanged exact source/fixture/dependency/Node closure; accepted groups reused')
if __name__=='__main__':globals()[sys.argv[1]]()

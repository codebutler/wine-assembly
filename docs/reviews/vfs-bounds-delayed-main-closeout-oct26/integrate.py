import os, pathlib as P, subprocess as S, json, hashlib as H, shutil, time, resource, re, sys
ROOT=P.Path('/tmp/vfs-bounds-delayed-main-closeout-oct26'); OPS=ROOT/'ops'; REPO=ROOT/'repo'
DONOR=P.Path('/tmp/vfs-bounded-restore-merged-branch-oct26/repo'); MAIN=P.Path('/tmp/renderer-side-polling-main-retained-closeout-oct26/repo')
BASE='c3d394149406189cf1c5dbbc434491f0130666c9'; PARENT='12e2dccc0ca16bbc327f2773f3352e8dfa787cb4'; ACCEPT='e9ef28613b8d6148ff50962850760f2c37e87184'
BRANCH='task/vfs-bounds-delayed-main-closeout-oct26'; DOC='docs/reviews/vfs-bounds-delayed-main-closeout-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0')
resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def sha(b): return H.sha256(b).hexdigest()
def write(name,obj): (OPS/name).write_text(json.dumps(obj,indent=2)+'\n')
def run(args,cwd=None):
 p=S.run(args,cwd=cwd,env=ENV,stdout=S.PIPE,stderr=S.PIPE,timeout=60)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072
 assert p.returncode==0,(args,p.returncode,p.stderr[:2000])
 return p.stdout
def git(*args,repo=REPO): return run(['git','-C',str(repo),*args])
def measure(stage):
 launcher=P.Path('/home/user/wine-assembly/scratch/usage-watch/vfs-bounds-delayed-main-closeout-oct26')
 files=[p for d in [ROOT,launcher] for p in d.rglob('*') if p.is_file() and not p.is_symlink()]
 sid=json.loads((launcher/'events.jsonl').open().readline())['thread_id']
 files+=list(P.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'*'))
 files+=list(P.Path('/home/user/.codex').glob('*-wal'))
 files+=[launcher.with_suffix('.task.txt'),launcher.with_name(launcher.name+'-wake.json')]
 seen=set(); rows=[]
 for p in files:
  if not p.exists():continue
  st=p.stat(); key=(st.st_dev,st.st_ino)
  if key in seen:continue
  seen.add(key);rows.append({'path':str(p),'logical':st.st_size,'charged':max(st.st_size,st.st_blocks*512)})
 used=sum(r['charged'] for r in rows); remaining=12*1024**2 if stage=='precheckout' else 4*1024**2; growth=12*1024**2+remaining+8*1024**2
 mem=int(next(x.split()[1] for x in P.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024; free=shutil.disk_usage(ROOT).free
 obj=dict(stage=stage,at=time.time(),files=rows,ownedBytesPositiveWalOnce=used,futureSessionWalOnce=12582912,checkoutGitEvidenceGrowth=remaining,reserve=8388608,projectedPeak=used+growth,hardLimit=67108864,memAvailable=mem,clientHeap=553648128,memoryFloor=805306368,freeDisk=free,diskFloor=2982150144)
 obj['pass']=used+growth<=67108864 and mem-553648128>=805306368 and free-growth>=2982150144
 write('resources-'+stage+'.json',obj);assert obj['pass'],{k:v for k,v in obj.items() if k!='files'}
 print(stage,used,obj['projectedPeak'],'PASS')
def setup():
 measure('precheckout')
 tools={}
 for name in ['node','git','python3']:
  p=P.Path(shutil.which(name)).resolve();st=p.stat();tools[name]=dict(path=str(p),sha256=sha(p.read_bytes()),bytes=st.st_size,allocated=st.st_blocks*512,mtimeNs=st.st_mtime_ns,ctimeNs=st.st_ctime_ns,standingExecutedInPlace=True)
 write('tools.json',tools)
 write('configuration.json',dict(ssh=SSH,mountArgv=[],intendedFiles=[],mountValidation='No mounts or runtime invocation; filename-bearing parser checkpoint not applicable',limits=dict(file=25165824,output=131072,capture=2097152,excerpt=8192,nodeHeap=16777216)))
 stores=set()
 def flat(p):
  p=p.resolve()
  if p in stores:return
  stores.add(p);a=p/'info/alternates'
  if a.exists():
   for line in a.read_text().splitlines():flat(P.Path(line) if line.startswith('/') else p/line)
 for d in [DONOR,MAIN]:flat(d/'.git/objects')
 write('readonly-objects.json',dict(flatAlternates=list(map(str,sorted(stores))),standingBytes=sum(p.stat().st_size for d in stores for p in d.rglob('*') if p.is_file())))
 run(['git','init','-q',str(REPO)]);(REPO/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(stores)))
 git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');git('config','user.name','Wine Assembly Agent');git('config','user.email','agent@wine-assembly.local')
 remote=git('ls-remote','--refs','origin','refs/heads/main').decode().strip();write('remote-main-initial.json',dict(exact=remote,ssh=SSH,readCount=1));assert remote==BASE+'\trefs/heads/main', 'main moved: reconcile before continuing'
 assert git('rev-parse',ACCEPT+'^').decode().strip()==PARENT
 git('config','core.sparseCheckout','true');(REPO/'.git/info/sparse-checkout').write_text('/lib/vfs-persistence.js\n/test/*vfs*\n/'+DOC+'/\n')
 git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('update-ref','refs/heads/'+BRANCH,BASE);git('read-tree','-m','-u',BASE)
 patch=git('diff','--binary',PARENT,ACCEPT);(OPS/'accepted.patch').write_bytes(patch)
 git('apply','--cached','--check',str(OPS/'accepted.patch'));git('apply','--cached',str(OPS/'accepted.patch'))
 tree=git('write-tree').decode().strip();git('read-tree','--reset','-u',tree)
 write('tested-tree.json',dict(base=BASE,accepted=ACCEPT,testedTree=tree,patchSha256=sha(patch)))
 print('merged',tree)
def validate():
 measure('prevalidation');tree=json.loads((OPS/'tested-tree.json').read_text())['testedTree']
 folder='docs/reviews/vfs-bounded-restore-merged-branch-oct26'; manifest=json.loads(git('show',ACCEPT+':'+folder+'/evidence-manifest.json')); verified=[]
 for p,e in manifest.items():
  data=git('show',ACCEPT+':'+folder+'/'+p);assert sha(data)==e['sha256'] and len(data)==e['bytes'];verified.append(p)
 write('accepted-payload-verification.json',dict(commit=ACCEPT,manifestSha256=sha(git('show',ACCEPT+':'+folder+'/evidence-manifest.json')),verified=verified,count=len(verified)))
 closure=json.loads(git('show',ACCEPT+':'+folder+'/compatibility-closure.json')); paths=set(closure)|{'test/vfs-persistence-bounded-restore-oct26.test.cjs','test/vfs-bounded-restore-independent-oct26.test.cjs'}
 rows={}
 def visit(p):
  if p in rows:return
  old=git('show',ACCEPT+':'+p);new=git('show',tree+':'+p);assert old==new,('changed closure',p)
  rows[p]=dict(blob=git('rev-parse',tree+':'+p).decode().strip(),sha256=sha(new),bytes=len(new),identical=True)
  for dep in re.findall(rb"require\(['\"](\.[^'\"]+)['\"]\)",new):
   path=os.path.normpath(str(P.Path(p).parent/dep.decode()));visit(path if path.endswith(('.js','.cjs','.json')) else path+'.js')
 for p in sorted(paths):visit(p)
 node=P.Path(shutil.which('node')).resolve();st=node.stat();admission=json.loads(P.Path('/tmp/vfs-bounded-restore-independent-accept-oct26/ops/admission.json').read_text())
 assert node==P.Path(admission['standingTools']['node']).resolve();assert st.st_mtime<1792996500 and st.st_ctime<1792996500
 write('closure-reuse.json',dict(accepted=ACCEPT,acceptedTestedTree='434b5d318ead33cec9be1b03d1fc0607e5be6f93',mergedTestedTree=tree,paths=rows,node=dict(path=str(node),sha256=sha(node.read_bytes()),version=run([str(node),'--max-old-space-size=16','--version']).decode().strip(),mtime=st.st_mtime,ctime=st.st_ctime,identityBasis='same installed executable path; inode metadata predates accepted executions; current hash bound here, historical receipts did not record executable hash'),reused=['17 supplied PASS','14 independent PASS / 550 bounded calls','baseline 9 PASS 8 FAIL expected','Darkstone 64MiB PASS','two merged compatibility suites PASS'],newTestExecutions=0,reason='entire source, fixture and recursively resolved local CommonJS closure byte-identical; intervening renderer has no dependency edge'))
 changed=git('diff','--name-only',BASE,tree).decode().splitlines();accepted=git('diff','--name-only',PARENT,ACCEPT).decode().splitlines();assert changed==accepted
 for p in changed:assert git('ls-tree',tree,'--',p)==git('ls-tree',ACCEPT,'--',p)
 assert [p for p in changed if not p.startswith(('docs/','test/'))]==['lib/vfs-persistence.js']
 write('preservation.json',dict(base=BASE,tree=tree,accepted=ACCEPT,exactAcceptedPaths=changed,allOtherBytesAndModesPreserved=True,rendererPreserved=True,excludedRepairs=['980edba abort repair','app-files repairs','browser ownership repairs'],rawDiff=git('diff','--raw',BASE,tree).decode()))
 write('checkpoint.json',dict(status='VALIDATED',testedTree=tree,closureIdentical=True,newTests=0,remaining=['docs finalization','task push','main FF and exact verification']))
 print('closure PASS',len(rows),'manifest PASS',len(verified))
if __name__=='__main__':globals()[sys.argv[1]]()

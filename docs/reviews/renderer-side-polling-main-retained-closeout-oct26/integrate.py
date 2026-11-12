import os, pathlib as P, subprocess as S, json, hashlib as H, shutil, time, resource
ROOT=P.Path('/tmp/renderer-side-polling-main-retained-closeout-oct26'); OPS=ROOT/'ops'; REPO=ROOT/'repo'
DONOR=P.Path('/tmp/renderer-side-polling-merged-branch-oct26/repo'); PARSER=P.Path('/tmp/file-bundle-parser-accepted-integrate-oct26/repo')
BASE='12e2dccc0ca16bbc327f2773f3352e8dfa787cb4'; PARENT='d6168240d93f2a92d401a6264efab0c3985e1ba0'; ACCEPT='0d2aaf964b31d4191a76cf84900d7433b4611fa4'
BRANCH='task/renderer-side-polling-main-retained-closeout-oct26'; DOC='docs/reviews/renderer-side-polling-main-retained-closeout-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0')
resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
def sha(b): return H.sha256(b).hexdigest()
def write(name,obj): (OPS/name).write_text(json.dumps(obj,indent=2)+'\n')
def run(args,cwd=None):
 p=S.run(args,cwd=cwd,env=ENV,stdout=S.PIPE,stderr=S.PIPE,timeout=60)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072
 assert p.returncode==0,(args,p.returncode,p.stderr[:2000])
 return p.stdout
def git(*args,repo=REPO): return run(['git','-C',str(repo),*args])
def measure(stage):
 launcher=P.Path('/home/user/wine-assembly/scratch/usage-watch/renderer-side-polling-main-retained-closeout-oct26')
 sessions=[]
 for p in launcher.glob('*'):
  if p.is_file() and p.suffix=='.json':
   try:
    data=json.loads(p.read_text())
    for k,v in data.items():
     if isinstance(v,str) and v.startswith('/home/user/.codex/sessions/') and P.Path(v).is_file(): sessions.append(P.Path(v))
   except (ValueError,AttributeError): pass
 files=set(p for d in [ROOT,launcher] for p in d.rglob('*') if p.is_file() and not p.is_symlink())|set(sessions)
 events=launcher/'events.jsonl'
 if events.exists():
  first=json.loads(events.open().readline()); sid=first['thread_id']
  files.update(P.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'*'))
 files.update(p for p in P.Path('/home/user/.codex').glob('*-wal') if p.stat().st_size>0)
 rows=[{'path':str(p),'bytes':p.stat().st_size,'allocated':p.stat().st_blocks*512} for p in sorted(files)]
 used=sum(max(r['bytes'],r['allocated']) for r in rows)
 mem=int(next(x.split()[1] for x in P.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 free=shutil.disk_usage(ROOT).free; growth=12*1024**2+12*1024**2+8*1024**2
 obj={'stage':stage,'at':time.time(),'files':rows,'ownedIncludingPositiveSharedWalOnce':used,'futureSessionLauncherWal':12*1024**2,'checkoutEvidenceGitGrowth':12*1024**2,'reserve':8*1024**2,'projectedPeak':used+growth,'allocation':64*1024**2,'memAvailable':mem,'afterClientHeap':mem-553648128,'freeDisk':free,'freeAfterGrowth':free-growth}
 obj['pass']=obj['projectedPeak']<=64*1024**2 and obj['afterClientHeap']>=805306368 and obj['freeAfterGrowth']>=2982150144
 write('resources-'+stage+'.json',obj); assert obj['pass'],{k:v for k,v in obj.items() if k!='files'}
 print(stage,'PASS',used,obj['projectedPeak'],mem,free)
def setup():
 measure('precheckout')
 tools={}
 for name in ['node','git','python3']:
  p=P.Path(shutil.which(name)).resolve(); tools[name]={'path':str(p),'bytes':p.stat().st_size,'allocated':p.stat().st_blocks*512,'sha256':sha(p.read_bytes()),'standingExecutedInPlace':True}
 write('standing-tools.json',tools)
 write('configuration.json',{'ssh':SSH,'mountArgv':None,'intendedFiles':[],'mountValidation':'No mount or guest execution; conditional mount parser checkpoint not applicable','limits':'24MiB file,128KiB output,2MiB capture,8192-byte excerpts; no new Node execution required if unchanged dependency closure'})
 objects=set()
 def flat(p):
  p=p.resolve()
  if p in objects:return
  objects.add(p)
  alt=p/'info/alternates'
  if alt.exists():
   for s in alt.read_text().splitlines(): flat(P.Path(s) if s.startswith('/') else p/s)
 for d in [DONOR,PARSER]: flat(d/'.git/objects')
 write('readonly-objects.json',{'flatAlternates':list(map(str,sorted(objects))),'standingBytes':sum(p.stat().st_size for d in objects for p in d.rglob('*') if p.is_file())})
 run(['git','init','-q',str(REPO)])
 (REPO/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(objects)))
 git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git');git('config','user.name','Wine Assembly Agent');git('config','user.email','agent@wine-assembly.local')
 remote=git('ls-remote','--refs','origin','refs/heads/main').decode().strip();write('remote-main-initial.json',{'exact':remote});assert remote==BASE+'\trefs/heads/main'
 git('config','core.sparseCheckout','true')
 (REPO/'.git/info/sparse-checkout').write_text('/lib/renderer-input.js\n/lib/mem-utils.js\n/lib/region-map.generated.js\n/test/renderer-*modifiers*.cjs\n/test/renderer-*modifier*.cjs\n/test/renderer-side-polling-independent-oct26.test.cjs\n/docs/reviews/renderer-side-polling-merged-branch-oct26/\n/'+DOC+'/\n')
 git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('update-ref','refs/heads/'+BRANCH,BASE);git('read-tree','-m','-u',BASE)
 patch=git('diff','--binary',PARENT,ACCEPT);(OPS/'accepted.patch').write_bytes(patch)
 git('apply','--cached','--check',str(OPS/'accepted.patch'));git('apply','--cached',str(OPS/'accepted.patch'))
 tree=git('write-tree').decode().strip();git('read-tree','--reset','-u',tree)
 write('tested-tree.json',{'base':BASE,'accepted':ACCEPT,'testedTree':tree,'patchSha256':sha(patch)})
 print('reconciled',tree)
if __name__=='__main__':setup()

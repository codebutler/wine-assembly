import os, pathlib as P, subprocess as S, json, hashlib as H, shutil, resource, time
ROOT=P.Path('/tmp/renderer-aggregate-press-consumption-delayed-repair-oct26'); OPS=ROOT/'ops'; REPO=ROOT/'repo'
HOST=P.Path('/home/user/wine-assembly'); DONOR=P.Path('/tmp/renderer-side-polling-main-retained-closeout-oct26/repo')
REV='c3d394149406189cf1c5dbbc434491f0130666c9'; BRANCH='task/renderer-aggregate-press-consumption-delayed-repair-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0')
resource.setrlimit(resource.RLIMIT_FSIZE,(24*1024**2,24*1024**2))
def sha(b): return H.sha256(b).hexdigest()
def write(n,o):
 p=OPS/n; t=p.with_suffix(p.suffix+'.tmp'); t.write_text(json.dumps(o,indent=2)+'\n'); t.replace(p)
def run(args,cwd=None,expected=0):
 def limits():
  # Git's finite data allowance is within the 512MiB client allocation.
  if args[0]=='git': resource.setrlimit(resource.RLIMIT_DATA,(256*1024**2,256*1024**2))
 p=S.run(args,cwd=cwd,env=ENV,stdout=S.PIPE,stderr=S.PIPE,timeout=60,preexec_fn=limits)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072
 assert p.returncode==expected,(args,p.returncode,p.stderr[:2000])
 return p.stdout
def git(*a,repo=REPO): return run(['git','-C',str(repo),*a])
def measure(stage):
 launcher=HOST/'scratch/usage-watch/renderer-aggregate-press-consumption-delayed-repair-oct26'
 files=set(p for d in [ROOT,launcher] for p in d.rglob('*') if p.is_file() and not p.is_symlink())
 files.update(P.Path('/home/user/.codex/sessions/2026/10/26').glob('*01a17747-2ed0-7de2-83bc-3329280cba21*'))
 files.update(p for p in P.Path('/home/user/.codex').glob('*-wal') if p.stat().st_size>0)
 rows=[{'path':str(p),'bytes':p.stat().st_size,'allocated':p.stat().st_blocks*512} for p in sorted(files)]
 used=sum(max(r['bytes'],r['allocated']) for r in rows)
 mem=int(next(x.split()[1] for x in P.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 free=shutil.disk_usage(ROOT).free; growth=12*1024**2+12*1024**2+8*1024**2
 o={'stage':stage,'at':time.time(),'files':rows,'ownedIncludingPositiveSharedWalOnce':used,'futureSessionLauncherWalOnce':12*1024**2,'checkoutGitEvidenceRemoteStagingAllowance':12*1024**2,'reserve':8*1024**2,'projectedPeak':used+growth,'allocation':64*1024**2,'memAvailable':mem,'client':512*1024**2,'testHeap':16*1024**2,'gitDataWithinClient':256*1024**2,'afterClientHeap':mem-553648128,'freeDisk':free,'freeAfterGrowth':free-growth}
 o['pass']=o['projectedPeak']<=64*1024**2 and o['afterClientHeap']>=805306368 and o['freeAfterGrowth']>=2982150144
 write('resources-'+stage+'.json',o); assert o['pass'],{k:v for k,v in o.items() if k!='files'}
 print(stage,'PASS owned',used,'peak',o['projectedPeak'])
def setup():
 measure('admission')
 pins=json.loads((HOST/'scratch/usage-watch/renderer-aggregate-press-dispatch-oct26.json').read_text()); checked={}
 assert git('rev-parse','HEAD',repo=DONOR).decode().strip()==REV
 for path,expected in pins['inputs'].items():
  b=(DONOR/path).read_bytes(); actual=sha(b); assert actual==expected
  assert sha(git('show',REV+':'+path,repo=DONOR))==expected
  checked[path]=actual
 rp=P.Path(pins['reproducer']['path']); assert sha(rp.read_bytes())==pins['reproducer']['sha256']
 write('pins.json',{'donor':str(DONOR),'revision':REV,'inputs':checked,'reproducer':pins['reproducer']})
 (OPS/'aggregate-latch-repro.cjs').write_bytes(rp.read_bytes())
 prior=json.loads((DONOR.parent/'ops/configuration.json').read_text()); assert prior['ssh']==SSH
 write('configuration.json',{'ssh':SSH,'unchangedTrustedConfigurationReceipt':str(DONOR.parent/'ops/configuration.json'),'mountArgv':None,'intendedFiles':[],'mountValidation':'No mount/runtime execution. Canonical parser conditional checkpoint inapplicable; no fabricated argv.','limits':{'file':25165824,'capture':2097152,'output':131072,'excerpt':8192,'instruction':65536},'commands':['git with RLIMIT_DATA=256MiB inside client512MiB','one node --max-old-space-size=16 --test fixture at a time'],'rootRefInitial':json.loads((HOST/'scratch/usage-watch/renderer-aggregate-press-consumption-delayed-repair-oct26/root-ref-digest.json').read_text())})
 tools={}
 for n in ['node','git','python3']:
  p=P.Path(shutil.which(n)).resolve(); tools[n]={'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes()),'standingExecutedInPlace':True}
 write('standing-tools.json',tools)
 objects=set()
 def flat(p):
  p=p.resolve()
  if p in objects:return
  objects.add(p); alt=p/'info/alternates'
  if alt.exists():
   for s in alt.read_text().splitlines(): flat(P.Path(s) if s.startswith('/') else p/s)
 flat(DONOR/'.git/objects')
 write('readonly-objects.json',{'flatAlternates':list(map(str,sorted(objects))),'standingBytes':sum(p.stat().st_size for d in objects for p in d.rglob('*') if p.is_file())})
 run(['git','init','-q',str(REPO)])
 (REPO/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(objects)))
 git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git'); git('config','user.name','Wine Assembly Agent');git('config','user.email','agent@wine-assembly.local')
 git('config','core.sparseCheckout','true')
 paths=list(pins['inputs'])+['lib/mem-utils.js','lib/region-map.generated.js','test/renderer-modifier-independent-accept.test.cjs','test/renderer-aggregate-press-consumption.test.cjs','docs/reviews/renderer-aggregate-press-consumption-delayed-repair-oct26/']
 (REPO/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in paths))
 git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('update-ref','refs/heads/'+BRANCH,REV);git('read-tree','-m','-u',REV)
 measure('checkout')
if __name__=='__main__':setup()

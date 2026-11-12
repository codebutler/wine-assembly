import os, pathlib as P, subprocess as S, json, hashlib as H, shutil, resource, time
BASE=P.Path('/tmp/renderer-aggregate-press-independent-publication-oct26'); OPS=BASE/'ops'; REPO=BASE/'repo'
HOST=P.Path('/home/user/wine-assembly'); DONOR=P.Path('/tmp/renderer-aggregate-press-consumption-delayed-repair-oct26/repo')
NAME='renderer-aggregate-press-independent-publication-oct26'; BRANCH='task/'+NAME; REV='ac353e22af299eb6960f78edc1db0d5e8e81b4a4'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1')
resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def sha(b):return H.sha256(b).hexdigest()
def write(n,o):
 p=OPS/n; t=p.with_suffix(p.suffix+'.tmp'); t.write_text(json.dumps(o,indent=2)+'\n');t.replace(p)
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912));resource.setrlimit(resource.RLIMIT_CPU,(60,60))
def run(args,cwd=None,expected=0):
 p=S.run(args,cwd=cwd,env=ENV,stdout=S.PIPE,stderr=S.PIPE,timeout=65,preexec_fn=limits)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072
 assert p.returncode==expected,(args,p.returncode,p.stderr[:2000])
 return p.stdout
def git(*a,repo=REPO):return run(['git','-C',str(repo),*a])
def measure(stage,gitphase=False):
 launcher=HOST/'scratch/usage-watch'/NAME
 files=set(p for d in [BASE,launcher] for p in d.rglob('*') if p.is_file() and not p.is_symlink())
 files.update(P.Path('/home/user/.codex/sessions/2026/10/26').glob('*01a1774e-ea0b-7473-8f6b-f24196b1eed8*'))
 files.update(p for p in P.Path('/home/user/.codex').glob('*-wal') if p.stat().st_size>0)
 rows=[{'path':str(p),'bytes':p.stat().st_size,'allocated':p.stat().st_blocks*512} for p in sorted(files)]
 used=sum(max(r['bytes'],r['allocated']) for r in rows); mem=int(next(x.split()[1] for x in P.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 growth=16*1024**2+8*1024**2+8*1024**2
 o={'stage':stage,'at':time.time(),'files':rows,'ownedIncludingPositiveSharedWalOnce':used,'futureSessionLauncherWalOnce':16777216,'checkoutGitEvidenceAllowance':8388608,'reserve':8388608,'projectedPeak':used+growth,'allocation':67108864,'memAvailable':mem,'client':536870912,'serialGit':536870912,'helperOrHeap':16777216,'combinedGitRequirement':1090519040,'afterCombined':mem-(1090519040 if gitphase else 553648128),'floor':805306368,'freeDisk':shutil.disk_usage(BASE).free,'conservativeDiskGrowth':58720256,'diskFloor':2982150144}
 o['pass']=o['projectedPeak']<=67108864 and o['afterCombined']>=805306368 and o['freeDisk']-58720256>=2982150144
 write('resources-'+stage+'.json',o); assert o['pass'],{k:v for k,v in o.items() if k!='files'}
 print(stage,'PASS',used,o['projectedPeak'])
def setup():
 measure('admission',True)
 argv=P.Path('/proc/2330319/cmdline').read_bytes().split(b'\0'); argv=[b.decode() for b in argv if b]
 assert 'gpt-6.1-sol' in argv and 'model_auto_compact_token_limit=200000' in argv and 'model_auto_compact_token_limit_scope="total"' in argv and 'model_reasoning_effort="medium"' in argv
 write('launch.json',{'pid':2330319,'session':'01a1774e-ea0b-7473-8f6b-f24196b1eed8','argv':argv,'actual':True})
 prior=P.Path('/tmp/maelstrom-uop-native-closeout-independent-accept-oct26/ops/configuration.json'); conf=json.loads(prior.read_text()); assert conf['trustedSSH']==SSH and conf['actualMountArgv']==[] and conf['intendedFiles']==[]
 # No guest invocation, mounts or intended guest files in this offline task.
 write('configuration.json',{'ssh':SSH,'mountArgv':[],'intendedFiles':[],'parsed':conf['parsed'],'canonicalParserSHA256':conf['parserSHA256'],'unchangedExactReceipt':str(prior),'receiptSHA256':sha(prior.read_bytes()),'sameTaskVerified':True,'runtime':False,'rootRefInitial':json.loads((HOST/'scratch/usage-watch'/NAME/'root-ref-digest.json').read_text()),'limits':{'gitData':536870912,'onePackThread':True,'windowMemory':16777216,'file':25165824,'capture':2097152,'output':131072,'excerpt':8192,'instructions':65536,'childCPU':60,'wall':65}})
 tools={}
 for n in ['node','git','python3']:
  p=P.Path(shutil.which(n)).resolve();tools[n]={'path':str(p),'bytes':p.stat().st_size,'sha256':sha(p.read_bytes()),'standingExecutedInPlace':True}
 write('standing-tools.json',tools)
 result=json.loads((DONOR.parent/'ops/result.json').read_text()); assert result['commit']==REV
 pins={}
 for path,expected in result['sourceAndFixtureHashes'].items():
  assert sha((DONOR/path).read_bytes())==expected and sha(git('show',REV+':'+path,repo=DONOR))==expected;pins[path]=expected
 review=DONOR/'docs/reviews/renderer-aggregate-press-consumption-delayed-repair-oct26'
 manifest=json.loads((review/'evidence-manifest.json').read_text())
 for row in manifest:
  p=review/row['path'];assert len(p.read_bytes())==row['bytes'] and sha(p.read_bytes())==row['sha256'];assert sha(git('show',REV+':'+str(p.relative_to(DONOR)),repo=DONOR))==row['sha256']
 deps={}
 for path in ['lib/mem-utils.js','lib/region-map.generated.js']:
  deps[path]={'sha256':sha((DONOR/path).read_bytes()),'modeBlob':git('ls-tree',REV,'--',path,repo=DONOR).decode().strip()}
 write('reuse.json',{'candidate':REV,'sourceCommit':result['sourceCommit'],'pins':pins,'dependencies':deps,'manifest':str(review/'evidence-manifest.json'),'manifestSHA256':sha((review/'evidence-manifest.json').read_bytes()),'verifiedCommittedPayloads':len(manifest),'reportedResults':result['tests'],'reuseReason':'Exact source, fixture and two transitive require dependencies verified; original failures and prior provider-capacity evidence retained in unchanged candidate ancestry.'})
 objects=set()
 def flat(p):
  p=p.resolve()
  if p in objects:return
  objects.add(p);alt=p/'info/alternates'
  if alt.exists():
   for s in alt.read_text().splitlines():flat(P.Path(s) if s.startswith('/') else p/s)
 flat(DONOR/'.git/objects');flat(HOST/'.git/objects')
 write('readonly-objects.json',{'flatAlternates':list(map(str,sorted(objects))),'standingBytes':sum(p.stat().st_size for d in objects for p in d.rglob('*') if p.is_file())})
 run(['git','init','-q',str(REPO)]);(REPO/'.git/objects/info/alternates').write_text(''.join(str(p)+'\n' for p in sorted(objects)))
 git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
 for k,v in {'user.name':'Wine Assembly Agent','user.email':'agent@wine-assembly.local','core.sparseCheckout':'true','pack.threads':'1','pack.window':'0','pack.windowMemory':'16m','pack.deltaCacheSize':'1m','gc.auto':'0','fetch.writeCommitGraph':'false'}.items():git('config',k,v)
 paths=list(pins)+list(deps)+['docs/reviews/renderer-aggregate-press-consumption-delayed-repair-oct26/','docs/reviews/'+NAME+'/']
 (REPO/'.git/info/sparse-checkout').write_text(''.join('/'+p+'\n' for p in paths))
 git('symbolic-ref','HEAD','refs/heads/'+BRANCH);git('update-ref','refs/heads/'+BRANCH,REV);git('read-tree','-m','-u',REV)
 rp=review/'evidence/aggregate-latch-repro.cjs';assert sha(rp.read_bytes())=='cd2d564e4947a0990ca5234c798b2cd8c1535c8796583aec25ae01216357e9d6';(OPS/'aggregate-latch-repro.cjs').write_bytes(rp.read_bytes())
 measure('checkout',True)
def test(label,path,expected=0,extra=None):
 args=['node','--max-old-space-size=16','--test',str(path)];env=dict(ENV,**(extra or {}))
 p=S.run(args,cwd=REPO,env=env,stdout=S.PIPE,stderr=S.PIPE,timeout=65,preexec_fn=limits)
 assert len(p.stdout)+len(p.stderr)<=2097152
 log=p.stdout+p.stderr;(OPS/(label+'.log')).write_bytes(log)
 o={'label':label,'command':args,'environment':extra,'exitCode':p.returncode,'expectedExit':expected,'fixtureSHA256':sha(P.Path(path).read_bytes()),'rendererSHA256':sha((REPO/'lib/renderer-input.js').read_bytes()),'log':label+'.log','logSHA256':sha(log),'summary':log.decode().splitlines()[-8:]};write(label+'.json',o)
 cp=OPS/'checkpoint.json';c=json.loads(cp.read_text()) if cp.exists() else {'candidate':REV,'sourceAndFixtures':json.loads((OPS/'reuse.json').read_text())['pins'],'groups':[],'remaining':['independent adversarial assertions/rejecting control','fresh main merge','affected merged validation','task/main publication'],'blockers':[]}
 c['groups'].append(o);write('checkpoint.json',c)
 print(label,p.returncode,' '.join(o['summary']));assert p.returncode==expected
 return o
if __name__=='__main__':setup()

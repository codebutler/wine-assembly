import os, pathlib as P, subprocess as S, json, hashlib as H, shutil, resource, time
BASE=P.Path('/tmp/renderer-aggregate-press-independent-publication-oct26'); REPO=BASE/'repo'; OLD=BASE/'ops'; OPS=OLD/'retained-oct26'
HOST=P.Path('/home/user/wine-assembly'); NAME='renderer-aggregate-retained-accept-publication-oct26'; BRANCH='task/'+NAME
REV='ac353e22af299eb6960f78edc1db0d5e8e81b4a4'; PREV='1edf0ba0ac9334d44c4285e966a2bc665933e664'
SESSION='01a17755-f1de-73d1-b9ce-dfb21380f8ba'; PID=2338608
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
ENV=dict(os.environ,GIT_SSH_COMMAND=SSH,GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1')
OPS.mkdir(exist_ok=True)
resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def sha(b):return H.sha256(b).hexdigest()
def write(n,o):
 p=OPS/n;t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(o,indent=2)+'\n');t.replace(p)
def common_limits():
 resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824));resource.setrlimit(resource.RLIMIT_CORE,(0,0))
def git_limits():
 common_limits();resource.setrlimit(resource.RLIMIT_DATA,(536870912,536870912))
def run(args,cwd=None,expected=0,env=None):
 p=S.run(args,cwd=cwd,env=env or ENV,stdout=S.PIPE,stderr=S.PIPE,timeout=65,preexec_fn=git_limits if args[0]=='git' else common_limits)
 assert len(p.stdout)<=2097152 and len(p.stderr)<=131072
 assert p.returncode==expected,(args,p.returncode,p.stderr[:2000])
 return p.stdout
def git(*a,repo=REPO):return run(['git','-C',str(repo),*a])
def measure(stage,gitphase=False):
 dirs=[BASE,HOST/'scratch/usage-watch'/NAME,HOST/'scratch/usage-watch/renderer-aggregate-press-independent-publication-oct26']
 files=set(p for d in dirs for p in d.rglob('*') if p.is_file() and not p.is_symlink())
 for sid in [SESSION,'01a1774e-ea0b-7473-8f6b-f24196b1eed8']:
  files.update(P.Path('/home/user/.codex/sessions/2026/10/26').glob('*'+sid+'*'))
 files.update(p for p in P.Path('/home/user/.codex').glob('*-wal') if p.stat().st_size>0)
 rows=[{'path':str(p),'bytes':p.stat().st_size,'allocated':p.stat().st_blocks*512} for p in sorted(files)]
 used=sum(max(r['bytes'],r['allocated']) for r in rows)
 mem=int(next(x.split()[1] for x in P.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 # One combined future allowance, never double-counted by launcher/session/WAL.
 future=12582912;staging=8388608;reserve=8388608
 req=1090519040 if gitphase else 553648128
 o={'stage':stage,'at':time.time(),'files':rows,'ownedAllRetainedAndBothLaunchersSessionsPositiveWalOnce':used,'futureSessionLauncherWalOnce':future,'checkoutGitEvidenceAllowance':staging,'reserve':reserve,'projectedPeak':used+future+staging+reserve,'allocation':67108864,'memAvailable':mem,'client':536870912,'serialGit':536870912 if gitphase else 0,'helperOrNodeHeap':16777216,'combinedRequirement':req,'afterCombined':mem-req,'floor':805306368,'freeDisk':shutil.disk_usage(BASE).free,'diskGrowth':58720256,'diskFloor':2982150144}
 o['pass']=o['projectedPeak']<=67108864 and mem-req>=805306368 and o['freeDisk']-58720256>=2982150144
 write('resources-'+stage+'.json',o);print(stage,{k:o[k] for k in ['pass','projectedPeak','memAvailable','freeDisk']});assert o['pass']
def checkpoint(group=None,remaining=None):
 p=OPS/'checkpoint.json';o=json.loads(p.read_text()) if p.exists() else {'candidate':REV,'predecessor':PREV,'sourceAndFixtures':json.loads((OLD/'reuse.json').read_text())['pins'],'groups':[],'blockers':[]}
 if group:o['groups'].append(group)
 if remaining is not None:o['remaining']=remaining
 write('checkpoint.json',o)
def test(label,path,expected=0,extra=None,count=None):
 measure('before-'+label)
 args=['node','--max-old-space-size=16','--test',str(path)];env=dict(ENV,**(extra or {}))
 p=S.run(args,cwd=REPO,env=env,stdout=S.PIPE,stderr=S.PIPE,timeout=65,preexec_fn=common_limits)
 assert len(p.stdout)+len(p.stderr)<=2097152
 log=p.stdout+p.stderr;(OPS/(label+'.log')).write_bytes(log)
 o={'label':label,'command':args,'environment':extra,'exitCode':p.returncode,'expectedExit':expected,'fixtureSHA256':sha(P.Path(path).read_bytes()),'rendererSHA256':sha((REPO/'lib/renderer-input.js').read_bytes()),'tree':git('rev-parse','HEAD^{tree}').decode().strip(),'log':label+'.log','logSHA256':sha(log),'summary':log.decode().splitlines()[-9:],'nodeLimits':{'heapMiB':16,'CPU':60,'wall':65,'fileBytes':25165824,'DATA':'unlimited inherited','AS':'unlimited inherited'}}
 write(label+'.json',o);checkpoint(o, ['remaining acceptance/control','fresh main reconciliation','affected merged validation','task/main publication'])
 print(label,p.returncode,o['summary']);assert p.returncode==expected
 if count is not None:assert any(s in log.decode().splitlines() for s in ['# tests '+str(count),'ℹ tests '+str(count)])
 return o
def admission():
 measure('fresh-admission',True)
 argv=[s.decode() for s in P.Path('/proc/'+str(PID)+'/cmdline').read_bytes().split(b'\0') if s]
 for s in ['gpt-6.1-sol','model_auto_compact_token_limit=200000','model_auto_compact_token_limit_scope="total"','model_reasoning_effort="medium"']:assert s in argv
 assert resource.getrlimit(resource.RLIMIT_DATA)==(-1,-1) and resource.getrlimit(resource.RLIMIT_AS)==(-1,-1)
 write('launch.json',{'pid':PID,'session':SESSION,'actualArgv':argv,'actual':True,'nodeDataAS':[-1,-1],'gitData':536870912})
 conf=json.loads((OLD/'configuration.json').read_text());assert conf['ssh']==SSH and conf['mountArgv']==[] and conf['intendedFiles']==[]
 write('configuration.json',{'reusedExactReceipt':str(OLD/'configuration.json'),'receiptSHA256':sha((OLD/'configuration.json').read_bytes()),'trustedSSH':SSH,'actualMountArgv':[],'intendedFiles':[],'parsed':conf['parsed'],'canonicalParserSHA256':conf['canonicalParserSHA256'],'runtime':False,'initialRootRef':json.loads((HOST/'scratch/usage-watch'/NAME/'root-ref-digest.json').read_text()),'wrapperCorrectionAuthorization':str(HOST/'scratch/usage-watch/renderer-wrapper-root-closeout-oct26.json')})
 assert git('rev-parse','HEAD').decode().strip()==PREV
 assert not git('status','--porcelain')
 reuse=json.loads((OLD/'reuse.json').read_text())
 for path,expected in reuse['pins'].items():assert sha((REPO/path).read_bytes())==expected and sha(git('show',REV+':'+path))==expected
 for path,row in reuse['dependencies'].items():assert sha((REPO/path).read_bytes())==row['sha256']
 assert sha((OLD/'aggregate-latch-repro.cjs').read_bytes())=='cd2d564e4947a0990ca5234c798b2cd8c1535c8796583aec25ae01216357e9d6'
 review=REPO/'docs/reviews/renderer-aggregate-press-independent-publication-oct26'
 manifest=json.loads((review/'evidence-manifest.json').read_text())
 for row in manifest:assert sha((review/row['path']).read_bytes())==row['sha256']
 write('pinned-reuse.json',{'reuse':reuse,'predecessorCommittedPayloads':len(manifest),'independentFixtureSHA256':sha((OLD/'independent-adversarial.cjs').read_bytes()),'fixturesReviewed':True,'review':'26 cases: 18 modifier ordering/reentrancy/legacy +6 ordinary worker/main parity +2 raw legacy. All use actual installed input handlers; raw queue controls require low-bit publication.'})
 git('checkout','-q','-b',BRANCH)
 sparse=REPO/'.git/info/sparse-checkout';sparse.write_text(sparse.read_text()+'/docs/reviews/'+NAME+'/\n')
 checkpoint(remaining=['unchanged 3-case reproducer','26 independent adversarial','meaningful rejecting control','fresh main merge','affected merged validation','task/main publication'])
if __name__=='__main__':admission()

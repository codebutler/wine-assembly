import pathlib,json,subprocess,os,fcntl,hashlib,shutil,time
from account import account
from guard import run
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';NAME=H.name;BRANCH='task/'+NAME
BASE='81eb33d4e8a4cba52107ef40ecd7cb3bd041557c';CANDIDATE='669d61a2ce2731700fc7a65a5828611572df55f7'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=SSH)
def git(*a):return subprocess.check_output(['git',*a],cwd=R,env=env,text=True,timeout=60).strip()
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def remote():
 p=subprocess.run(['git','ls-remote','origin','refs/heads/main','refs/heads/'+BRANCH],cwd=R,env=env,capture_output=True,text=True,timeout=30)
 check=dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr);save('remote-latest.json',check);assert p.returncode==0
 return {line.split()[1]:line.split()[0] for line in p.stdout.splitlines()}
account('preintegration')
with open('/home/user/wine-assembly/scratch/usage-watch/shared-integration.lock','a+') as lock:
 fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 save('integration-lock.json',dict(acquired=True,pid=os.getpid(),at=time.time(),exclusive=True))
 refs=remote();assert refs['refs/heads/main']==BASE,refs
 assert git('rev-parse','HEAD')==CANDIDATE
 git('merge-base','--is-ancestor',BASE,CANDIDATE)
 evidence=R/'docs/re-notes/maelstrom-frozen-capture-independent-integrate-20261025';evidence.mkdir(exist_ok=False)
 names=['verify.py','source-binding.cjs','controls.py','guard.py','account.py','checkout.py','integrate.py','configuration.json','checkout.json','standing-inputs.json','standing-capture-inputs.json','readonly-state.json','resource-precheckout.json','resource-before-checkout.json','resource-after-tests.json','resource-preintegration.json','source-binding.json','source-binding.stdout','retained-pass.json','retained-pass.stdout','controls.json','integration-lock.json','remote-latest.json']
 names += [p.name for p in O.glob('reject-*.json')]+[p.name for p in O.glob('reject-*.stderr')]
 for n in names:shutil.copyfile(O/n,evidence/n)
 review=evidence.with_suffix('.md');paths=[str(review.relative_to(R))]+[str(p.relative_to(R)) for p in evidence.iterdir()]
 # Add only explicit owned review paths to the existing narrow sparse set.
 sparse=R/'.git/info/sparse-checkout'
 with sparse.open('a') as f:f.write('\n'+'\n'.join('/'+p for p in paths)+'\n')
 git('add','--',*paths);git('diff','--cached','--check')
 staged=git('diff','--cached','--name-only').splitlines();assert sorted(staged)==sorted(paths)
 stagedTree=git('write-tree');save('staged-review.json',dict(paths=staged,tree=stagedTree,candidateUnchanged=True,base=BASE,candidate=CANDIDATE))
 account('before-commit')
 git('commit','-m','Accept original Maelstrom historical select completion with independent provenance controls')
 commit=git('rev-parse','HEAD');assert git('rev-parse','HEAD^{tree}')==stagedTree
 assert git('rev-parse','HEAD^')==CANDIDATE
 j=run('integrated-tree-pass',['python3',str(O/'verify.py'),str(R)]);assert j['returncode']==0
 j=run('integrated-source-binding',['node','--max-old-space-size=256',str(O/'source-binding.cjs'),str(R)]);assert j['returncode']==0
 blobs=[]
 for p in staged:
  b=subprocess.check_output(['git','show',commit+':'+p],cwd=R);expected=(R/p).read_bytes();assert b==expected
  blobs.append(dict(path=p,sha256=hashlib.sha256(b).hexdigest(),bytes=len(b)))
 save('exact-integrated-tree.json',dict(commit=commit,tree=stagedTree,parent=CANDIDATE,base=BASE,candidate60BlobsVerified=True,reviewBlobs=blobs,worktreeClean=not git('status','--porcelain')))
 assert not git('status','--porcelain')
 account('prepublication');refs=remote();assert refs['refs/heads/main']==BASE,refs
 p=subprocess.run(['git','push','--atomic','origin','HEAD:refs/heads/'+BRANCH,'HEAD:refs/heads/main'],cwd=R,env=env,capture_output=True,text=True,timeout=60)
 save('push-command.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0
 refs=remote();assert refs['refs/heads/main']==commit and refs['refs/heads/'+BRANCH]==commit
 save('publication.json',dict(commit=commit,branch=BRANCH,remote=refs,tree=stagedTree,atomic=True,fastForwardOnly=True,committedEvidenceVerified=len(blobs)+60,unchangedCandidate=CANDIDATE))
 print(json.dumps(json.loads((O/'publication.json').read_text())))
save('integration-lock-release.json',dict(released=True,at=time.time()))

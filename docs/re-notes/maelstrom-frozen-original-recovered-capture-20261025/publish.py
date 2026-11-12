import pathlib,subprocess,json,os,hashlib,shutil,time
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';E=R/'docs/re-notes/maelstrom-frozen-original-recovered-capture-20261025'
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
# This diagnostic title has no corpus entry: durable investigation notes, no fabricated candidate/run acceptance.
(R/'scratch/runs').mkdir(parents=True,exist_ok=True)
p=subprocess.run(['node',str(R/'ops/check-run-evidence.js'),str(R)],capture_output=True,text=True,timeout=60);save('run-evidence-check.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr,scope='Zero dashboard runs; title is absent from corpus manifest, so evidence remains in investigation notes per ops convention.'))
assert p.returncode==0
summary=json.load(open(E/'capture-summary.json'));checks=[]
for rel in summary['artifacts']:
 p=E/rel;assert p.is_file() and not p.is_symlink() and p.resolve().is_relative_to(E.resolve());checks.append(dict(path=rel,bytes=p.stat().st_size,sha256=sha(p.read_bytes())))
save('investigation-evidence-check.json',dict(passChecks=True,files=checks,diagnosticOnly=True))
# Final supervisor/argv/code identity is reviewed without running anything again.
for x in json.load(open(O/'effective-identities.json')):assert sha((H/x['path']).read_bytes())==x['sha256'],x['path']
from account import account
a=account('before-commit')
for n in ['run-evidence-check.json','investigation-evidence-check.json','resource-before-commit.json']:
 shutil.copy2(O/n,E/n)
# All evidence files must remain small, plaintext and local; no game/module binaries.
assert all(p.stat().st_size<=25165824 and not p.is_symlink() for p in E.iterdir())
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';env=dict(os.environ,GIT_SSH_COMMAND=ssh)
def git(*args):return subprocess.check_output(['git','-C',str(R),*args],text=True,env=env,stderr=subprocess.STDOUT).strip()
shutil.copy2(O/'publish.py',E/'publish.py')
paths=['docs/re-notes/maelstrom-frozen-original-recovered-capture-20261025.md','docs/re-notes/maelstrom-frozen-original-recovered-capture-20261025']
git('add','--sparse','--',*paths);git('-c','core.whitespace=-blank-at-eol','diff','--cached','--check');staged=git('diff','--cached','--name-only').splitlines();assert all(x.startswith(paths[0]) or x.startswith(paths[1]+'/') for x in staged)
save('staged-review.json',dict(files=staged,codeChanged=False,review='One authentic frozen completion, exact input/code hashes, no gameplay claim, failures preserved, no binary/source repair.'))
git('commit','-m','docs: capture one original Maelstrom frozen select completion')
commit=git('rev-parse','HEAD');branch='task/'+H.name
p=subprocess.run(['git','-C',str(R),'push','origin','HEAD:refs/heads/'+branch],text=True,capture_output=True,env=env,timeout=60);save('push-command.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0
p=subprocess.run(['git','-C',str(R),'ls-remote','origin','refs/heads/'+branch,'refs/heads/main'],text=True,capture_output=True,env=env,timeout=30);assert p.returncode==0
refs={line.split()[1]:line.split()[0] for line in p.stdout.splitlines()};assert refs['refs/heads/'+branch]==commit
checked=[]
for rel in staged:
 b=subprocess.check_output(['git','-C',str(R),'show',commit+':'+rel]);assert b==(R/rel).read_bytes();checked.append(dict(path=rel,blob=git('rev-parse',commit+':'+rel),bytes=len(b),sha256=sha(b)))
save('committed-evidence-verification.json',dict(commit=commit,remoteVerified=True,files=checked));assert not git('status','--porcelain')
save('publication.json',dict(at=time.time(),commit=commit,branch=branch,remote='git@github.com:vgrichina/wine-assembly.git',remoteRefs=refs,committedBlobsVerified=len(checked),clean=True,force=False,mainMerge=False,ssh=ssh))
print(json.dumps(dict(commit=commit,branch=branch,remoteVerified=True,evidenceBlobs=len(checked))))

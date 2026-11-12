import hashlib,json,os,resource,subprocess,time
from pathlib import Path
H=Path(__file__).parent;R=H.parent/'repo'
BRANCH='task/enigma-staging-mode-preservation-repair-oct26'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=SSH,PYTHONDONTWRITEBYTECODE='1')
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(16777216,16777216))
 resource.setrlimit(resource.RLIMIT_CPU,(60,60))
 resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def run(*args):
 p=subprocess.run(['git','-C',str(R),'-c','core.preloadIndex=false','-c','index.threads=1','-c','pack.threads=1','-c','pack.windowMemory=4m',*args],env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=65,preexec_fn=limits)
 assert len(p.stdout)+len(p.stderr)<=131072
 if p.returncode:
  (H/'publication-failure.json').write_text(json.dumps(dict(args=args,returncode=p.returncode,stdout=p.stdout.decode(errors='replace'),stderr=p.stderr.decode(errors='replace')),indent=2))
  raise RuntimeError('Git failure; see publication-failure.json')
 return p.stdout.decode().strip()
assert run('symbolic-ref','--short','HEAD')==BRANCH
assert run('config','core.sshCommand')==SSH
checkpoint=json.loads((H/'checkpoint.json').read_text())
for path,digest in checkpoint['sources'].items():assert hashlib.sha256((R/path).read_bytes()).hexdigest()==digest
paths=['tools/enigma-bounded-staging.py','test/test-enigma-staging-modes.py','docs/re-notes/enigma-staging-footprint-repair-20261026/verify-and-stage.py','docs/reviews/enigma-staging-mode-preservation-repair-oct26']
run('add','--',*paths)
run('diff','--cached','--check')
changed=run('diff','--cached','--name-only').splitlines()
assert changed and all(p in paths[:3] or p.startswith(paths[3]+'/') for p in changed)
tree=run('write-tree')
msg='Preserve Enigma non-font source permissions independently of umask'
run('commit','-qm',msg)
commit=run('rev-parse','HEAD')
assert run('rev-parse','HEAD^')=='f1aac7b9ba83e2bbc763cb58d38646653d626468'
assert not run('status','--porcelain')
j=dict(commit=commit,branch=BRANCH,tree=tree,changed=changed,ssh=SSH,verified=False,time=time.time(),clean=True,mainChanged=False)
(H/'commit.json').write_text(json.dumps(j,indent=2)+'\n')
print(json.dumps(dict(checkpoint='COMMITTED',commit=commit,branch=BRANCH)),flush=True)
run('push','origin','HEAD:refs/heads/'+BRANCH)
remote=run('ls-remote','--exit-code','origin','refs/heads/'+BRANCH)
assert remote==commit+'\trefs/heads/'+BRANCH
j.update(remote=remote,verified=True,time=time.time())
(H/'publication.json').write_text(json.dumps(j,indent=2)+'\n')
print(json.dumps(dict(checkpoint='PUSH_VERIFIED',commit=commit,branch=BRANCH)),flush=True)

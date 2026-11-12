import json,os,resource,subprocess,time
from pathlib import Path
H=Path(__file__).parent;R=H.parent/'repo'
j=json.loads((H/'commit.json').read_text())
SSH=j['ssh'];BRANCH=j['branch']
def limits():
 resource.setrlimit(resource.RLIMIT_DATA,(268435456,268435456))
 resource.setrlimit(resource.RLIMIT_CPU,(60,60))
 resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def run(*args):
 p=subprocess.run(['git','-C',str(R),'-c','core.preloadIndex=false','-c','index.threads=1','-c','pack.threads=1','-c','pack.windowMemory=4m',*args],env=dict(os.environ,GIT_SSH_COMMAND=SSH),stdout=subprocess.PIPE,stderr=subprocess.PIPE,preexec_fn=limits,timeout=65)
 assert len(p.stdout)+len(p.stderr)<=131072
 if p.returncode:
  (H/'publication-push-data256MiB-failure.json').write_text(json.dumps(dict(args=args,returncode=p.returncode,stdout=p.stdout.decode(errors='replace'),stderr=p.stderr.decode(errors='replace')),indent=2))
  raise RuntimeError('Git failure; see data256MiB failure receipt')
 return p.stdout.decode().strip()
assert run('rev-parse','HEAD')==j['commit']
run('push','origin','HEAD:refs/heads/'+BRANCH)
remote=run('ls-remote','--exit-code','origin','refs/heads/'+BRANCH)
assert remote==j['commit']+'\trefs/heads/'+BRANCH
j.update(verified=True,remote=remote,gitDataLimit=268435456,time=time.time())
(H/'publication.json').write_text(json.dumps(j,indent=2)+'\n')
print(json.dumps(dict(commit=j['commit'],branch=BRANCH,verified=True)))

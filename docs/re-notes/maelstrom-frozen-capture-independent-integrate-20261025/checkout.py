import pathlib,subprocess,json,os,time,hashlib,shutil
from account import account,size
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo';D=pathlib.Path('/tmp/maelstrom-frozen-original-recovered-capture-oct25/repo')
REV='669d61a2ce2731700fc7a65a5828611572df55f7';BASE='81eb33d4e8a4cba52107ef40ecd7cb3bd041557c'
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=SSH)
def git(*a,cwd=D):return subprocess.check_output(['git',*a],cwd=cwd,text=True,env=env,timeout=60).strip()
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
assert git('rev-parse',REV)==REV
assert git('rev-parse',REV+'^')==BASE
seen=set();order=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
 order.append(str(p))
visit(D/'.git/objects')
standing=[dict(path=p,allocatedBytes=size(pathlib.Path(p)),role='readonly object store') for p in order]
for name in ['git','python3','node','ssh']:
 p=pathlib.Path(shutil.which(name)).resolve();standing.append(dict(path=str(p),allocatedBytes=size(p),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),role='installed executable used in place'))
save('standing-inputs.json',standing);account('before-checkout')
p=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main'],env=env,capture_output=True,text=True,timeout=30)
save('configuration.json',dict(ssh=SSH,returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0 and p.stdout.split()[0]==BASE
changed=git('diff-tree','--no-commit-id','--name-only','-r',REV).splitlines();assert len(changed)==60
selected=changed+['tools/maelstrom-select-frozen-runner.cjs','tools/maelstrom-select-frozen-record.cjs','tools/maelstrom-select-completion-hook.cjs']
R.mkdir();subprocess.run(['git','init','-q',str(R)],check=True)
(R/'.git/objects/info/alternates').write_text('\n'.join(order)+'\n')
git('config','core.sparseCheckout','true',cwd=R);git('config','core.sparseCheckoutCone','false',cwd=R)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
branch='task/'+H.name;git('update-ref','refs/heads/'+branch,REV,cwd=R);git('symbolic-ref','HEAD','refs/heads/'+branch,cwd=R);git('read-tree','-mu','HEAD',cwd=R)
for k in ['user.name','user.email']:git('config',k,git('config',k),cwd=R)
git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git',cwd=R)
save('checkout.json',dict(candidate=REV,base=BASE,selected=selected,dependencyFirstAlternates=order,fetch=False,clone=False,repack=False,objectCopy=False))
log=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f','/home/user/wine-assembly/messageboard.txt'],stdout=log,stderr=log,start_new_session=True);log.close();save('watcher.json',dict(pid=p.pid))
print(json.dumps(dict(checkout=True,paths=len(selected),branch=branch)))

import pathlib,subprocess,json,os,hashlib,time
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo'
D=pathlib.Path('/tmp/maelstrom-native-errno-successor-latch-oct25/repo');rev='4542e115ac2b1e0cca6748bd00cdce2b4f781199'
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=ssh)
def save(n,x):(O/n).write_text(json.dumps(x,indent=2)+'\n')
def run(*a,cwd=D):return subprocess.check_output(a,cwd=cwd,text=True,env=env,timeout=30).strip()
def ident(p):
 p=pathlib.Path(p);return dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
pin=json.loads((D/'docs/re-notes/maelstrom-native-errno-successor-latch-20261025/source-identity.json').read_text())
standing={}
for p,v in pin['sourceFiles'].items():
 f=pathlib.Path(pin['sourceRoot'])/p;standing[str(f)]=ident(f);assert standing[str(f)]==v
for p,h in pin['inputPins'].items():
 standing[p]=ident(p);assert standing[p]['sha256']==h
p='/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll';standing[p]=ident(p);assert standing[p]==pin['nativeCRT']
for p in ['/usr/local/bin/node','/usr/bin/python3','/usr/bin/git']:standing[p]=ident(p)
save('standing-inputs.json',standing)
launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-native-errno-independent-integrate-oct25')
session=pathlib.Path('/home/user/.codex/sessions/2026/10/25/rollout-2026-10-25T01-15-11-01a170a0-3943-75d2-b847-eb1a23f76359.jsonl')
logs=sum(p.stat().st_blocks*512 for p in launcher.rglob('*') if p.is_file())+session.stat().st_blocks*512
sqlite={str(p):p.stat().st_blocks*512 for p in pathlib.Path('/home/user/.codex').glob('state_5.sqlite*')}
parts=dict(checkout_git_staging=8<<20,evidence_temporary=4<<20,publication=4<<20,full_external_logs=max(4<<20,logs),positive_sqlite_growth=4<<20,future_allowance=16<<20,reserve=8<<20)
peak=sum(parts.values());free=os.statvfs(H).f_bavail*os.statvfs(H).f_frsize
mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
ok=peak<=64<<20 and free-peak>=2982150144 and mem>=805306368
save('resource-precheckout.json',dict(parts=parts,projectedPeak=peak,allocation=64<<20,free=free,freeAfter=free-peak,memAvailable=mem,sqliteBaseline=sqlite,launcher=str(launcher),session=str(session),fullLogsMeasured=logs,standingInputs='standing-inputs.json',passChecks=ok));assert ok
argv=open('/proc/442739/cmdline','rb').read().replace(b'\0',b' ').decode()
assert 'model_auto_compact_token_limit=200000' in argv and 'scope="total"' in argv and '-m gpt-6.1-sol' in argv and 'medium' in argv and 'resume' not in argv
assert run('git','rev-parse',rev)==rev
save('readonly-state.json',{str(p):{k:run('git',*v,cwd=p) for k,v in {'HEAD':['rev-parse','HEAD'],'refs':['show-ref'],'index':['hash-object','.git/index']}.items()} for p in [D,pathlib.Path('/home/user/wine-assembly')]})
p=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main','refs/heads/task/maelstrom-native-errno-successor-latch-oct25'],capture_output=True,text=True,env=env,timeout=30)
save('configuration.json',dict(ssh=ssh,returncode=p.returncode,stdout=p.stdout,stderr=p.stderr,workerArgv=argv,mountArgv=[],intendedMountFiles=[],mountApplicable=False,reason='No mount or runtime operation in this offline task; canonical parser conditional mount requirement inapplicable.'))
assert p.returncode==0 and '1ccd6130970d3151a1be23e388f0aa2b820188b2\trefs/heads/main' in p.stdout and rev in p.stdout
seen=set();order=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
 order.append(str(p))
visit(D/'.git/objects');run('git','init','-q',str(R))
(R/'.git/objects/info/alternates').write_text('\n'.join(order)+'\n')
selected=['tools/maelstrom-native-errno-latch.cjs','tools/maelstrom-select-completion-hook.cjs','test/maelstrom-native-errno-latch.test.cjs','test/maelstrom-select-hook-model.cjs','docs/re-notes/maelstrom-native-errno-successor-latch-20261025.md','docs/re-notes/maelstrom-native-errno-successor-latch-20261025/','docs/re-notes/maelstrom-native-errno-independent-integrate-20261025.md','docs/re-notes/maelstrom-native-errno-independent-integrate-20261025/']
run('git','config','core.sparseCheckout','true',cwd=R);run('git','config','core.sparseCheckoutCone','false',cwd=R)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
branch='task/maelstrom-native-errno-independent-integrate-oct25'
run('git','update-ref','refs/heads/'+branch,rev,cwd=R);run('git','symbolic-ref','HEAD','refs/heads/'+branch,cwd=R);run('git','read-tree','-mu','HEAD',cwd=R)
for k in ['user.name','user.email']:run('git','config',k,run('git','config',k),cwd=R)
run('git','remote','add','origin','git@github.com:vgrichina/wine-assembly.git',cwd=R)
save('checkout.json',dict(revision=rev,tree=run('git','rev-parse','HEAD^{tree}',cwd=R),branch=branch,selected=selected,dependencyFirstAlternates=order,fetch=False,clone=False,repack=False,objectCopy=False))
log=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f','/home/user/wine-assembly/messageboard.txt'],stdout=log,stderr=log,start_new_session=True);log.close();save('watcher.json',dict(pid=p.pid,pgid=p.pid))
print(json.dumps(dict(passChecks=True,projectedPeak=peak,pins=len(standing),revision=rev,tree=run('git','rev-parse','HEAD^{tree}',cwd=R))))

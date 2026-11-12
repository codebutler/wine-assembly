import pathlib,subprocess,json,os,hashlib,time,shutil
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';R=H/'repo'
D=pathlib.Path('/tmp/maelstrom-frozen-capture-independent-integrate-oct25/repo');rev='1ccd6130970d3151a1be23e388f0aa2b820188b2'
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
env=dict(os.environ,GIT_SSH_COMMAND=ssh)
def run(*a,cwd=D):return subprocess.check_output(a,cwd=cwd,text=True,env=env,stderr=subprocess.PIPE,timeout=30).strip()
def write(n,x):(O/n).write_text(json.dumps(x,indent=2)+'\n')
gate=json.load(open('/home/user/wine-assembly/scratch/usage-watch/maelstrom-native-errno-successor-latch-oct25-dispatch-gate.json'))
standing={}
for p,h in gate['pins'].items():
 b=pathlib.Path(p).read_bytes();assert hashlib.sha256(b).hexdigest()==h
 standing[p]={'bytes':len(b),'sha256':h}
for p in ['/usr/local/bin/node','/usr/bin/python3','/usr/bin/git','/home/user/wine-assembly/test/binaries/dlls/msvcrt.dll']:
 b=pathlib.Path(p).read_bytes();standing[p]={'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()}
state={str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('state_5.sqlite*')}
mem=int(next(x.split()[1] for x in pathlib.Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
free=shutil.disk_usage(H).free
parts={'checkout_git_staging':8<<20,'temporary_evidence':4<<20,'publication_copies':4<<20,'full_external_session_launcher_logs':12<<20,'positive_sqlite_growth':8<<20,'future_growth':12<<20,'reserve':8<<20}
peak=sum(parts.values());assert peak<=64<<20 and free-peak>=2982150144 and mem>=805306368
write('resource-precheckout.json',dict(passChecks=True,parts=parts,projectedPeak=peak,free=free,freeAfter=free-peak,memAvailable=mem,sqliteBaseline=state,standingReadonly=standing,limits=dict(nodeHeapMiB=256,cpuSeconds=60,wallSeconds=60,outputBytes=131072,perFileBytes=24<<20,narrowCaptureBytes=2<<20,instructionReadBytes=65536,codeExcerptBytes=8192,reapSeconds=5),mount=dict(argv=[],intendedFiles=[],applicable=False,reason='Offline implementation only; no mount or conditional runtime execution.')))
assert run('git','cat-file','-t',rev)=='commit'
tree=run('git','rev-parse',rev+'^{tree}')
p=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main'],capture_output=True,text=True,env=env,timeout=30)
write('configuration.json',dict(ssh=ssh,returncode=p.returncode,stdout=p.stdout,stderr=p.stderr,donorRevision=rev,tree=tree,mountArgv=[]));assert p.returncode==0
seen=set();order=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));a=p/'info/alternates'
 if a.exists():
  for line in a.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
 order.append(str(p))
visit(D/'.git/objects');R.mkdir();run('git','init','-q',str(R))
(R/'.git/objects/info/alternates').write_text('\n'.join(order)+'\n')
selected=['tools/maelstrom-select-completion-hook.cjs','test/maelstrom-select-hook-model.cjs']
run('git','config','core.sparseCheckout','true',cwd=R);run('git','config','core.sparseCheckoutCone','false',cwd=R)
(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n')
branch='task/maelstrom-native-errno-successor-latch-oct25'
run('git','update-ref','refs/heads/'+branch,rev,cwd=R);run('git','symbolic-ref','HEAD','refs/heads/'+branch,cwd=R);run('git','read-tree','-mu','HEAD',cwd=R)
for k in ['user.name','user.email']:run('git','config',k,run('git','config',k),cwd=R)
run('git','remote','add','origin','git@github.com:vgrichina/wine-assembly.git',cwd=R)
write('checkout.json',dict(revision=rev,branch=branch,selected=selected,dependencyFirstAlternates=order,fetch=False,clone=False,repack=False,objectCopy=False,sourceTree=tree))
log=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f','/home/user/wine-assembly/messageboard.txt'],stdout=log,stderr=log,start_new_session=True);log.close()
write('watcher.json',dict(pid=p.pid,pgid=p.pid,startedAt=time.time()))
print(json.dumps(dict(checkout=True,peak=peak,freeAfter=free-peak,memAvailable=mem)))

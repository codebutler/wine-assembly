import pathlib,os,json,subprocess,hashlib,resource,shutil,re,time,sys
H=pathlib.Path('/tmp/maelstrom-event-qualified-original-capture-oct24'); O=H/'ops'; D=pathlib.Path('/tmp/maelstrom-event-native-bounded-closeout-oct24/repo'); R=H/'repo'; C=pathlib.Path('/home/user/.codex')
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,j): (O/n).write_text(json.dumps(j,indent=2)+'\n')
def size(p):return sum(max(x.stat().st_size,x.stat().st_blocks*512) for x in p.rglob('*') if x.is_file()) if p.exists() else 0
session=next((C/'sessions/2026/10/24').glob('*'+os.environ['CODEX_SESSION_ID']+'*')); launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-event-qualified-original-capture-oct24')
sql={str(p):max(p.stat().st_size,p.stat().st_blocks*512) for p in C.glob('*.sqlite*') if p.is_file()};save('sqlite-baseline.json',sql)
mfile=pathlib.Path('/tmp/maelstrom-native-errno-capture-oct24/manifest.json'); assert sha(mfile.read_bytes())=='86111762b21d2c589925d13686bb2285bed23c89cce5243d1c27c407beb244fe';m=json.loads(mfile.read_bytes())
charges=dict(remoteClosure=sum(x['bytes'] for x in m),remoteExtra=1500000,localCheckoutGit=2500000,localHelpersEvidence=3000000,transferOverlap=1000000,sessionFull=session.stat().st_size,launcherFull=size(launcher),sqlitePositive=0,futureSQLite=4194304,externalFuture=12000000,publicationFuture=2500000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage('/tmp').free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
a=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,after=free-peak,memAvailable=mem,session=str(session),launcher=str(launcher),passLocal=peak<=67108864 and free-peak>=2982150144 and mem>=805306368,initialReadDeficiency='Initial instruction/code outputs exceeded requested bounded reads; baseline taken after initial reads; full external logs charged. Prior producer oversized fetch and historical deficiencies remain unchanged.',limits={str(x):resource.getrlimit(x) for x in [resource.RLIMIT_FSIZE,resource.RLIMIT_CPU]})
save('admission-local.json',a);assert a['passLocal'],a
# Trusted SSH fixed by task; no fetch or donor mutation.
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';env=dict(os.environ,GIT_SSH_COMMAND=ssh)
p=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main'],env=env,capture_output=True,text=True,timeout=30);save('remote-base.json',dict(ssh=ssh,returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0 and p.stdout.split()[0]=='8fe3b51b94f59a17e3af58e08e0cb87cdbb4165a'
# Reuse only reviewed transport primitives; no historical execution.
s=pathlib.Path('/tmp/maelstrom-select-return-capture-oct24/work.py').read_text().split('def account(stage):')[0].replace("H=pathlib.Path(__file__).parent","H=pathlib.Path(__file__).parent.parent").replace('bx_ktknkc9m','bx_qa9ex5bu');(O/'work.py').write_text(s)
sys.path.insert(0,str(O));from work import remote
j=remote("python3 -c 'import os,json,pathlib,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage(\"/tmp\").free,memAvailable=int(pathlib.Path(\"/proc/meminfo\").read_text().split(\"MemAvailable:\")[1].split()[0])*1024)))'");save('remote-admission.json',j);rr=json.loads(j['stdout']);assert rr['uid']==1000 and rr['free']-peak>=2982150144 and rr['memAvailable']>=2684354560
pins={'/tmp/maelstrom-head-yield-observer-oct24/ops/run.js':'4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809','/tmp/maelstrom-head-yield-observer-oct24/ops/13-exports.wat':'739397dc54a77e93b367334fd4ca96c921180f57a7558913a3301f1de4520b86','/tmp/maelstrom-event-triggered-boundary-observer-oct24/ops/thread-manager.js':'f0a2f006b0eb992bcdb904f10128167b06bfe143ac05661b82f9586d9755bf40',str(D/'tools/maelstrom-event-boundary-observer.cjs'):'52909f8dc9e39c9c294602c952d9bbbf4e91c52d5c56ddbba45fb3cb30d9e226','/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm':'8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686','/tmp/maelstrom-startup-divergence-cause-oct24/repo/tools/maelstrom-startup-divergence.py':'0ffbfdee6d64f66613731e8a4fbc00883320ee623cdd9bc45c66362b81067394','/tmp/maelstrom-single-return-sync-capture-oct24/setup.py':'1e2acd2f700df12c10527c9e95ed6dfeb32cffd902d15d0fc4ef68894e69cfdf','/tmp/maelstrom-single-return-sync-capture-oct24/supervise.py':'37c33ade9b889f4116009efa18228eb10524c70053dabca1d305b557b4d312ef'}
save('pins.json',[dict(path=p,expected=h,actual=sha(pathlib.Path(p).read_bytes()),bytes=pathlib.Path(p).stat().st_size) for p,h in pins.items()]);assert all(sha(pathlib.Path(p).read_bytes())==h for p,h in pins.items())
args=json.load(open('/tmp/maelstrom-qualified-head-original-capture-oct24/guest-args.json'));args=[x.replace('/tmp/maelstrom-qualified-head-original-capture-oct24',str(H)).replace('run-head-observed.js','run-event-observed.js') for x in args if not x.startswith(('--trace-at=','--trace-at-start-batch=','--trace-at-limit='))];(H/'guest-args.json').write_text(json.dumps(args,indent=2)+'\n')
p=subprocess.run(['python3','/tmp/maelstrom-startup-divergence-cause-oct24/repo/tools/maelstrom-startup-divergence.py','--check-argv',str(H/'guest-args.json')],capture_output=True,text=True,timeout=60);save('startup-pacing.json',dict(returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0
# Explicit sparse dependency-first flattened standing object stores. No donor fetch.
R.mkdir();subprocess.run(['git','init','-q',str(R)],check=True)
seen=set();ordered=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));ap=p/'info/alternates'
 if ap.exists():
  for line in ap.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
 ordered.append(str(p))
visit(D/'.git/objects');(R/'.git/objects/info/alternates').write_text('\n'.join(ordered)+'\n');save('alternates.json',dict(stores=ordered,standingReadOnly=True,noFetch=True))
subprocess.run(['git','-C',str(R),'config','core.sparseCheckout','true'],check=True);subprocess.run(['git','-C',str(R),'config','core.sparseCheckoutCone','false'],check=True)
(R/'.git/info/sparse-checkout').write_text('/CLAUDE.md\n/AGENTS.md\n/.gitignore\n/tools/maelstrom-event-boundary-observer.cjs\n/tools/maelstrom-head-yield-observer.cjs\n/docs/re-notes/maelstrom-event-native-independent-20261024.md\n')
subprocess.run(['git','-C',str(R),'checkout','-q','-b','task/maelstrom-event-qualified-original-capture-oct24','8fe3b51b94f59a17e3af58e08e0cb87cdbb4165a'],check=True)
subprocess.run(['git','-C',str(R),'remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],check=True)
for k in ['user.name','user.email']:
 v=subprocess.check_output(['git','-C',str(D),'config',k],text=True).strip();subprocess.run(['git','-C',str(R),'config',k,v],check=True)
(H/'manifest.json').write_bytes(mfile.read_bytes());save('setup.json',dict(passSetup=True,guestStarts=0,localCheckoutBytes=size(R),standingInputsBytes=sum(x['bytes'] for x in m),standingNode=dict(path=str(pathlib.Path(shutil.which('node')).resolve()),bytes=pathlib.Path(shutil.which('node')).stat().st_size)))
print(json.dumps(dict(prepared=True,peak=peak,remoteMem=rr['memAvailable'])))

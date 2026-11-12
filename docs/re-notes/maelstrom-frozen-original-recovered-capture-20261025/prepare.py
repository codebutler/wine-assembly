import pathlib,os,json,subprocess,hashlib,shutil,re,time,importlib.util
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';C=pathlib.Path('/home/user/.codex');ROOT=pathlib.Path('/home/user/wine-assembly');D=pathlib.Path('/tmp/maelstrom-select-frozen-independent-integrate-oct24/repo');REV='81eb33d4e8a4cba52107ef40ecd7cb3bd041557c'
sha=lambda b:hashlib.sha256(b).hexdigest()
def save(n,j):(O/n).write_text(json.dumps(j,indent=2)+'\n')
def size(p):return sum(max(f.stat().st_size,f.stat().st_blocks*512) for f in p.rglob('*') if f.is_file()) if p.exists() else 0
ssh='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes';env=dict(os.environ,GIT_SSH_COMMAND=ssh)
transport=pathlib.Path('/tmp/maelstrom-head-corrected-deadline-capture-oct24/ops/transport.py').read_text().replace("BOX='bx_qp99542b'","BOX='bx_g84h8h98'")
(O/'transport.py').write_text(transport)
from transport import py
rr=py('import os,pathlib,json,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,standing=pathlib.Path("/tmp/maelstrom-qualified-head-original-capture-oct24/runner").exists())))');save('remote-admission-api.json',rr);rr=json.loads(rr['stdout'])
session=next((C/'sessions/2026/10/25').glob('*'+os.environ['CODEX_SESSION_ID']+'*'));launcher=ROOT/'scratch/usage-watch'/H.name
base={str(p):max(p.stat().st_size,p.stat().st_blocks*512) for p in C.glob('*.sqlite*') if p.is_file()};save('sqlite-baseline.json',base)
# Complete two-host worst-case materialization, transport overlap, publication, all external logs and growth.
charges=dict(localClosure=17500000,remoteClosure=17500000,checkoutGitHelpersEvidence=3500000,remoteHelpersEvidence=1000000,transferOverlap=1500000,fullSession=size(session.parent) if False else max(session.stat().st_size,session.stat().st_blocks*512),fullLauncher=size(launcher),sqlitePositive=0,sqliteFuture=2000000,externalFuture=4000000,publicationFuture=2000000,reserve=8388608)
peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
a=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,localFree=free,remote=rr,localMem=mem,session=str(session),launcher=str(launcher),perFileLimit=25165824,extraCaptureCap=2097152,codeReadLimit=8192,instructionLimit=65536,historicalDeficienciesUnchanged=True,passAdmission=peak<=67108864 and min(free,rr['free'])-peak>=2982150144 and mem>=805306368 and rr['memAvailable']>=2684354560 and rr['uid']==1000)
save('resource-precheckout.json',a);assert a['passAdmission'],a
p=subprocess.run(['git','ls-remote','git@github.com:vgrichina/wine-assembly.git','refs/heads/main'],env=env,capture_output=True,text=True,timeout=30);save('configuration.json',dict(ssh=ssh,returncode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0 and p.stdout.split()[0]==REV
args=json.load(open('/tmp/maelstrom-qualified-head-original-capture-oct24/guest-args.json'));args=[x.replace('/tmp/maelstrom-qualified-head-original-capture-oct24',str(H)) for x in args if not x.startswith(('--trace-','--count='))];args[2]=str(H/'runner/test/run.js');args.append('--maelstrom-select-frozen-record='+str(H/'guest/frozen.jsonl'));(H/'guest-args.json').write_text(json.dumps(args,indent=2)+'\n')
canonical=pathlib.Path('/tmp/maelstrom-startup-divergence-cause-oct24/repo/tools/maelstrom-startup-divergence.py');assert sha(canonical.read_bytes())=='0ffbfdee6d64f66613731e8a4fbc00883320ee623cdd9bc45c66362b81067394'
spec=importlib.util.spec_from_file_location('canonical',canonical);mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
src=pathlib.Path('/tmp/maelstrom-head-yield-observer-oct24/ops/run.js').read_text();assert sha(src.encode())=='4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809'
# Canonical helper expects four interpreter argv entries; add inert loader placeholder only for its slice.
sizes=mod.effective_sizes(src,[args[:2]+['inert-placeholder']+args[2:]]);assert sizes[0]['size']==1000
parser=src[src.index('const getArg ='):src.index('// Was `--name=...`')];code='const fs=require("fs"),assert=require("assert");const args=JSON.parse(fs.readFileSync(process.argv[1])).slice(3);'+parser+';assert.deepEqual(getArgs("vfs-tree"),[process.argv[2]+"/vfs"]);assert.deepEqual(getArgs("vfs-mount"),[]);console.log(JSON.stringify({tree:getArgs("vfs-tree"),input:getArg("input")}));'
p=subprocess.run(['node','--max-old-space-size=256','-e',code,str(H/'guest-args.json'),str(H)],capture_output=True,text=True,timeout=60);assert p.returncode==0
manifest=json.load(open('/tmp/maelstrom-native-errno-capture-oct24/manifest.json'));original=[x for x in manifest if x['target'].startswith('vfs/')];assert len(original)==48 and sum(x['bytes'] for x in original)==2794170
for x in original:assert sha(pathlib.Path(x['path']).read_bytes())==x['sha256']
save('mount-and-pacing.json',dict(passChecks=True,argv=args,effective=sizes,parser=json.loads(p.stdout),canonicalSHA256=sha(canonical.read_bytes()),intendedFiles=original,commasPreserved=True))
# Explicit sparse checkout and dependency-first flattened read-only object stores.
R=H/'repo';R.mkdir();subprocess.run(['git','init','-q',str(R)],check=True);seen=set();order=[]
def visit(p):
 p=pathlib.Path(p).resolve()
 if str(p) in seen:return
 seen.add(str(p));ap=p/'info/alternates'
 if ap.exists():
  for line in ap.read_text().splitlines():visit(p/line if not line.startswith('/') else line)
 order.append(str(p))
visit(D/'.git/objects');(R/'.git/objects/info/alternates').write_text('\n'.join(order)+'\n')
selected=['tools/maelstrom-select-frozen-runner.cjs','tools/maelstrom-select-frozen-record.cjs','tools/maelstrom-select-completion-hook.cjs','ops/check-run-evidence.js']
def git(*args):return subprocess.check_output(['git','-C',str(R),*args],env=env,text=True).strip()
git('config','core.sparseCheckout','true');git('config','core.sparseCheckoutCone','false');(R/'.git/info/sparse-checkout').write_text('\n'.join('/'+p for p in selected)+'\n');git('update-ref','refs/heads/task/'+H.name,REV);git('symbolic-ref','HEAD','refs/heads/task/'+H.name);git('read-tree','-mu','HEAD');git('remote','add','origin','git@github.com:vgrichina/wine-assembly.git')
for k in ['user.name','user.email']:git('config',k,subprocess.check_output(['git','-C',str(D),'config',k],text=True).strip())
assert git('rev-parse','HEAD^{tree}')=='f4ffb45794d8cd6accaa648bc6905057e5fcb09e'
for p,w in [('tools/maelstrom-select-frozen-record.cjs','9ada19e7e0570ae841e4f82cfb4cf9cd7fc4d7b7'),('tools/maelstrom-select-frozen-runner.cjs','d91571577ae28db2cd696ac068b65d958fe0b1e1')]:assert git('hash-object',str(R/p))==w
save('checkout.json',dict(revision=REV,tree=git('rev-parse','HEAD^{tree}'),selected=selected,dependencyFirstAlternates=order,fetch=False,clone=False,repack=False,objectCopy=False))
save('schedule.json',json.load(open(ROOT/'scratch/usage-watch/maelstrom-frozen-original-recovered-capture-oct25.task.runtime.json')))
log=open(O/'board-watch.log','ab');p=subprocess.Popen(['tail','-n','0','-f',str(ROOT/'messageboard.txt')],stdout=log,stderr=log,start_new_session=True);log.close();save('watcher.json',dict(pid=p.pid))
print(json.dumps(dict(admission=True,peak=peak,mount=True,checkout=True,remoteStanding=rr['standing'])))

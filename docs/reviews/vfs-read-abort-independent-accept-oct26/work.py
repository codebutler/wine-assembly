from pathlib import Path
import os,json,hashlib,subprocess,shutil,datetime,resource
H=Path('/tmp/vfs-read-abort-independent-accept-oct26'); O=H/'ops'; R=H/'repo'
D=Path('/tmp/vfs-indexeddb-read-abort-repair-oct26/repo'); B=Path('/tmp/vfs-bounded-restore-merged-branch-oct26/repo')
C='980edba27712974e34fd1037b83fcebb261e711f'; BASE='e9ef28613b8d6148ff50962850760f2c37e87184'; TASK=H.name
SSH='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes'
os.environ['GIT_SSH_COMMAND']=SSH
NODE=shutil.which('node'); SESSION=os.environ['CODEX_SESSION_ID']
def sha(b): return hashlib.sha256(b).hexdigest()
def save(n,v):
 p=O/n; t=p.with_suffix(p.suffix+'.tmp');t.write_text(json.dumps(v,indent=2)+'\n');t.replace(p)
def cmd(args,cwd=None):
 p=subprocess.run(args,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=45);assert len(p.stdout)+len(p.stderr)<=131072
 if p.returncode: raise RuntimeError((args,p.returncode,p.stderr[:2000].decode()))
 return p.stdout

def footprint(p):
 if not p.exists():return 0
 if p.is_file():return p.stat().st_size
 return sum(q.stat().st_size for q in p.rglob('*') if q.is_file())
def resources(label):
 mem=int(next(x.split()[1] for x in Path('/proc/meminfo').read_text().splitlines() if x.startswith('MemAvailable:')))*1024
 free=shutil.disk_usage('/tmp').free
 wal={str(p):p.stat().st_size for p in Path('/home/user/.codex').glob('*-wal')}
 sessions=list(Path('/home/user/.codex/sessions').rglob('*'+SESSION+'*.jsonl'))
 launch=Path('/home/user/wine-assembly/scratch/usage-watch')/TASK
 charges={'ownedCheckoutGitOpsBudget':max(4*1024**2,footprint(H)), 'launcherCaptureBudget':max(2*1024**2,footprint(launch)), 'sessionBytes':sum(p.stat().st_size for p in sessions), 'positiveWALOnceConservativeAllCurrent':sum(wal.values()),'futureGrowthOnce':12*1024**2,'reserve':8*1024**2}
 peak=sum(charges.values());v=dict(time=datetime.datetime.now(datetime.timezone.utc).isoformat(),MemAvailable=mem,freeDisk=free,charges=charges,projectedPeak=peak,allocation=64*1024**2,wal=wal,sessionPaths=[str(p) for p in sessions],memoryAllowance=536870912+16777216,memoryFloor=805306368,diskFloor=2982150144,passAll=peak<=64*1024**2 and mem-553648128>=805306368 and free-peak>=2982150144)
 save('resources-'+label+'.json',v); assert v['passAll'],v;return v
if __name__=='__main__':
 for f in ['/home/user/.ssh/wine_github_ed25519','/home/user/.ssh/wine_github_known_hosts']:assert Path(f).is_file()
 rr=resources('admission')
 files=['lib/vfs-persistence.js','test/test-vfs-indexeddb-read-abort.js','test/test-vfs-persistence.js','test/test-vfs-persistence-restore.js','lib/filesystem.js','lib/mem-utils.js','lib/region-map.generated.js','lib/browser-shell.js']
 pins={}
 for f in files:
  h=hashlib.sha256();n=0
  proc=subprocess.Popen(['git','-C',str(D),'show',C+':'+f],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
  while chunk:=proc.stdout.read(8192):h.update(chunk);n+=len(chunk)
  assert proc.wait()==0
  pins[f]={'bytes':n,'sha256':h.hexdigest(),'blob':cmd(['git','-C',str(D),'rev-parse',C+':'+f]).decode().strip()}
 assert cmd(['git','-C',str(D),'rev-parse','HEAD']).decode().strip()==C
 assert cmd(['git','-C',str(B),'rev-parse','HEAD']).decode().strip()==BASE
 alt=[D/'.git/objects']+[Path(x) for x in (D/'.git/objects/info/alternates').read_text().splitlines()]
 assert len(alt)==len(set(alt))
 tools={str(p):{'bytes':Path(p).stat().st_size,'sha256':sha(Path(p).read_bytes())} for p in [NODE,shutil.which('git'),shutil.which('python3')]}
 save('admission.json',dict(candidate=C,baseline=BASE,pins=pins,tools=tools,donorObjects={str(p):footprint(p) for p in alt},SSH=SSH,mount={'argv':[],'intendedFiles':[],'verdict':'N/A: offline local Node; no mount invocation or conditional guest attempt'},resources=rr,commands='sparse no-fetch Git checkout; serial finite Node --max-old-space-size=16; RLIMIT_FSIZE 24MiB output128KiB capture2MiB; no native compilation/wasm',incidents=['Pinning capture gate rejected a large git-show closure file; corrected to streamed8192byte hash with no listing capture before retry. Initial discovery command inadvertently expanded broad mount glob and output was truncated; retained launcher event, no claims based on truncated output. Subsequent exact-path excerpts bounded at8192bytes. Two adapter-name discovery misses before exact line read, no test execution.']))
 cmd(['git','init','-q',str(R)])
 (R/'.git/objects/info/alternates').write_text('\n'.join(map(str,alt))+'\n')
 cmd(['git','config','gc.auto','0'],R);cmd(['git','config','core.sparseCheckout','true'],R);cmd(['git','config','core.sparseCheckoutCone','false'],R)
 (R/'.git/info/sparse-checkout').write_text('/lib/vfs-persistence.js\n/test/test-vfs-read-abort-independent-accept-oct26.js\n/docs/reviews/'+TASK+'/\n')
 cmd(['git','checkout','-q','-b','task/'+TASK,C],R)
 cmd(['git','remote','add','origin','git@github.com:vgrichina/wine-assembly.git'],R)
 save('pins.json',pins)
 print(json.dumps({'admission':'PASS','peak':rr['projectedPeak'],'mem':rr['MemAvailable'],'freeDisk':rr['freeDisk'],'candidate':C,'tools':list(tools)}))

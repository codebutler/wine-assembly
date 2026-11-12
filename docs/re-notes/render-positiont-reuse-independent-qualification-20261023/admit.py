import hashlib,json,os,pathlib,subprocess,time
H=pathlib.Path('/home/user/wine-assembly'); X=pathlib.Path(__file__).parent
D=pathlib.Path(str(H)+'-render-positiont-tiny-rhw-native-qualification-oct23')
R=pathlib.Path(str(H)+'-render-positiont-reuse-independent-qualification-oct23')
C=pathlib.Path(str(H)+'-render-positiont-allocator-reuse-cause-oct23')
OLD=D/'docs/re-notes/render-positiont-tiny-rhw-native-qualification-20261023'
S=pathlib.Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T06-31-54-01a16775-7a7e-7bb0-ac32-7287cb6100e2.jsonl')
G=pathlib.Path(str(H)+'-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs')
REV='c9a59870ff46416653d0782ebfc296df1bb0ae59'
BR='task/render-positiont-reuse-independent-qualification-oct23'
os.environ.update(GIT_NO_LAZY_FETCH='1',PYTHONDONTWRITEBYTECODE='1')
def sha(b):return hashlib.sha256(b).hexdigest()
def size(p):
 if not p.exists():return 0
 assert not p.is_symlink()
 return p.stat().st_size+(sum(q.lstat().st_size for q in p.rglob('*')) if p.is_dir() else 0)
def git(p,*a):return subprocess.check_output(['git','-C',str(p),*a],timeout=30)
def save(n,v):(X/n).write_text(json.dumps(v,indent=2)+'\n')
assert not (X/'admission.json').exists() and not R.exists()
records=json.loads((OLD/'source-manifest.json').read_text())
tree={}
for row in git(C,'ls-tree','-r',REV).decode().splitlines():
 meta,p=row.split('\t');mode,kind,oid=meta.split();tree[p]=(mode,oid)
for r in records:
 p=C/r['path'];b=p.read_bytes()
 if r['path']=='test/test-d3d9-positiont-com-qualification.js':
  r.update(bytes=len(b),sha256=sha(b),blob=tree[r['path']][1])
 assert len(b)==r['bytes'] and sha(b)==r['sha256']
 assert hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()==r['blob']==tree[r['path']][1]
 assert tree[r['path']][0]==r['mode'] and p.stat().st_mode&0o777==int(r['mode'][-3:],8)
 r['retained']=str(p)
assert len(records)==290 and sum(r['pin'] for r in records)==286
pins=json.loads((D/'test/support/positiont-com-source-pins.json').read_text())
assert sha(json.dumps(pins,separators=(',',':')).encode())=='d39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262'
for r in records:
 if r['pin']:assert pins[r['path']]==r['blob']
art=[]
for p,n,h in [(D/'build/positiont-com-tiny-rhw.wasm',1883361,'5d057b5424b710fb28f1c617786ba71d7c8c116fb74e51eac611ec9a79868ef1'),(D/'build/positiont-com-tiny-rhw.provenance.json',1002,'e64c83f925f52649f46e1a89bb952d7dde06d627f7a799f0956a535c1bca8cc3'),(G,2462,'47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197')]:
 b=p.read_bytes();assert len(b)==n and sha(b)==h;art.append(dict(path=str(p),bytes=n,sha256=h))
standing=json.loads((OLD/'standing.json').read_text())
for t in standing['tools']:
 b=pathlib.Path(t['path']).read_bytes();assert len(b)==t['standingBytes'] and sha(b)==t['sha256']
for f in standing['pngjs']['files']:
 b=(pathlib.Path(standing['pngjs']['root'])/f['path']).read_bytes();assert len(b)==f['bytes'] and sha(b)==f['sha256']
save('source-manifest.json',records)
stores=[];queue=[C/'.git/objects'];seen=set()
while queue:
 p=queue.pop()
 if str(p) in seen:continue
 seen.add(str(p));stores.append(dict(path=str(p),bytes=size(p),readOnly=True))
 a=p/'info/alternates'
 if a.exists():queue.extend(pathlib.Path(s) for s in a.read_text().splitlines())
standing.update(donors=[dict(path=str(q),bytes=size(q),readOnly=True) for q in [C,D]],revision=REV,objectStores=stores,artifacts=art)
save('standing.json',standing)
current=dict(external=size(X),session=size(S),private=0)
budgets=dict(closure=sum(r['bytes'] for r in records),privateGitIndexObjects=2097152,directories=524288,evidenceAndScripts=1048576,captures=524288,externalAndSessionFuture=6291456,reserve=8388608)
total=sum(current.values())+sum(budgets.values());free=os.statvfs(H).f_bavail*os.statvfs(H).f_frsize
assert total<=67108864 and free-sum(budgets.values())>=2982150144
mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
save('admission.json',dict(verdict='ADMITTED',time=time.time(),current=current,budgets=budgets,projectedPeak=total,cap=67108864,hostFree=free,hostAfterGrowth=free-sum(budgets.values()),hostFloor=2982150144,MemAvailable=mem,limits=dict(processes=4,sequential=True,arenaBytes=536870912,pages=8192,oldSpaceMiB=512,CPU=150,wall=150,file=25165824,aggregateCapture=524288,overflowExit=125,TERMthenKILL=5,subreap=True),standing='standing.json',closureFiles=290,pins=286,compiler=False,noWorkers=True))
R.mkdir();subprocess.run(['git','init','-q',str(R)],check=True)
(R/'.git/objects/info/alternates').write_text(''.join(q['path']+'\n' for q in reversed(stores)))
git(R,'update-ref','refs/heads/'+BR,REV);git(R,'symbolic-ref','HEAD','refs/heads/'+BR);git(R,'read-tree',REV)
git(R,'update-index','--skip-worktree','--stdin') if False else None
allpaths=git(R,'ls-tree','-r','--name-only',REV)
subprocess.run(['git','-C',str(R),'update-index','--skip-worktree','--stdin'],input=allpaths,check=True)
for r in records:
 p=R/r['path'];p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(pathlib.Path(r['retained']).read_bytes());p.chmod(int(r['mode'][-3:],8))
E=R/'docs/re-notes/render-positiont-reuse-independent-qualification-20261023';E.mkdir(parents=True)
for n in ['admission.json','source-manifest.json','standing.json']: (E/n).write_bytes((X/n).read_bytes())
(E/'capture.py').write_bytes((OLD/'capture.py').read_bytes())
git(R,'remote','add','origin','git@github.com:vgrichina/berrry-wine.git')
print(json.dumps(dict(verdict='ADMITTED',projectedPeak=total,hostAfterGrowth=free-sum(budgets.values()),private=str(R))))

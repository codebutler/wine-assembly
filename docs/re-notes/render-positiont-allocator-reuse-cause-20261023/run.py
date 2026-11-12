import pathlib,json,os,hashlib,sys,resource,importlib.util,time
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2]
D=pathlib.Path('/home/user/wine-assembly-render-positiont-tiny-rhw-native-qualification-oct23')
X=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/render-positiont-allocator-reuse-cause-oct23')
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T06-23-12-01a1676d-83a6-7de1-914f-2bbc219d7b04.jsonl')
G=pathlib.Path('/home/user/wine-assembly-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs')
NODE='/home/user/.nvm/versions/node/v24.18.1/bin/node'
def sha(b):return hashlib.sha256(b).hexdigest()
def size(p):return p.stat().st_size+(sum(q.lstat().st_size for q in p.rglob('*')) if p.is_dir() else 0)
def save(n,v):(E/n).write_text(json.dumps(v,indent=2)+'\n')
mode=sys.argv[1];assert mode in ['original','focused','noop'];assert not (E/(mode+'.json')).exists()
if mode=='original':assert not (E/'original-attempt.json').exists()
elif mode=='focused':assert json.loads((E/'original.json').read_text())['exit']==1
else:assert json.loads((E/'focused.json').read_text())['exit']==0
records=json.loads((E/'source-manifest.json').read_text())
for r in records:
 p=R/r['path'];b=p.read_bytes()
 if r['path']!='test/test-d3d9-positiont-com-qualification.js' or mode=='original':assert sha(b)==r['sha256'],r['path']
 assert p.stat().st_mode&0o777==int(r['mode'][-3:],8)
for a in json.loads((E/'standing.json').read_text())['artifacts']:assert sha(pathlib.Path(a['path']).read_bytes())==a['sha256']
current=dict(private=size(R),external=size(X),session=size(SESSION));total=sum(current.values())+6291456+8388608
free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
assert total<=67108864 and free-6291456>=2982150144 and mem>=1610612736
assert sum((E/(n+'-attempt.json')).exists() for n in ['original','focused','noop'])<3
save(mode+'-attempt.json',dict(time=time.time(),current=current,totalWithFutureAndReserve=total,hostAfterGrowth=free-6291456,MemAvailable=mem,closureFilesVerified=290,pinsVerified=286,mode=mode))
for n in ['NODE_OPTIONS','NODE_V8_COVERAGE','NODE_COMPILE_CACHE','NODE_DEBUG','NODE_DEBUG_NATIVE','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_COMPILER','WINE_WAT_NAMES']:os.environ.pop(n,None)
os.environ.update(NODE_PATH='/home/user/wine-dashboard-deps-20261014/node_modules',PYTHONDONTWRITEBYTECODE='1')
os.chdir(R)
spec=importlib.util.spec_from_file_location('cap',E/'capture.py');cap=importlib.util.module_from_spec(spec);spec.loader.exec_module(cap)
# One aggregate 512KiB capture allocation across all three commands.
used=sum((E/(n+'.log')).stat().st_size for n in ['original','focused','noop'] if (E/(n+'.log')).exists());cap.LOG_LIMIT=524288-used
argv=[NODE,'--max-old-space-size=512','--require',str(G),str(E/'instrument.cjs'),mode,'--qualify','--allow-512m','--module='+str(D/'build/positiont-com-tiny-rhw.wasm'),'--provenance='+str(D/'build/positiont-com-tiny-rhw.provenance.json')]
result=cap.run(argv,E/(mode+'.log'),150);result['peakChildRssBytes']=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024
save(mode+'.json',result)
log=(E/(mode+'.log')).read_text()
expected=0 if mode=='focused' else 1
assert result['exit']==expected and result['groupReaped'] and not result['failure']
if mode=='original':assert 'production allocator must actually reuse freed address 1010564' in log
if mode=='focused':assert 'FOCUSED reuse PASS' in log
if mode=='noop':assert 'ARMED no-op-free' in log and 'production allocator must actually reuse freed address' in log
print(json.dumps(dict(mode=mode,exit=result['exit'],bytes=result['capturedBytes'],peakChildRssBytes=result['peakChildRssBytes'],reaped=True)))

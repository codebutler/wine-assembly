#!/usr/bin/env python3
"""One-shot exact diagnostic rebuild/full COM qualification; no source repair.

Planning reads retained bytes only. Admission precedes materialization/commands.
Every unexpected result consumes the attempt and stops. No worker launches.
"""
import hashlib, importlib.util, json, os, pathlib, resource, subprocess, sys, time, re
E=pathlib.Path(__file__).resolve().parent
R=E.parents[2]
H=pathlib.Path('/home/user/wine-assembly')
D=pathlib.Path(str(H)+'-render-positiont-guarded-com-qualification-oct23')
OLD=D/'docs/re-notes/render-positiont-guarded-com-qualification-20261023'
REVIEW=pathlib.Path(str(H)+'-render-positiont-tiny-rhw-independent-review-oct23')
REV='345ea682b7ff6f70d942315051c01f935e1bbcd2'
X=H/'scratch/usage-watch/render-positiont-tiny-rhw-native-qualification-oct23'
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/23/rollout-2026-10-23T06-14-21-01a16765-6842-7831-b571-1773fe6fe599.jsonl')
DEP=H/'scratch/usage-watch/shadow-man-span-static-canonical-oct23'
GUARD=pathlib.Path(str(H)+'-shadow-man-native-bound-canonical-oct23/docs/re-notes/shadow-man-native-bound-canonical-20261023/native-module-bound.cjs')
GUARD_SHA='47ce2e2b835be33eab6b2b24f027ecaab8ceb61c559890e51548c78199beb197'
NODE='/home/user/.nvm/versions/node/v24.18.1/bin/node'
PINS='test/support/positiont-com-source-pins.json'
SOURCE='src/09ah-d3d-software.wat'
MOD='build/positiont-com-tiny-rhw.wasm'
PROV='build/positiont-com-tiny-rhw.provenance.json'
PINHASH='d39a81a012129bd7c81f4f697d0a8317b3869a8195fc6fd32c1ff13fc3431262'
ENV=dict(os.environ,GIT_NO_LAZY_FETCH='1',GIT_OPTIONAL_LOCKS='0',PYTHONDONTWRITEBYTECODE='1')
def sha(b):return hashlib.sha256(b).hexdigest()
def blob(b):return hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
def save(n,v):(E/n).write_text(json.dumps(v,indent=2)+'\n')
def git(d,*a):return subprocess.check_output(['git','-C',str(d),*a],env=ENV,timeout=30)
def footprint(p):
    if not p.exists():return 0
    assert not p.is_symlink(),str(p)
    if not p.is_dir():return p.stat().st_size
    total=p.stat().st_size
    for q in p.rglob('*'):
        assert not q.is_symlink(),str(q)
        total+=q.lstat().st_size
    return total
def memory():return int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
def process_snapshot():
    rows=[]
    for p in pathlib.Path('/proc').iterdir():
        if not p.name.isdigit():continue
        try:
            args=(p/'cmdline').read_bytes().replace(b'\0',b' ').decode(errors='replace')
            stat=(p/'stat').read_text().rsplit(')',1)[1].split()
            rows.append(dict(pid=int(p.name),ppid=int(stat[1]),pgid=int(stat[2]),args=args))
        except (FileNotFoundError,ProcessLookupError,PermissionError):pass
    return rows
def handback():
    assert (DEP/'result.json').is_file() and (DEP/'final.txt').is_file(),'DEPENDENCY_HANDOFF_UNAVAILABLE'
    final=(DEP/'final.txt').read_text();assert 'All child groups were reaped' in final
    rows=process_snapshot();assert not any(x['pid'] in [1821273,1821253] for x in rows),'DEPENDENCY_OWNER_STILL_LIVE'
    heavy=[x for x in rows if x['args'].startswith(NODE+' ') and 'shadow-man-span-static' in x['args']]
    assert not heavy,('DEPENDENCY_HEAVY_CHILDREN_STILL_LIVE',heavy)
    return dict(result=json.loads((DEP/'result.json').read_text()),finalSha256=sha(final.encode()),final=final,
                ownerPidsAbsent=[1821273,1821253],heavyProcesses=heavy,checked=time.time())
def accounting(phase,growth=4194304):
    components=dict(privateRoot=footprint(R),externalLauncher=footprint(X),separateCodexSession=footprint(SESSION))
    current=sum(components.values());free=os.statvfs(R).f_bavail*os.statvfs(R).f_frsize
    a=dict(phase=phase,components=components,measured=current,futureGrowth=growth,reserve=8388608,
           total=current+growth+8388608,cap=67108864,hostFree=free,hostAfterGrowth=free-growth,hostFloor=2982150144)
    assert a['total']<=67108864 and a['hostAfterGrowth']>=2982150144,('RESOURCE_ADMISSION_DENIED',a)
    return a
def manifest():
    records=json.loads((OLD/'source-manifest.json').read_text())
    oldpins=json.loads(pathlib.Path(next(r['retained'] for r in records if r['path']==PINS)).read_text())
    newpins=json.loads((REVIEW/PINS).read_text())
    assert len(oldpins)==len(newpins)==286
    assert [k for k in oldpins if oldpins[k]!=newpins[k]]==[SOURCE]
    assert oldpins[SOURCE]=='40c91282b9ba9d10bc26e75b6383b6005362d23c'
    assert newpins[SOURCE]=='538290c4241f9112ff5e16f5cd71735ab38edea9'
    assert sha(json.dumps(newpins,separators=(',',':')).encode())==PINHASH
    tree={}
    for row in git(REVIEW,'ls-tree','-r',REV).decode().splitlines():
        meta,path=row.split('\t');mode,kind,oid=meta.split();tree[path]=(mode,oid)
    delta=[]
    for r in records:
        p=r['path']
        if p in [SOURCE,PINS]:
            b=(REVIEW/p).read_bytes();assert b==git(REVIEW,'show',REV+':'+p)
            delta.append(dict(path=p,oldBlob=r['blob'],newBlob=blob(b)))
            r.update(retained=str(REVIEW/p),blob=blob(b),sha256=sha(b),bytes=len(b))
        b=pathlib.Path(r['retained']).read_bytes()
        assert len(b)==r['bytes'] and sha(b)==r['sha256'] and blob(b)==r['blob'],p
        mode,oid=tree[p];assert oid==r['blob'],('COMMITTED_IDENTITY_MISMATCH',p,oid,r['blob'])
        assert mode in ['100644','100755'];r['mode']=mode
        if r['pin']:assert newpins[p]==r['blob']
    source=next(r for r in records if r['path']==SOURCE)
    assert source['sha256']=='43ec7d8685cc4942dbdb30b8c9efacf28ec1add81fed4f55f008b7dbe9c4b0c3'
    fixture=next(r for r in records if r['path']=='test/test-d3d9-positiont-com-qualification.js')
    assert fixture['mode']=='100755' and fixture['sha256']=='5ed316197793ade492b01bc3e510a24a5040497c8e1b5c969d766701b94c4663'
    return records,delta
def plan():
    assert not (E/'admission.json').exists(),'single consolidated admission only'
    records,delta=manifest()
    standing=json.loads((OLD/'standing.json').read_text())
    for t in standing['tools']:
        p=pathlib.Path(t['path']);assert p.is_file() and os.access(p,os.X_OK)
        b=p.read_bytes();assert len(b)==t['standingBytes'] and sha(b)==t['sha256']
    for f in standing['pngjs']['files']:
        b=(pathlib.Path(standing['pngjs']['root'])/f['path']).read_bytes()
        assert len(b)==f['bytes'] and sha(b)==f['sha256']
    assert sha(GUARD.read_bytes())==GUARD_SHA
    assert GUARD.read_bytes()==git(GUARD.parents[3],'show','9f442e41bb81853659d8664e1aa903e560d4061e:'+str(GUARD.relative_to(GUARD.parents[3])))
    # Read-only standing roots/alternate stores are separate from all newly
    # materialized source bytes. No source symlinks or hardlinks are used.
    roots={str(REVIEW),str(D),str(GUARD.parents[3])}|{str(pathlib.Path(r['retained']).parents[len(pathlib.PurePosixPath(r['path']).parts)-1]) for r in records}
    standing['donors']=[dict(path=p,standingBytes=footprint(pathlib.Path(p)),readOnly=True) for p in sorted(roots)]
    stores=[];seen=set();queue=[REVIEW/'.git/objects']
    while queue:
        p=queue.pop()
        if str(p) in seen:continue
        seen.add(str(p));stores.append(dict(path=str(p),standingBytes=footprint(p),readOnly=True))
        a=p/'info/alternates'
        if a.exists():queue.extend(pathlib.Path(s) for s in a.read_text().splitlines())
    standing['alternateObjectStores']=stores
    standing['guard']=dict(path=str(GUARD),bytes=GUARD.stat().st_size,sha256=GUARD_SHA)
    h=handback();save('heavy-handback.json',h)
    save('source-manifest.json',records);save('standing.json',standing)
    closure=json.loads((OLD/'closure.json').read_text())
    closure.update(reusedFrom=str(OLD/'closure.json'),onlyManifestSubstitutions=delta,dynamicReviewRequired=False,
      dynamicReview='Reused accepted audited unchanged compiler/fixture/tool/data closure: four VM stages explicit; all main includes pinned; fonts:none no reads; software Bridge no Worker factories/GL load(); WINE_REGION_MAP unset; icon/loadImage/authority/remote-event routes inactive. pngjs7 in place. No compiler imported by planner.')
    save('closure.json',closure)
    a=accounting('pre-materialization')
    budgets=dict(sourceCopies=sum(r['bytes'] for r in records),sourceDirectoryOverhead=262144,module=8388608,
      provenance=65536,allFiveCommandCaptures=5*524288,temps=65536,privateGitIndexNewObjectsAndEvidenceGrowth=2097152)
    peak=a['total']+sum(budgets.values());after=a['hostAfterGrowth']-sum(budgets.values())
    assert peak<=67108864 and after>=2982150144,('CONSOLIDATED_ALLOCATION_DENIED',peak,after)
    assert not (R/MOD).exists() and not (R/PROV).exists()
    save('admission.json',dict(status='ADMITTED',time=time.time(),accounting=a,budgets=budgets,projectedPeak=peak,
      hostAfterProjectedGrowth=after,files=len(records),pins=286,sourcePinsSha256=PINHASH,onlySubstitutions=delta,
      modes='committed tree including fixture0755; unchanged donor0644 discrepancy not propagated',
      guard=dict(path=str(GUARD),sha256=GUARD_SHA,maxActualBytesBeforeNative=8388608,acceptance='9f442e41 + 004eb539 boundary controls + independent80b28a; reused, not replayed; audited synchronous instrumentation, not security sandbox'),
      limits=dict(perFile=25165824,capturePerCommand=524288,overflowExit=125,termThenKillSeconds=5,subreaper=True,
        compile=dict(CPU=900,wall=900,oldSpaceMiB=2048,MemAvailable=2684354560),
        eachQualifier=dict(CPU=150,wall=150,oldSpaceMiB=512,MemAvailable=1610612736,sharedArenaPages=8192,sharedArenaBytes=536870912,concurrentInstance=1)),
      extraWatSha256='4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068',
      outputPathsAbsent=[MOD,PROV],nativeUnexecuted=True,heavyHandback='heavy-handback.json',
      externalLauncherAndSeparateSessionIncluded=True,installedToolsRunInPlace=True,box=None,lifecycle='coordinator'))
    print(json.dumps(dict(status='ADMITTED',files=len(records),pins=286,projectedPeak=peak,hostAfterProjectedGrowth=after)))
def verify(records):
    for r in records:
        p=R/r['path'];b=p.read_bytes();assert not p.is_symlink()
        assert len(b)==r['bytes'] and sha(b)==r['sha256'] and blob(b)==r['blob'],r['path']
        assert (p.stat().st_mode&0o777)==int(r['mode'][-3:],8),r['path']
    b=(R/MOD).read_bytes();pb=(R/PROV).read_bytes();p=json.loads(pb)
    assert 8<=len(b)<=8388608 and len(pb)<=65536
    expected=dict(schema='positiont-com-diagnostic-v1',candidate='5427a9e2e7d20984249cadcf67f1cb33cc9d85c0',
      acceptance='6ac29d0c4bd8def2f5cf06d4cac1795a08f1e754',sourcePinsSha256=PINHASH,
      extraWatSha256='4bd65ac87452abb4ec5f728f88b399439c9fa4fec91a53b3e6cb96468f58d068',moduleSha256=sha(b),moduleBytes=len(b),
      sourceEntry='src/main.watx',transform='append extraWat to 13-exports.wat only',tailCalls=True,initialPages=8192,maximumPages=8192,shared=True)
    for k,v in expected.items():assert p[k]==v,('PROVENANCE_MISMATCH',k)
    assert p['argv'][2:]==['--build-diagnostic',MOD,PROV]
    assert p['node']=='v24.18.1' and sha(GUARD.read_bytes())==GUARD_SHA
    save('diagnostic.provenance.json',p)
    save('artifact-identities.json',dict(moduleBytes=len(b),moduleSha256=sha(b),provenanceBytes=len(pb),provenanceSha256=sha(pb),
      sourcePinsSha256=PINHASH,extraWatSha256=p['extraWatSha256'],actualPinsVerified=286,actualFilesVerified=len(records),allModesVerified=True,guardSha256=GUARD_SHA))
def execute():
    assert (E/'admission.json').is_file() and not (E/'execution-attempt.json').exists(),'no unadmitted/repeated execution'
    handback();assert sha(GUARD.read_bytes())==GUARD_SHA
    records=json.loads((E/'source-manifest.json').read_text())
    a=accounting('fresh-before-staging');ad=json.loads((E/'admission.json').read_text())
    projected=a['total']+sum(ad['budgets'].values());assert projected<=67108864
    assert a['hostAfterGrowth']-sum(ad['budgets'].values())>=2982150144
    assert memory()>=2684354560,('FRESH_COMPILE_MEMORY_DENIED',memory())
    save('execution-attempt.json',dict(time=time.time(),projectedPeak=projected,MemAvailable=memory(),singleBuild=True,noRetry=True))
    for r in records:
        b=pathlib.Path(r['retained']).read_bytes();assert blob(b)==r['blob'] and sha(b)==r['sha256']
        target=R/r['path'];target.parent.mkdir(parents=True,exist_ok=True)
        with target.open('xb') as f:f.write(b)
        target.chmod(int(r['mode'][-3:],8))
    (R/'build').mkdir();os.chdir(R)
    for n in ['NODE_OPTIONS','NODE_V8_COVERAGE','NODE_COMPILE_CACHE','NODE_DEBUG','NODE_DEBUG_NATIVE','WINE_REGION_MAP','WINE_REGION_SHAKE','WINE_WAT_COMPILER','WINE_WAT_NAMES']:os.environ.pop(n,None)
    os.environ['NODE_PATH']='/home/user/wine-dashboard-deps-20261014/node_modules'
    spec=importlib.util.spec_from_file_location('bounded_capture',E/'capture.py');cap=importlib.util.module_from_spec(spec);spec.loader.exec_module(cap)
    def command(name,args,seconds,expected):
        before=memory();minimum=2684354560 if name=='build' else 1610612736
        assert before>=minimum,('FRESH_COMMAND_MEMORY_DENIED',name,before,minimum)
        pre=accounting('before-'+name)
        result=cap.run(args,E/(name+'.log'),seconds)
        result.update(memAvailableBefore=before,maxChildRssBytes=resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss*1024)
        save(name+'.json',result);save('resources-after-'+name+'.json',accounting('after-'+name))
        assert result['exit']==expected,(name,'UNEXPECTED_EXIT',result['exit'])
    command('build',[NODE,'--max-old-space-size=2048','--require',str(GUARD),'test/support/positiont-com-module.js','--build-diagnostic',MOD,PROV],900,0)
    verify(records) # no compiler/module/arena; hashes and provenance before fixture
    for name in ['baseline','disable-shared-route','alias-queued-bytes','corrupt-queued-ir']:
        args=[NODE,'--max-old-space-size=512','--require',str(GUARD),'test/test-d3d9-positiont-com-qualification.js','--qualify','--allow-512m','--module='+MOD,'--provenance='+PROV]
        if name!='baseline':args.append('--negative-control='+name)
        command(name,args,150,0 if name=='baseline' else 1)
        text=(E/(name+'.log')).read_text()
        if name=='baseline':assert 'PASS full COM/native allocator fixture' in text
        else:
            assert 'ARMED negative control '+name+':' in text,('ARMED_ABSENT',name)
            if name=='disable-shared-route':assert 'DP-start2-offset16-stride48: actual shared native IR selection' in text
            else:assert re.search(r'native shader validation failed \([0-9]+\)',text) or 'queue bytes survive caller mutation and real heap reuse: complete BGRA/depth oracle' in text,('UNEXPECTED_CONTROL_ORACLE',name)
    save('execution-result.json',dict(status='PASS',commands=5,baselineExit=0,negativeExits=[1,1,1],actualNativeSoftwarePixels=True,
      lifetimeQueueFinalRelease=True,allGroupsReaped=True,heavyReleased=True,performance='unknown',browser=False,game=False,box=None,lifecycle='coordinator'))
if __name__=='__main__':
    try:
        assert len(sys.argv)==2 and sys.argv[1] in ['--plan','--execute']
        plan() if sys.argv[1]=='--plan' else execute()
    except Exception as error:
        save('first-blocker.json',dict(status='BLOCKED',phase=sys.argv[1:],error=str(error),time=time.time(),noRetry=True))
        print(str(error),file=sys.stderr);raise SystemExit(2)

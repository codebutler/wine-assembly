import os, sys, json, pathlib, hashlib, resource, subprocess, time, signal, selectors, datetime, ctypes
from limit_contract import configure_parent, child_limits
OWN=pathlib.Path(__file__).resolve().parent
REPO=OWN/'repo'
ROOT=pathlib.Path('/home/user/wine-assembly')
META=ROOT/'scratch/usage-watch'
TASK=OWN.name
D=json.loads((META/(TASK+'-dispatch.json')).read_text())
A=json.loads((META/(TASK+'-admission.json')).read_text())
ENV=dict(os.environ, GIT_ALTERNATE_OBJECT_DIRECTORIES=':'.join(json.loads(pathlib.Path(D['objectStores']).read_text())['stores']), GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes', GIT_TERMINAL_PROMPT='0', PYTHONDONTWRITEBYTECODE='1')
URL='git@github.com:vgrichina/wine-assembly.git'
E=OWN/'evidence'; E.mkdir(exist_ok=True)
SEQ=0
def sha(b):return hashlib.sha256(b).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def write(name,obj):
    p=OWN/name; data=(json.dumps(obj,indent=2,sort_keys=True)+'\n').encode()
    assert len(data)<1024**2
    p.write_bytes(data)
def usage(p):
    return sum(x.stat().st_blocks*512 for x in p.rglob('*') if x.is_file())
def wal():
    return {str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*-wal')}
def rss(pid):
    try:
        s=pathlib.Path('/proc',str(pid),'status').read_text()
        return int(s.split('VmRSS:')[1].split()[0])*1024 if 'VmRSS:' in s else 0
    except (FileNotFoundError,ProcessLookupError):return 0
def admit(label):
    v=os.statvfs(OWN); mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
    nowwal=wal(); growth=sum(max(0,n-BASE['wal'].get(p,n)) for p,n in nowwal.items())
    session=pathlib.Path(BASE['sessionPath']); events=META/TASK/'events.jsonl'
    measured=usage(OWN)+session.stat().st_size+events.stat().st_size+growth
    rec=dict(at=stamp(),label=label,device=os.stat(OWN).st_dev,f_bavail=v.f_bavail,blockSize=v.f_frsize,free=v.f_bavail*v.f_frsize,aggregate=A['aggregate'],projection=dict(sourceGit=3*1048576,evidence=1048576,sessionWAL=8*1048576,publish=3*1048576,uncertainty=9*1048576),MemAvailable=mem,parentRSS=rss(os.getpid()),measured=measured,positiveSharedWALGrowthCountedOnce=growth)
    rec['PASS']=rec['free']-A['aggregate']>=2982150144 and mem>=A['memRequired'] and measured<=24*1048576 and rec['parentRSS']<=128*1048576 and usage(E)<=1048576
    with (OWN/'admission.jsonl').open('a') as f:f.write(json.dumps(rec)+'\n')
    if not rec['PASS']:
        write('FIRST-REJECTION.json',rec);raise RuntimeError('FIRST admission rejection; STOP')
    return rec
def contained(cwd):
    p=pathlib.Path(cwd).resolve(strict=True)
    if not p.is_relative_to(OWN):raise ValueError('cwd outside task')
    return p
def run(argv, *, cwd, expect=0, label='op'):
    global SEQ
    cwd=contained(cwd)
    isgit=argv[0]=='git'
    if isgit:
        assert argv[1:3]==['-C',str(REPO)]
    admission=admit(label);SEQ+=1
    out=[bytearray(),bytearray()]; start=time.monotonic();peak=0; tracked=set()
    p=subprocess.Popen(argv,cwd=cwd,env=ENV,stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=lambda:child_limits(isgit))
    sel=selectors.DefaultSelector()
    for i,s in enumerate([p.stdout,p.stderr]):sel.register(s,selectors.EVENT_READ,i)
    problem=None
    try:
        while sel.get_map() or p.poll() is None:
            # Track process ancestry as well as the process group.
            entries={}
            for q in pathlib.Path('/proc').iterdir():
                if not q.name.isdigit():continue
                try:
                    fields=(q/'stat').read_text().rsplit(')',1)[1].split(); entries[int(q.name)]=(int(fields[1]),int(fields[2]))
                except (FileNotFoundError,ProcessLookupError):continue
            alive={p.pid}; changed=True
            while changed:
                new={pid for pid,(pp,pg) in entries.items() if pp in alive or pg==p.pid or pid in tracked}; changed=not new.issubset(alive);alive|=new
            tracked|=alive
            total=rss(os.getpid())+sum(rss(pid) for pid in alive);peak=max(peak,total)
            if total>512*1048576 or rss(os.getpid())>128*1048576 or time.monotonic()-start>120:raise RuntimeError('physical RSS or wall limit')
            for key,_ in sel.select(.025):
                b=os.read(key.fileobj.fileno(),65536)
                if b:out[key.data].extend(b)
                else:sel.unregister(key.fileobj)
            if sum(map(len,out))>2*1048576:raise RuntimeError('capture limit')
    except Exception as ex:problem=str(ex)
    finally:
        for pid in tracked:
            if pid==os.getpid():continue
            try:os.kill(pid,signal.SIGKILL)
            except ProcessLookupError:pass
        try:os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        p.wait();sel.close()
    rec=dict(at=stamp(),argv=argv,cwd=str(cwd),exit=p.returncode,stdoutSHA256=sha(out[0]),stderrSHA256=sha(out[1]),stdoutBytes=len(out[0]),stderrBytes=len(out[1]),groupPeakRSS=peak,seconds=time.monotonic()-start,problem=problem,descendantCleanup=True)
    for i,suffix in enumerate(['stdout','stderr']):(E/(str(SEQ).zfill(3)+'.'+suffix)).write_bytes(out[i])
    with (OWN/'operations.jsonl').open('a') as f:f.write(json.dumps(rec)+'\n')
    if problem or (expect is not None and p.returncode!=expect):raise RuntimeError(json.dumps(rec))
    return bytes(out[0])
def git(*args,expect=0,label='git'):
    return run(['git','-C',str(REPO),*args],cwd=REPO,expect=expect,label=label)
def identity():
    assert git('rev-parse','--show-toplevel').decode().strip()==str(REPO)
    assert git('rev-parse','--absolute-git-dir').decode().strip()==str(REPO/'.git')
def mutate(*args):
    identity();return git(*args,label='mutation-'+args[0])
def start():
    global BASE
    inherited={n:list(resource.getrlimit(getattr(resource,n))) for n in ['RLIMIT_DATA','RLIMIT_CPU','RLIMIT_FSIZE','RLIMIT_AS']}
    limit=configure_parent();ctypes.CDLL(None).prctl(36,1,0,0,0)
    session=list(pathlib.Path('/home/user/.codex/sessions/2026/10/29').glob('*'+os.environ['CODEX_THREAD_ID']+'*'));assert len(session)==1
    BASE=dict(at=stamp(),sessionPath=str(session[0]),session=os.environ['CODEX_THREAD_ID'],wal=wal(),walPolicy='initial shared WAL standing baseline; positive growth counted once',inherited=inherited,limits=limit,mountArgv=[],mountFiles=[],mountValidation='empty argv, no mounts or runtime authorized',trustedSSH=ENV['GIT_SSH_COMMAND'],allocationRetainedThroughCoordinatorCloseout=True)
    write('baseline.json',BASE)
    controls={}
    for name,kw in [('omitted',{}),('root',dict(cwd=ROOT)),('donor',dict(cwd='/tmp/toyvm-offline-receipt-validation-cli-oct29/repo')),('outside',dict(cwd='/tmp'))]:
        try:run(['/bin/pwd'],**kw)
        except (TypeError,ValueError):controls[name]='REJECTED BEFORE SPAWN'
        else:raise AssertionError(name)
    controls['sentinel']=run(['/bin/pwd'],cwd=OWN,label='owned-positive-sentinel').decode().strip()
    write('controls.json',controls)
    assert sha(pathlib.Path(D['limitModule']).read_bytes())==D['limitModulePin']['sha256']
    for p,pin in {**D['sourcePins'],**D['publicationPins']}.items():
        b=(REPO/p).read_bytes();assert len(b)==pin['bytes'] and sha(b)==pin['sha256'],p
    # Initialization is the sole pre-identity mutation and is confined to OWN.
    git('init','-b','task/'+TASK,label='initialize-owned')
    identity()
    main=git('ls-remote',URL,'refs/heads/main',label='remote-main-once').decode().strip();write('remote-main-before.json',dict(witness=main))
    assert main.split()[0]==D['currentMain'],'REMOTE MAIN MOVED: exact closure must be requalified'
    for commit in [D['currentMain'],D['candidate'],D['acceptedEvidenceCommit']]:git('cat-file','-e',commit+'^{commit}')
    paths=list(D['sourcePins'])
    # Narrow named-path tree queries avoid a broad checkout or captured full tree.
    trees={}
    for commit in [D['currentMain'],D['candidate']]:
        raw=git('ls-tree',commit,'--',*paths).decode();trees[commit]=raw
    write('source-trees.json',trees)
    print(json.dumps(dict(checkpoint='REMOTE_AND_SOURCE_TREES',main=main,trees=trees)))
if __name__=='__main__':
    try:start()
    except Exception as ex:
        write('blocked-receipt.json',dict(at=stamp(),status='BLOCKED',error=str(ex),task=TASK,runtimeUsed=False,allocationRetainedThroughCoordinatorCloseout=True));print(str(ex)[:2000]);sys.exit(1)

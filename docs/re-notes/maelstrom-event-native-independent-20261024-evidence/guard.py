import os,sys,json,time,signal,resource,subprocess,selectors,hashlib,datetime
from pathlib import Path
H=Path('/tmp/maelstrom-event-native-bounded-closeout-oct24'); O=H/'ops'; R=H/'repo'
E=Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-event-native-bounded-closeout-oct24')
S=Path('/home/user/.codex/sessions/2026/10/24/rollout-2026-10-24T18-51-05-01a16f40-9480-7343-9898-dfbb9f44f51f.jsonl')
def save(n,x): (O/n).write_text(json.dumps(x,indent=2)+'\n')
def inventory(p):
    return [dict(path=str(f),bytes=f.stat().st_size,allocated=f.stat().st_blocks*512) for f in ([p] if p.is_file() else p.rglob('*')) if f.is_file() and not f.is_symlink()]
def sql(): return {str(p):p.stat().st_size for p in Path('/home/user/.codex').glob('*.sqlite*')}
def gate(name):
    owned=inventory(H); ext=inventory(E)+inventory(S); cur=sql()
    if not (O/'sqlite-baseline.json').exists(): save('sqlite-baseline.json',cur)
    base=json.loads((O/'sqlite-baseline.json').read_text())
    positive=sum(max(0,v-base.get(k,0)) for k,v in cur.items())
    charges=dict(owned=sum(max(x['bytes'],x['allocated']) for x in owned),externalFull=sum(max(x['bytes'],x['allocated']) for x in ext),sqliteConservative=max(sum(v for k,v in cur.items() if k.endswith('-wal')),positive),futureExternalSQLite=12*1048576,publicationGitCopies=3*1048576,narrowCaptures=2*1048576,reserve=8*1048576)
    peak=sum(charges.values()); v=os.statvfs(H); free=v.f_bavail*v.f_frsize
    mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
    x=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),charges=charges,peak=peak,cap=67108864,free=free,projectedDiskAfter=free-peak,memAvailable=mem,ownedManifest=owned,externalManifest=ext,sqliteCurrent=cur,sqlitePositive=positive,deficiencies=['Initial instruction/inventory reads used timeout but lacked complete process/output supervision; no retroactive compliance.','SQLite baseline late; entire extant WAL conservatively charged.','Prior reviewer truncated 25165824-byte pack and projected 81868568 failure retained at prior ops/result.json; separate task, not erased.','Producer broad reads/unwrapped cheap checks/late baseline/author correction retained.'])
    x['pass']=peak<=67108864 and free-peak>=2982150144 and mem>=805306368 and all(v['bytes']<=24*1048576 for v in owned+ext)
    save(name+'-resource.json',x)
    assert x['pass'], 'RESOURCE GUARD FIRST FAILURE; STOP'
    return x
def run(name,argv):
    gate(name)
    def limits():
        resource.setrlimit(resource.RLIMIT_CPU,(60,60)); resource.setrlimit(resource.RLIMIT_FSIZE,(24*1048576,24*1048576))
    env=dict(os.environ,NODE_OPTIONS='--max-old-space-size=256',TMPDIR=str(O),GIT_OPTIONAL_LOCKS='0',GIT_SSH_COMMAND='ssh -i /home/user/.ssh/wine_github_ed25519 -o BatchMode=yes -o IdentitiesOnly=yes -o UserKnownHostsFile=/home/user/.ssh/wine_github_known_hosts -o StrictHostKeyChecking=yes')
    t=time.monotonic(); p=subprocess.Popen(argv,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
    os.set_blocking(p.stdout.fileno(),False); sel=selectors.DefaultSelector(); sel.register(p.stdout,selectors.EVENT_READ)
    out=bytearray(); reason='natural'; termAt=None
    def send(s):
        try: os.killpg(p.pid,s)
        except ProcessLookupError: pass
    while sel.get_map() or p.poll() is None:
        now=time.monotonic()
        if now-t>=60 and reason=='natural': reason='wall'
        if reason!='natural' and termAt is None: send(signal.SIGTERM); termAt=now
        if termAt is not None and now-termAt>=4: send(signal.SIGKILL)
        for key,_ in sel.select(.02):
            b=os.read(key.fileobj.fileno(),65536)
            if not b: sel.unregister(key.fileobj); key.fileobj.close(); continue
            room=131072-len(out); out.extend(b[:room])
            if len(b)>room: reason='output'
    rc=p.wait(); send(signal.SIGTERM); send(signal.SIGKILL)
    try: os.killpg(p.pid,0); absent=False
    except ProcessLookupError: absent=True
    (O/(name+'.log')).write_bytes(out)
    x=dict(argv=argv,returncode=rc,reason=reason,elapsed=time.monotonic()-t,bytes=len(out),sha256=hashlib.sha256(out).hexdigest(),pgid=p.pid,groupAbsent=absent,waitReaped=True,limits=dict(heapMiB=256,cpu=60,wall=60,output=131072,file=25165824,killWithinSeconds=5))
    save(name+'-terminal.json',x); print(json.dumps(x)); print(out.decode(errors='replace'))
    assert reason=='natural' and absent,'PROCESS GUARD FIRST FAILURE; STOP'
    return rc
if __name__=='__main__':
    if len(sys.argv)==2: print(json.dumps({k:v for k,v in gate(sys.argv[1]).items() if k not in ['ownedManifest','externalManifest','sqliteCurrent']}))
    else: sys.exit(run(sys.argv[1],sys.argv[2:]))

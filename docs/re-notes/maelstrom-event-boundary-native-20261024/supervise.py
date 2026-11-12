#!/usr/bin/env python3
"""One-shot native launch with lock, measured admission and process-group cleanup."""
import ctypes,datetime,fcntl,hashlib,json,os,pathlib,resource,selectors,shutil,signal,subprocess,time
H=pathlib.Path('/tmp/maelstrom-event-observer-native-qualification-oct24'); O=H/'ops'; R=H/'repo'
EXT=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-event-observer-native-qualification-oct24')
SESSION=pathlib.Path('/home/user/.codex/sessions/2026/10/24/rollout-2026-10-24T18-34-00-01a16f30-f02a-7c92-b3b0-77dc7bfcc6f8.jsonl')
CAP=67108864; FLOOR=2982150144; MEM=2684354560; OUT=131072
def dump(name,x): (O/name).write_text(json.dumps(x,indent=2)+'\n')
def measured(root):
    paths=[root]+list(root.rglob('*')) if root.is_dir() else [root]
    return [dict(path=str(p),bytes=p.stat().st_size,allocated=p.stat().st_blocks*512) for p in paths if p.is_file()]
def sqlite(): return {str(p):p.stat().st_size for p in pathlib.Path('/home/user/.codex').glob('*.sqlite*')}
def admission():
    owned=measured(H); external=measured(EXT)+measured(SESSION)
    sql=sqlite(); baseline=json.loads((O/'sqlite-baseline.json').read_text())
    growth=sum(max(0,v-baseline.get(k,0)) for k,v in sql.items())
    # Full extant WAL charge covers preceding task growth before late baseline;
    # main DB timestamps/lengths preserved in baseline receipt. Do not double count.
    historical=max(sum(v for k,v in sql.items() if k.endswith('-wal')),growth)
    charges=dict(owned=sum(max(p['bytes'],p['allocated']) for p in owned),
      externalFull=sum(max(p['bytes'],p['allocated']) for p in external),sqliteConservative=historical,
      nativeOutput=OUT,publicationCopiesAndGit=3*1048576,futureExternalAndSQLite=12*1048576,reserve=8*1048576)
    peak=sum(charges.values()); free=shutil.disk_usage(H).free
    mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable:')))*1024
    x=dict(at=datetime.datetime.now(datetime.timezone.utc).isoformat(),charges=charges,peak=peak,cap=CAP,
      ownedManifest=owned,externalManifest=external,sqliteCurrent=sql,sqlitePositiveSinceBaseline=growth,
      free=free,projectedDiskAfter=free-peak,requiredDiskFloor=FLOOR,memAvailable=mem,requiredMem=MEM,
      lateBaselineDeficiency='No pre-task SQLite baseline. Entire extant WAL conservatively charged; previous oversized search retained in logs.',
      passAdmission=peak<=CAP and free-peak>=FLOOR and mem>=MEM)
    dump('native-admission.json',x); assert x['passAdmission'],'resource admission failed'
    assert all(p['bytes']<=24*1048576 for p in owned+external),'per-file cap'
    return x
def main():
    assert not (O/'native-attempt.json').exists(),'ONE attempt only; never retry'
    lock=open('/tmp/wine-ops-heavy-runtime.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,24,18,59,tzinfo=datetime.timezone.utc),'native cutoff guard'
    a=admission()
    assert json.loads((O/'preflight.json').read_text())['pass']
    assert ctypes.CDLL(None).prctl(36,1,0,0,0)==0
    argv=[shutil.which('node'),'--max-old-space-size=512','test/maelstrom-event-boundary-native.cjs',
      '/tmp/maelstrom-head-yield-observer-oct24/ops/run.js','/tmp/maelstrom-head-yield-observer-oct24/ops/13-exports.wat',
      '/tmp/maelstrom-event-triggered-boundary-observer-oct24/ops/thread-manager.js',
      '/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm']
    dump('native-attempt.json',dict(argv=argv,cwd=str(R),time=time.time(),lock=lock.name,executionCount=1))
    def limits():
      resource.setrlimit(resource.RLIMIT_CPU,(90,90));resource.setrlimit(resource.RLIMIT_FSIZE,(24*1048576,24*1048576))
    env=dict(os.environ,NODE_OPTIONS='--max-old-space-size=512',TMPDIR=str(O))
    t=time.monotonic();p=subprocess.Popen(argv,cwd=R,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
    os.set_blocking(p.stdout.fileno(),False); sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ)
    output=bytearray();reason='natural';term=False;kill=False;termAt=None
    def send(sig):
      try:os.killpg(p.pid,sig)
      except ProcessLookupError:pass
    while sel.get_map() or p.poll() is None:
      now=time.monotonic()
      if (now-t>=60 or datetime.datetime.now(datetime.timezone.utc)>=datetime.datetime(2026,10,24,19,tzinfo=datetime.timezone.utc)) and reason=='natural':reason='wall/cutoff'
      if reason!='natural' and termAt is None:send(signal.SIGTERM);term=True;termAt=now
      if termAt is not None and now-termAt>=4.5:send(signal.SIGKILL);kill=True
      for key,_ in sel.select(.02):
        b=os.read(key.fileobj.fileno(),65536)
        if not b:sel.unregister(key.fileobj);key.fileobj.close();continue
        remaining=OUT-len(output); output.extend(b[:remaining])
        if len(b)>remaining:reason='output cap'
    code=p.wait();send(signal.SIGTERM)
    deadline=time.monotonic()+4.5
    while True:
      try:child,_=os.waitpid(-1,os.WNOHANG)
      except ChildProcessError:break
      if not child:
        if time.monotonic()>=deadline:send(signal.SIGKILL);kill=True
        time.sleep(.02)
    send(signal.SIGKILL)
    try:os.killpg(p.pid,0);remaining=True
    except ProcessLookupError:remaining=False
    (O/'native.log').write_bytes(output)
    terminal=dict(argv=argv,cwd=str(R),pgid=p.pid,returncode=code,reason=reason,TERM=term,KILL=kill,
      remainingGroup=remaining,waitReaped=True,elapsed=time.monotonic()-t,outputBytes=len(output),
      limits=dict(cpu=90,wall=60,heapMiB=512,linearMiB=512,pipeOutput=OUT,perFile=24*1048576))
    dump('native-terminal.json',terminal)
    print(json.dumps(terminal))
    assert code==0 and reason=='natural' and not remaining,'native failure: no retry'
    result=json.loads(output);assert result['status']=='PASS';dump('native-result.json',result)
if __name__=='__main__': main()

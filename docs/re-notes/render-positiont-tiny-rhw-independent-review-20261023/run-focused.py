#!/usr/bin/env python3
"""Bounded offline scalar tests; subreap descendants; first unexpected failure stops."""
import ctypes, hashlib, json, os, pathlib, resource, selectors, signal, subprocess, sys, time
HERE=pathlib.Path(__file__).resolve().parent
ROOT=HERE.parents[2]
NODE='/home/user/.nvm/versions/node/v24.18.1/bin/node'
assert ctypes.CDLL(None,use_errno=True).prctl(36,1,0,0,0)==0
total=0
def limits():
    resource.setrlimit(resource.RLIMIT_CPU,(60,60))
    resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
def run(name,script,args=(),reject=None):
    global total
    mem=int(next(l.split()[1] for l in pathlib.Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
    assert mem>=805306368,'fresh memory admission denied'
    argv=[NODE,'--max-old-space-size=256',str(HERE/script),*args]
    p=subprocess.Popen(argv,cwd=ROOT,env={**os.environ,'GIT_NO_LAZY_FETCH':'1'},stdout=subprocess.PIPE,stderr=subprocess.PIPE,start_new_session=True,preexec_fn=limits)
    start=time.monotonic();sel=selectors.DefaultSelector();data=bytearray();failure=None
    for stream in (p.stdout,p.stderr):sel.register(stream,selectors.EVENT_READ)
    while sel.get_map():
        if time.monotonic()-start>=60:failure='wall';break
        for key,_ in sel.select(.1):
            b=os.read(key.fileobj.fileno(),8192)
            if not b:sel.unregister(key.fileobj)
            elif total+len(data)+len(b)>524288:failure='capture';break
            else:data.extend(b)
        if failure:break
    if failure:
        os.killpg(p.pid,signal.SIGTERM)
        try:p.wait(timeout=5)
        except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL)
    p.wait(timeout=5)
    # Any surviving owned group is also a failure and is terminated/reaped.
    try:os.killpg(p.pid,0);live=True
    except ProcessLookupError:live=False
    if live:
        failure=failure or 'surviving owned group';os.killpg(p.pid,signal.SIGTERM)
        deadline=time.monotonic()+5
        while time.monotonic()<deadline:
            try:
                pid,_=os.waitpid(-p.pid,os.WNOHANG)
                if not pid:time.sleep(.01)
            except ChildProcessError:break
        try:os.killpg(p.pid,signal.SIGKILL)
        except ProcessLookupError:pass
        while True:
            try:os.waitpid(-p.pid,0)
            except ChildProcessError:break
    total+=len(data)
    (HERE/(name+'.log')).write_bytes(data)
    receipt=dict(argv=argv,exit=p.returncode,memAvailable=mem,wallSeconds=time.monotonic()-start,captureBytes=len(data),aggregateCaptureBytes=total,boundFailure=failure,pid=p.pid,subreaper=True,reaped=True,sha256=hashlib.sha256(data).hexdigest())
    (HERE/(name+'.json')).write_text(json.dumps(receipt,indent=2)+'\n')
    assert failure is None,receipt
    if reject:assert p.returncode!=0 and reject.encode() in data,bytes(data)
    else:assert p.returncode==0,bytes(data)
if sys.argv[1:]==['--pins']:
    run('pin-invariants','pin-invariant.cjs')
else:
    run('independent-arithmetic','independent.cjs')
    run('reject-old','independent.cjs',['--old'],'tiny exact rational')
    run('reject-no-abs','independent.cjs',['--no-abs'],'tiny exact rational')
    run('reject-always-divide','independent.cjs',['--always-divide'],'finite reciprocal compatibility')
print('PASS bounded offline checks; all owned process groups reaped')

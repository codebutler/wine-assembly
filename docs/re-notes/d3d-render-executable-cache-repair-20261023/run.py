import os,sys,json,time,subprocess,resource,selectors,signal,shutil,glob
from pathlib import Path
base=Path(__file__).resolve().parent
external=Path('/home/user/wine-assembly/scratch/usage-watch/d3d-render-executable-cache-focused-repair-oct23')
sid='01a16a5c-205b-75c1-851d-d599b2e53240'
def size(p):
    try:return p.stat().st_size
    except FileNotFoundError:return 0
def guard():
    paths=[p for root in (base,external) for p in root.rglob('*') if p.is_file()]
    private=sum(size(p) for p in base.rglob('*') if p.is_file())
    walpaths=[Path(p) for pat in ('/home/user/.codex/*.sqlite-wal','/home/user/.codex/*.sqlite-shm') for p in glob.glob(pat)]
    sessions=list(Path('/home/user/.codex/sessions/2026/10/23').glob('*'+sid+'*'))
    actual=sum(size(p) for p in paths+walpaths+sessions)
    private_headroom=max(0,8388608-private)
    peak=actual+private_headroom+16777216+8388608+1048576
    mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
    r=dict(actual=actual,private=private,wal_shm=sum(size(p) for p in walpaths),sessions={str(p):size(p) for p in sessions},external=sum(size(p) for p in external.rglob('*') if p.is_file()),private_headroom=private_headroom,future=16777216,reserve=8388608,publication=1048576,peak=peak,host_free=shutil.disk_usage(base).free,MemAvailable=mem)
    assert all(size(p)<=25165824 for p in paths),'file guard'
    assert private<=8388608,r
    assert peak<=67108864,r
    assert r['host_free']-(peak-actual)>=2982150144,r
    assert mem>=805306368,r
    return r
def limits():
    os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
if __name__=='__main__':
    before=guard()
    if len(sys.argv)==1:
        (base/'admission.json').write_text(json.dumps(dict(before=before,installed_node={'path':shutil.which('node'),'bytes':Path(shutil.which('node')).stat().st_size},standing_inputs=['/tmp/d3d-render-artifact-phase-oct23/repo','/tmp/d3d-render-artifact-independent-oct23/repo'],prior_setup_failure='/tmp/d3d-render-executable-cache-repair-oct23/checkout-guard-failure.json'),indent=2)+'\n');print(json.dumps(before));sys.exit()
    receipt={'before':before,'command':sys.argv[1:]};start=time.monotonic();proc=subprocess.Popen(sys.argv[1:],stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=limits)
    sel=selectors.DefaultSelector();sel.register(proc.stdout,selectors.EVENT_READ);captured=0
    try:
        with open(base/'checks.log','ab',buffering=0) as out:
            while sel.get_map():
                assert time.monotonic()-start<60,'wall guard'
                guard()
                for key,_ in sel.select(.1):
                    b=os.read(key.fd,4096)
                    if not b:sel.unregister(key.fileobj);continue
                    # Includes conservative 256 KiB non-streaming inspection/receipt output.
                    assert (base/'checks.log').stat().st_size+len(b)+262144<=524288,'aggregate streaming capture guard'
                    out.write(b);captured+=len(b)
        receipt.update(exit=proc.wait(timeout=1),captured=captured,after=guard(),wall=time.monotonic()-start)
    except BaseException as e:
        receipt['failure']=str(e);raise
    finally:
        if proc.poll() is None:os.killpg(proc.pid,signal.SIGKILL);proc.wait()
        with open(base/'execution.jsonl','a') as f:f.write(json.dumps(receipt)+'\n')
    print(json.dumps(receipt));sys.exit(receipt['exit'])

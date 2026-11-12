import subprocess,sys,os,time,selectors,json,signal,resource
from pathlib import Path
P=Path(__file__).parent
state=P/'capture-count'
count=int(state.read_text()) if state.exists() else 200000
cmd=sys.argv[1:]
mem=None
if any('node' in Path(c).name for c in cmd[:2]):
    mem=int(next(l.split()[1] for l in Path('/proc/meminfo').read_text().splitlines() if l.startswith('MemAvailable:')))*1024
    assert mem>=805306368, f'MemAvailable guard: {mem}'
with (P/'execution-guards.jsonl').open('a') as f:
    f.write(json.dumps(dict(command=cmd,mem_available=mem,mem_required=805306368 if mem is not None else None,
        cpu_seconds=60,wall_seconds=60,perfile=25165824,capture_before=count,capture_limit=524288))+'\n')
def limits():
    resource.setrlimit(resource.RLIMIT_CPU,(60,60))
    resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
proc=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True,preexec_fn=limits)
sel=selectors.DefaultSelector();sel.register(proc.stdout,selectors.EVENT_READ)
start=time.monotonic(); log=P/'validation.log'
with log.open('ab') as out:
    out.write(('COMMAND '+repr(cmd)+'\n').encode())
    while sel.get_map():
        if time.monotonic()-start>60:
            os.killpg(proc.pid,signal.SIGKILL);raise SystemExit('wall guard rejected')
        for key,_ in sel.select(.2):
            b=os.read(key.fd,4096)
            if not b: sel.unregister(key.fileobj);continue
            if count+len(b)>524288:
                os.killpg(proc.pid,signal.SIGKILL)
                (P/'capture-rejection.json').write_text(json.dumps(dict(count=count,next=len(b),limit=524288)))
                raise SystemExit('capture guard rejected before buffering')
            count+=len(b);state.write_text(str(count));out.write(b);sys.stdout.buffer.write(b);sys.stdout.buffer.flush()
rc=proc.wait(); print('EXIT',rc)
raise SystemExit(rc)

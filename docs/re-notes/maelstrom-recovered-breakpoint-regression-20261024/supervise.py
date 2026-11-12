import os,sys,json,time,signal,resource,subprocess,selectors,pathlib,shutil
base=pathlib.Path(__file__).resolve().parent.parent
mode=sys.argv[1]; native=mode=='native'; assert mode in ['native','boundary','focused']
mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
minimum=2684354560 if native else 805306368
assert mem>=minimum,('memory admission rejected',mem,minimum)
assert shutil.disk_usage(base).free-52428800-67108864>=2982150144,'disk gate rejected'
commands={'native':['node','--max-old-space-size=512','tools/maelstrom-retained-breakpoint-probe.cjs','/home/user/wine-assembly-shadow-man-span-static-canonical-oct23/build/wine-assembly.wasm'],'boundary':['node','--max-old-space-size=256','test/test-maelstrom-breakpoint-boundary-audit.js'],'focused':['node','--max-old-space-size=256','test/test-maelstrom-retained-breakpoint-probe.js']}
argv=commands[mode]; start=time.monotonic()
def setup():
 os.setsid();resource.setrlimit(resource.RLIMIT_CPU,(90,90) if native else (60,60));resource.setrlimit(resource.RLIMIT_FSIZE,(25165824,25165824))
p=subprocess.Popen(argv,cwd=base/'repo',stdout=subprocess.PIPE,stderr=subprocess.STDOUT,preexec_fn=setup)
s=selectors.DefaultSelector();s.register(p.stdout,selectors.EVENT_READ);output=bytearray();reason='natural';term=False;kill=False
while s.get_map():
 if time.monotonic()-start>=60: reason='wall';break
 for key,_ in s.select(.1):
  chunk=os.read(key.fileobj.fileno(),16384)
  if not chunk: s.unregister(key.fileobj);continue
  if len(output)+len(chunk)>131072: reason='output';break
  output.extend(chunk)
 if reason!='natural':break
if reason!='natural':
 term=True;os.killpg(p.pid,signal.SIGTERM)
 try:p.wait(timeout=2)
 except subprocess.TimeoutExpired:kill=True;os.killpg(p.pid,signal.SIGKILL)
try:rc=p.wait(timeout=2)
except subprocess.TimeoutExpired:
 kill=True;os.killpg(p.pid,signal.SIGKILL);rc=p.wait(timeout=1)
try:os.killpg(p.pid,0);remaining=True
except ProcessLookupError:remaining=False
(base/'ops'/f'{mode}.log').write_bytes(output)
r={'argv':argv,'cwd':str(base/'repo'),'pid':p.pid,'pgid':p.pid,'memAvailable':mem,'reason':reason,'TERM':term,'KILL':kill,'returncode':rc,'remainingGroup':remaining,'elapsed':time.monotonic()-start,'outputBytes':len(output),'limits':{'cpu':90 if native else 60,'wall':60,'heapMiB':512 if native else 256,'outputBytes':131072}}
(base/'ops'/f'{mode}-terminal.json').write_text(json.dumps(r,indent=2));print(json.dumps(r));print(output.decode()[:12000]);sys.exit(rc if rc else (0 if reason=='natural' and not remaining else 1))

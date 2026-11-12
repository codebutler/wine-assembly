from work import *
from capture import account
import signal,fcntl
O=H/'ops';account('postguest')
code='''import os,pathlib,json,hashlib,fcntl,shutil,re
h=pathlib.Path(HOME_TASK)
rows=[]
for n in ['runner/test/run-event-observed.js','runner/lib/thread-manager.js','runtime/build/wine-assembly.wasm','supervise.py','guest-args.json','vfs/maelstrom/Maelstrom.exe','vfs/maelstrom/SDL.dll','vfs/maelstrom/SDL_net.dll']:
 p=h/n;rows.append(dict(path=n,bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()))
matches=[]
for p in pathlib.Path('/proc').iterdir():
 if not p.name.isdigit() or int(p.name)==os.getpid():continue
 try:
  b=(p/'cmdline').read_bytes()
  if b and (str(h)+'/runner/').encode() in b:matches.append(int(p.name))
 except (FileNotFoundError,PermissionError,ProcessLookupError):pass
assert not matches,matches
lock=open('/tmp/wine-ops-heavy-runtime.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
allocated=sum(max(p.stat().st_size,p.stat().st_blocks*512) for p in h.rglob('*') if p.is_file())
print(json.dumps(dict(uid=os.getuid(),rows=rows,remainingGuestProcesses=matches,heavyLockFree=True,remoteOwnedAllocated=allocated,free=shutil.disk_usage('/tmp').free,memAvailable=int(re.search(r'MemAvailable:\\s+(\\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024)))
'''.replace('HOME_TASK',repr(str(H)))
j=remote('python3 -c '+shlex.quote(code));save('ops/cleanup-api.json',j);q=json.loads(j['stdout']);assert q['remoteOwnedAllocated']<=19000000
id=json.load(open(O/'identities.json'));expected={'runner/test/run-event-observed.js':id['effectiveRunnerSHA256'],'runner/lib/thread-manager.js':id['schedulerSHA256'],'runtime/build/wine-assembly.wasm':id['moduleSHA256'],'supervise.py':sha((O/'supervise.py').read_bytes()),'guest-args.json':sha((H/'guest-args.json').read_bytes()),'vfs/maelstrom/Maelstrom.exe':'0eca5703e512d33c5e5a0bc1a27f14bd3aa4ecddded6e09b4d4019c2f27a15e5','vfs/maelstrom/SDL.dll':'02433232425e68009843bd3ecec20ad67453a48487f7b5828c595b76e2f9d373','vfs/maelstrom/SDL_net.dll':'46ccbb7e5982e2c15421af7dd4fa29b26841d9731c31a86cf9554c90be53af95'}
assert all(x['sha256']==expected[x['path']] for x in q['rows'])
p=subprocess.run([B,'--no-update','--json','info',BOX],capture_output=True,text=True,timeout=30);assert p.returncode==0
b=json.loads(p.stdout)['sandbox'];save('ops/box-handoff.json',dict(id=b['id'],state=b['state'],running=b['state'] in ['idle','running','ready'],expiry=b['archiveAfter'],createdAt=b['createdAt'],coordinatorOwnsShutdown=True,shutdown='2026-10-24T19:23:00Z',lifecycleMutations=0));assert b['state'] in ['idle','running','ready']
lock=open('/tmp/wine-ops-heavy-runtime.lock','a+');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB);fcntl.flock(lock,fcntl.LOCK_UN)
try:os.kill(79249,signal.SIGTERM);watch='TERM sent'
except ProcessLookupError:watch='already absent'
time.sleep(.1)
state=pathlib.Path('/proc/79249/stat');state=state.read_text().split()[2] if state.exists() else 'absent'
save('ops/cleanup.json',dict(remote=q,remoteHashesPass=True,localHeavyLockFree=True,watcherPID=79249,watcherAction=watch,watcherState=state,guestGroupReaped=json.load(open(O/'collected/guest/terminal.json'))['remainingGroup']==False,coordinatorOwnsBoxLifecycle=True))
print(json.dumps(dict(cleanup=True,remoteAllocated=q['remoteOwnedAllocated'],boxState=b['state'],expiry=b['archiveAfter'],watcher=state)))

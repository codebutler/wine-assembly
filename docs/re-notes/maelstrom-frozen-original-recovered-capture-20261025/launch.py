import pathlib,sys,json,os,fcntl,time,shlex
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';sys.path.insert(0,str(O));from transport import py,remote,save,sha;from account import account
lock=open('/tmp/wine-ops-heavy-runtime.lock','a+')
try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
except BlockingIOError:
 save('ops/first-lock-rejection.json',dict(at=time.time(),reason='local heavy runtime lock occupied',guestStarts=0));raise
save('ops/local-lock.json',dict(pid=os.getpid(),acquiredAt=time.time(),path='/tmp/wine-ops-heavy-runtime.lock'))
a=account('preguest');limits=json.loads(json.load(open(O/'inherited-supervisor-limits.json'))['stdout']);assert limits['fileLimit']==[131072,131072] and limits['cpu']==[90,90]
for n,v in limits['plannedArtifacts'].items():assert v<=131072
p=json.load(open(O/'preflight-api.json'));assert p['exitCode']==0 and json.loads(p['stdout'])['passPreflight']
j=py('import os,pathlib,json,shutil;print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024)))');save('ops/fresh-preguest-api.json',j);j=json.loads(j['stdout']);assert j['uid']==1000 and j['free']-a['peak']>=2982150144 and j['memAvailable']>=2684354560
assert not (O/'one-guest-launch.json').exists()
save('ops/one-guest-launch.json',dict(at=time.time(),box='bx_g84h8h98',argvSHA256=sha((H/'guest-args.json').read_bytes()),supervisorSHA256=sha((O/'supervise.py').read_bytes()),guestStartsAuthorized=1,repeatForbidden=True))
save('ops/guest-supervisor-api.json',remote('python3 '+shlex.quote(str(O/'supervise.py'))+' guest',75))
fcntl.flock(lock,fcntl.LOCK_UN);lock.close();save('ops/local-lock-release.json',dict(at=time.time(),released=True));print('single original guest terminal receipt retained',flush=True)

from work import *
assert not (H/'guest-attempt.json').exists(),'one guest only'
cutoff=1792992900
assert time.time()<cutoff,'guest cutoff'
info=py('import os,json,pathlib,shutil;h=pathlib.Path('+repr(R)+');print(json.dumps(dict(uid=os.getuid(),free=shutil.disk_usage("/tmp").free,memAvailable=int(pathlib.Path("/proc/meminfo").read_text().split("MemAvailable:")[1].split()[0])*1024,materialized=sum(p.lstat().st_blocks*512 for p in [h,*h.rglob("*")]),largest=max(p.stat().st_size for p in h.rglob("*") if p.is_file()))))')
save('resource-immediate-api.json',info);save('remote-admission.json',info);remoteInfo=json.loads(info['stdout'])
a=measure('immediate-before-guest',remoteInfo['materialized'])
assert remoteInfo['uid']==1000 and remoteInfo['memAvailable']>=2684354560 and remoteInfo['largest']<=25165824
env=json.load(open(H/'next-env.json'));assert env['ENIGMA_CAPTURE_PROFILE']=='single-frame' and env['ENIGMA_LOSSLESS_CAPTURE']=='1'
# The lock holder execs the original accepted complete supervisor in-place after a
# timestamped gate. No additional guest/process supervisor or output wrapper.
locked='''import pathlib,os,json,time,shutil,hashlib,sys,resource
h=pathlib.Path(ROOT)
mem=int(pathlib.Path('/proc/meminfo').read_text().split('MemAvailable:')[1].split()[0])*1024
free=shutil.disk_usage('/tmp').free
j=dict(at=time.time(),host='bx_7qwjxps7',memAvailable=mem,threshold=2684354560,free=free,projectedPeak=PEAK,lock='/tmp/wine-qualification-heavy.lock',uid=os.getuid(),kernelArtifactLimit=2097152,combinedOutputLimit=131072,inheritedFileLimit=resource.getrlimit(resource.RLIMIT_FSIZE))
(h/'immediate-locked-gate.json').write_text(json.dumps(j))
assert mem>=2684354560 and free-PEAK>=2982150144 and os.getuid()==1000
assert resource.getrlimit(resource.RLIMIT_FSIZE)[1] in (-1,resource.RLIM_INFINITY) or resource.getrlimit(resource.RLIMIT_FSIZE)[1]>=2097152
assert time.time()<1792992900
assert hashlib.sha256((h/'supervise.py').read_bytes()).hexdigest()==PIN
assert not (h/'guest').exists()
os.execv(sys.executable,[sys.executable,str(h/'supervise.py'),'guest'])
'''.replace('ROOT',repr(R)).replace('PEAK',str(a['peak'])).replace('PIN',repr(json.load(open(H/'supervisor-identity.json'))['deployed']))
encoded=base64.b64encode(locked.encode()).decode()
py('import base64,pathlib;pathlib.Path('+repr(R+'/launch-locked.py')+').write_bytes(base64.b64decode('+repr(encoded)+'))')
cmd='flock -n -E 73 /tmp/wine-qualification-heavy.lock env '+' '.join(shlex.quote(k+'='+v) for k,v in env.items())+' python3 '+shlex.quote(R+'/launch-locked.py')
save('guest-attempt.json',dict(at=time.time(),guestAttempts=1,command=cmd,box=BOX,configuration='FTQ then unchanged original capture; accepted single-frame',limits='original max10000000/55s, first and only PNG30000, screen640x480',localGate=a,remoteGate=remoteInfo))
save('guest-supervisor-api.json',remote(cmd,75,allow_exit=True))
print('ONE ATTEMPT FINISHED; supervisor response retained')

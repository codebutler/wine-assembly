import pathlib,json,time,shutil
O=pathlib.Path(__file__).resolve().parent
C=pathlib.Path('/home/user/.codex')
W=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch')
old='maelstrom-current-main-uop-build-native-oct26'
new='maelstrom-current-main-retained-accept-publication-oct26'
alloc=lambda p:max(p.lstat().st_size,p.lstat().st_blocks*512)
def size(p):
 return sum(alloc(f) for f in [p,*p.rglob('*')])
base=json.loads((O/'db-baseline.json').read_text())
stop=json.loads((W/'maelstrom-current-main-box-stop-oct26.json').read_text())
assert stop['box']=='bx_h44cmz3t' and stop['status']=='completed' and stop['stopId']=='stop_74f2dddfc9ab9b73'
remote=json.loads((O/'remote-final.json').read_text())
extra=json.loads((O/'remote-process-artifacts.json').read_text())
assert remote['allocated']==10985472 and extra['allocated']==8192
ids=['01a17760-c040-73e1-97d8-0224b44ae0b9','01a1777d-8472-7cd0-a309-19869f365fdd']
sessions={i:list((C/'sessions/2026/10/26').glob('*'+i+'.jsonl')) for i in ids}
assert all(len(v)==1 for v in sessions.values()),sessions
charges=dict(ownedIncludingDirsAndSymlinks=size(O.parent),oldLauncher=size(W/old),newLauncher=size(W/new),oldSession=sum(alloc(p) for p in sessions[ids[0]]),newSession=sum(alloc(p) for p in sessions[ids[1]]),positiveDB=sum(max(0,pathlib.Path(p).stat().st_size-v) for p,v in base.items()),WALSHMOnce=sum(alloc(p) for p in C.glob('*.sqlite-*')),remoteRetained=remote['allocated'],remoteCommandArtifactsRetained=extra['allocated'],futureGitPublicationAndSessionOnce=2*1048576,reserve=8*1048576)
peak=sum(charges.values())
mem=int(next(l.split()[1] for l in open('/proc/meminfo') if l.startswith('MemAvailable')))*1024
free=shutil.disk_usage(O).free
j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,allocationRemaining=67108864-peak,memAvailable=mem,client=536870912,gitDATA=536870912,helper=16777216,minimumRemaining=805306368,ramRequired=1895825408,diskFree=free,diskFloor=2982150144,boxState='STOPPED; historical retained charges only; no remote calls',stopReceipt=str(W/'maelstrom-current-main-box-stop-oct26.json'),stopId=stop['stopId'],baseline=str(O/'db-baseline.json'),accounting='lstat all owned metadata; both launchers/sessions; positive shared DB growth plus WAL/SHM once; future once; reserve once',passChecks=peak<=67108864 and mem>=1895825408 and free-charges['futureGitPublicationAndSessionOnce']-charges['reserve']>=2982150144)
(O/'resource-final-prepublication.json').write_text(json.dumps(j,indent=2))
print(json.dumps(j))
assert j['passChecks'],'Fresh publication admission failed; no unchanged retry'

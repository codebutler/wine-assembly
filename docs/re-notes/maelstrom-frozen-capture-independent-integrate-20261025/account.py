import pathlib,json,shutil,re,sys,time
H=pathlib.Path(__file__).resolve().parent.parent; O=H/'ops'; C=pathlib.Path('/home/user/.codex')
session=C/'sessions/2026/10/25/rollout-2026-10-25T00-52-30-01a1708b-76f5-7a20-b1b8-375adb6fbd0b.jsonl'
launcher=pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-frozen-capture-independent-integrate-oct25')
def size(p):
 if p.is_dir():return sum(size(x) for x in p.iterdir() if not x.is_symlink())
 s=p.stat();return max(s.st_size,s.st_blocks*512)
def account(stage):
 b=O/'sqlite-baseline.json'
 if not b.exists():b.write_text(json.dumps({str(p):size(p) for p in C.glob('*.sqlite*') if p.is_file()},indent=2))
 base=json.loads(b.read_text())
 charges=dict(owned=size(H),fullSession=size(session),fullLauncher=size(launcher),positiveSQLite=sum(max(0,size(p)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),checkoutGitStagingPublicationFuture=12*1048576,externalFuture=8*1048576,sqliteFuture=4*1048576,reserve=8*1048576)
 peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
 j=dict(stage=stage,at=time.time(),charges=charges,projectedPeak=peak,cap=67108864,free=free,freeAfterProjectedGrowth=free-peak,memAvailable=mem,passAdmission=peak<=67108864 and free-peak>=2982150144 and mem>=805306368,limits=dict(perFile=25165824,narrowCapture=2097152,instructionRead=65536,codeRead=8192,nodeHeapMiB=256,cpuWallSeconds=60,outputBytes=131072))
 (O/('resource-'+stage+'.json')).write_text(json.dumps(j,indent=2)+'\n');assert j['passAdmission'],j;return j
if __name__=='__main__':print(json.dumps(account(sys.argv[1])))

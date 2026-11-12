import pathlib,json,shutil,re,time,sys
H=pathlib.Path(__file__).resolve().parent.parent;O=H/'ops';C=pathlib.Path('/home/user/.codex')
def size(p):return sum(max(f.stat().st_size,f.stat().st_blocks*512) for f in p.rglob('*') if f.is_file()) if p.is_dir() else max(p.stat().st_size,p.stat().st_blocks*512)
def account(stage):
 a=json.load(open(O/'resource-precheckout.json'));base=json.load(open(O/'sqlite-baseline.json'));m=json.load(open(H/'manifest.json'))
 charges=dict(localOwned=size(H),fullSession=size(pathlib.Path(a['session'])),fullLauncher=size(pathlib.Path(a['launcher'])),sqlitePositive=sum(max(0,max(p.stat().st_size,p.stat().st_blocks*512)-base.get(str(p),0)) for p in C.glob('*.sqlite*') if p.is_file()),remoteClosure=sum(max(4096,((x['bytes']+4095)//4096)*4096) for x in m),remoteHelpersEvidence=1000000,transferOverlap=1000000,publicationFuture=2000000,externalFuture=4000000,sqliteFuture=2000000,reserve=8388608)
 peak=sum(charges.values());free=shutil.disk_usage(H).free;mem=int(re.search(r'MemAvailable:\s+(\d+)',pathlib.Path('/proc/meminfo').read_text())[1])*1024
 j=dict(at=time.time(),charges=charges,peak=peak,cap=67108864,free=free,afterProjection=free-peak,memAvailable=mem,passAdmission=peak<=67108864 and free-peak>=2982150144 and mem>=805306368)
 (O/('resource-'+stage+'.json')).write_text(json.dumps(j,indent=2)+'\n');assert j['passAdmission'],j;return j
if __name__=='__main__':print(json.dumps(account(sys.argv[1])))

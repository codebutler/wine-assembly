import pathlib,json,os,time
O=pathlib.Path(__file__).resolve().parent;H=O.parent
def account(name):
 initial=json.loads((O/'resource-precheckout.json').read_text());parts={}
 files=[p for p in H.rglob('*') if p.is_file()]
 parts['allTaskCheckoutGitStagingTempEvidence']=sum(p.stat().st_blocks*512 for p in files)
 parts['fullExternalLauncherLogs']=sum(p.stat().st_blocks*512 for p in pathlib.Path(initial['launcher']).rglob('*') if p.is_file())
 parts['fullExternalSessionLog']=pathlib.Path(initial['session']).stat().st_blocks*512
 sql={str(p):p.stat().st_blocks*512 for p in pathlib.Path('/home/user/.codex').glob('state_5.sqlite*')}
 parts['positiveSQLiteGrowth']=sum(max(0,v-initial['sqliteBaseline'].get(p,0)) for p,v in sql.items())
 parts['preCheckpointSQLiteAllowance']=1<<20
 parts['futureGrowthAllowance']=8<<20
 parts['publicationTransferAllowance']=4<<20
 parts['reserve']=8<<20
 peak=sum(parts.values());free=os.statvfs(H).f_bavail*os.statvfs(H).f_frsize
 remaining=sum(parts[k] for k in ['futureGrowthAllowance','publicationTransferAllowance','reserve','preCheckpointSQLiteAllowance'])
 mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable:')))*1024
 largest=max((p.stat().st_size,str(p)) for p in files)
 captures=[p for p in files if p.suffix=='.log']
 j=dict(at=time.time(),parts=parts,projectedPeak=peak,allocation=64<<20,free=free,freeAfterProjectedRemaining=free-remaining,memAvailable=mem,sqliteCurrent=sql,largestFile=largest,largestNarrowCapture=max(p.stat().st_size for p in captures),standingReadonly='standing-inputs.json: read in place, installed tools not copied; flattened dependency-first readonly Git alternates',passChecks=peak<=64<<20 and free-remaining>=2982150144 and mem>=805306368 and largest[0]<=24<<20 and all(p.stat().st_size<=2<<20 for p in captures))
 (O/('resource-'+name+'.json')).write_text(json.dumps(j,indent=2)+'\n');assert j['passChecks'];return j
if __name__=='__main__':print(json.dumps(account(os.sys.argv[1])))

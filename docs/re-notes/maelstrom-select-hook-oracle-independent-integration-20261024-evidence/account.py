import pathlib,json,os,time,sys,hashlib,shutil
root=pathlib.Path(__file__).parent.parent;ops=root/'ops';h=pathlib.Path('/home/user/.codex')
def manifest(paths):
 seen=set();out=[]
 for p in paths:
  if not p.is_file() or p.is_symlink(): continue
  s=p.stat();key=(s.st_dev,s.st_ino)
  if key in seen:continue
  seen.add(key);out.append({'path':str(p),'bytes':s.st_size,'allocated':s.st_blocks*512})
 return out
def total(items):return sum(max(p['bytes'],p['allocated']) for p in items)
initial=json.loads((ops/'admission.json').read_text());baseline=json.loads((ops/'sqlite-baseline.json').read_text())
owned=manifest(root.rglob('*'));launcher=manifest(pathlib.Path('/home/user/wine-assembly/scratch/usage-watch/maelstrom-select-hook-oracle-independent-integrate-oct24').rglob('*'))
session=manifest(pathlib.Path(p) for p in initial['sessions']);wal=manifest(h.glob('*.sqlite-wal'))
growth=sum(max(0,pathlib.Path(p).stat().st_size-size) for p,size in baseline.items())
charges={'owned':total(owned),'externalLauncher':total(launcher),'session':total(session),'fullWAL':total(wal),'positiveSQLite':growth,'rootBoardGrowthAllowance':4096,'futureCheckoutGit':4194304,'futureOpsEvidence':2097152,'futurePublicationTransitiveGit':4194304,'futureSessionLauncherDB':10485760,'reserve':8388608}
future=sum(v for k,v in charges.items() if k.startswith('future') or k=='reserve');free=os.statvfs('/tmp').f_bavail*os.statvfs('/tmp').f_frsize
mem=int(next(x.split()[1] for x in open('/proc/meminfo') if x.startswith('MemAvailable')))*1024
tools=[]
for name in ['node','git','python3','ssh']:
 p=pathlib.Path(shutil.which(name)).resolve();s=p.stat();tools.append({'name':name,'path':str(p),'bytes':s.st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'newBytes':0})
peak=sum(charges.values());verdict='PASS' if peak<=67108864 and free-future>=2982150144 and mem>=805306368 else 'FAIL'
d={'at':time.time(),'charges':charges,'peak':peak,'cap':67108864,'free':free,'afterProjection':free-future,'memAvailable':mem,'verdict':verdict,'manifest':{'owned':owned,'launcher':launcher,'session':session,'wal':wal},'toolsStandingReadonly':tools,'standingDonor':'Reuse verified checkout.json + independent donor standing-object-stores.json; no new copies; dependency-first alternates','limits':initial['limits'],'qualification':initial['preAdmission']}
(ops/(sys.argv[1] if len(sys.argv)>1 else 'resource-current.json')).write_text(json.dumps(d,indent=2));print(json.dumps({k:d[k] for k in ['charges','peak','afterProjection','memAvailable','verdict']}));assert verdict=='PASS'

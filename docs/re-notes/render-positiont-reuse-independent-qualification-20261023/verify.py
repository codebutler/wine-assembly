"""Read-only final verification; never invokes native or compiler paths."""
import hashlib,json,pathlib,subprocess
E=pathlib.Path(__file__).resolve().parent;R=E.parents[2]
def sha(b):return hashlib.sha256(b).hexdigest()
def git(*a):return subprocess.check_output(['git','-C',str(R),*a],timeout=30)
records=json.loads((E/'source-manifest.json').read_text())
assert len(records)==290 and sum(r['pin'] for r in records)==286
for r in records:
 p=R/r['path'];b=p.read_bytes()
 assert sha(b)==r['sha256'] and len(b)==r['bytes']
 assert p.stat().st_mode&0o777==int(r['mode'][-3:],8)
 assert git('show','c9a59870ff46416653d0782ebfc296df1bb0ae59:'+r['path'])==b
for a in json.loads((E/'standing.json').read_text())['artifacts']:
 assert sha(pathlib.Path(a['path']).read_bytes())==a['sha256']
assert json.loads((E/'independent-review.json').read_text())['verdict']=='ACCEPT_FIXTURE'
checks={};captured=0
for mode in ['baseline','disable-shared-route','alias-queued-bytes','corrupt-queued-ir']:
 result=json.loads((E/(mode+'.json')).read_text());log=(E/(mode+'.log')).read_text()
 assert result['exit']==(0 if mode=='baseline' else 1)
 assert result['failure'] is None and result['groupReaped'] and not result['adoptedReaped']
 attempt=json.loads((E/(mode+'-attempt.json')).read_text())
 assert attempt['MemAvailable']>=1610612736 and attempt['totalWithFutureAndReserve']<=67108864
 assert attempt['hostAfterGrowth']>=2982150144
 oracle='PASS full COM/native allocator fixture' if mode=='baseline' else ('DP-start2-offset16-stride48: actual shared native IR selection' if mode=='disable-shared-route' else 'queue bytes survive caller mutation and real heap reuse: complete BGRA/depth oracle')
 assert oracle in log
 if mode!='baseline':assert 'ARMED negative control '+mode in log and 'AssertionError [ERR_ASSERTION]' in log
 captured+=result['capturedBytes']
 checks[mode]=dict(exit=result['exit'],intendedOracle=oracle,logSha256=sha(log.encode()),peakChildRssBytes=result['peakChildRssBytes'],MemAvailable=attempt['MemAvailable'])
assert captured<=524288
base='c9a59870ff46416653d0782ebfc296df1bb0ae59'
if git('rev-parse','HEAD').decode().strip()!=base:
 changed=git('diff','--name-only',base,'HEAD').decode().splitlines()
 assert all(p.startswith('docs/re-notes/render-positiont-reuse-independent-qualification-20261023') for p in changed)
out=dict(verdict='PASS',closureFiles=290,pins=286,allModesAndBytesUnchanged=True,artifactsUnchanged=True,allGroupsReaped=True,heavyReleased=True,capturedBytes=captured,commands=checks)
(E/'verification.json').write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out))

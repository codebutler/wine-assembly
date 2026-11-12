import pathlib,json,hashlib,subprocess,os,signal,time
from account import account
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo'
E=R/'docs/re-notes/maelstrom-native-errno-source-snapshot-repair-20261025'
def load(p):return json.loads((O/p).read_text())
def save(p,x):p.write_text(json.dumps(x,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for n in ['supplied','independent','snapshot-final','repair-repro']:
 assert load(n+'.json')['passChecks']
for n in ['baseline-repro','reject-repeated-read','reject-stale-token','reject-after-dispatch','reject-unsafe-span','reject-result-as-errno']:
 j=load(n+'.json');assert j['returncode']==1 and j['reaped'] and not j['capped'] and not j['timedOut']
 assert 'AssertionError' in (O/(n+'.log')).read_text()
assert load('baseline/pin-repro-results.json')['defect']
assert not load('repair/pin-repro-results.json')['defect']
assert load('repair/pin-repro-results.json')['getterReads']==1
assert '"groups":13' in (O/'supplied.log').read_text()
assert load('repair/independent-results.json')['groups']==9
assert '6 source snapshot groups passed' in (O/'snapshot-final.log').read_text()
assert '57f724a066a2c77502330835d2a6b625102a571c5ab2eebdc592fd0bd59e9a50' in (O/'reject-repeated-read.log').read_text()
review=pathlib.Path('/tmp/maelstrom-native-errno-independent-integrate-oct25/repo/docs/re-notes/maelstrom-native-errno-independent-integrate-20261025')
for stage in ['baseline','repair']:
 for n in ['pin-repro.cjs','independent.cjs']:assert (O/stage/n).read_bytes()==(review/n).read_bytes()
before=load('readonly-state.json');after={}
for p,state in before.items():
 after[p]={}
 for k,args in {'HEAD':['rev-parse','HEAD'],'refs':['show-ref'],'index':['hash-object','.git/index'],'trackedDiffSHA256':['diff','--no-ext-diff','--binary','HEAD']}.items():
  value=subprocess.check_output(['git']+args,cwd=p,text=True).strip()
  after[p][k]=hashlib.sha256(value.encode()).hexdigest() if k=='trackedDiffSHA256' else value
 assert state==after[p],p
save(O/'readonly-final.json',dict(passChecks=True,states=after))
watch=load('watcher.json');start=time.monotonic();os.killpg(watch['pgid'],signal.SIGTERM)
# Reparented tail may briefly remain a zombie; no live process/group may remain.
deadline=start+5
while time.monotonic()<deadline:
 p=pathlib.Path('/proc')/str(watch['pid'])/'stat'
 if not p.exists() or p.read_text().split()[2]=='Z':break
 time.sleep(.03)
else:raise RuntimeError('watcher not reaped within 5s')
save(O/'cleanup.json',dict(watcherPid=watch['pid'],watcherLive=False,elapsed=time.monotonic()-start,guardedChildrenReaped=True,builds=0,instantiations=0,nativeExecutions=0,originalGuests=0,workers=0,boxesAssigned=[],boxOperations=0,boxStates={'bx_g84h8h98':'coordinator-reported stopped/unqueried','hostbx_69aem736':'untouched'},shutdownOwner='coordinator',rootDonorReadonlyVerified=True))
controls=[]
for m in ['stale-token','after-dispatch','unsafe-span','result-as-errno','repeated-read']:
 controls.append(dict(mutation=m,actuallyRejected=True,receipt='reject-'+m+'.json',diagnostic=(O/('reject-'+m+'.log')).read_text()))
save(O/'controls.json',dict(passChecks=True,controls=controls))
save(O/'acceptance.json',dict(passChecks=True,suppliedGroups=13,independentGroups=9,snapshotGroups=6,brokenOutputControls=4,repeatedReadControlRejected=True,unchangedReproducerSHA256=sha(O/'repair/pin-repro.cjs'),baselineReproducerExit=1,baselineDefect=True,repairReproducerExit=0,repairDefect=False,toolSHA256=sha(R/'tools/maelstrom-native-errno-latch.cjs'),regressionSHA256=sha(R/'test/maelstrom-native-errno-source-snapshot.test.cjs'),sourceIdentity='source-identity-verified.json',nativeErrno='UNKNOWN',nativeCaller='UNKNOWN',gameplay='UNKNOWN'))
account('before-evidence')
E.mkdir(parents=True)
names=['setup.py','account.py','guard.py','prepare.py','repeated-read-control.cjs','standing-inputs.json','source-identity-verified.json','configuration.json','checkout.json','resource-precheckout.json','resource-prepublication.json','resource-before-evidence.json','readonly-state.json','readonly-final.json','cleanup.json','controls.json','acceptance.json']
names+=['baseline/pin-repro.cjs','baseline/pin-repro-results.json','repair/pin-repro.cjs','repair/pin-repro-results.json','repair/independent.cjs','repair/independent-results.json']
for n in ['baseline-repro','repair-repro','supplied','independent','snapshot-final','reject-repeated-read','reject-stale-token','reject-after-dispatch','reject-unsafe-span','reject-result-as-errno']:
 names.extend([n+'.json',n+'.log'])
for n in names:
 p=E/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes((O/n).read_bytes())
files=[dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=sha(p)) for p in sorted(E.rglob('*')) if p.is_file()]
save(E/'manifest.json',dict(evidence=files,implementation=dict(path='tools/maelstrom-native-errno-latch.cjs',sha256=sha(R/'tools/maelstrom-native-errno-latch.cjs')),regression=dict(path='test/maelstrom-native-errno-source-snapshot.test.cjs',sha256=sha(R/'test/maelstrom-native-errno-source-snapshot.test.cjs'))))
print(json.dumps(dict(passChecks=True,evidenceFiles=len(files),cleanup=load('cleanup.json'))))

import pathlib,json,hashlib,subprocess
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';D=pathlib.Path('/tmp/maelstrom-native-errno-source-snapshot-repair-oct25/repo');P=D.parent/'ops'
C='1a87b46728222df4df0b1fee33f83e88776735a9';B='4542e115ac2b1e0cca6748bd00cdce2b4f781199'
def blob(rev,p):return subprocess.check_output(['git','show',rev+':'+p],cwd=R)
def sha(b):return hashlib.sha256(b).hexdigest()
def load(p):return json.loads(p.read_text())
tool='tools/maelstrom-native-errno-latch.cjs'
old=blob(B,tool).decode();new=blob(C,tool).decode()
before="    if (typeof sources[p] !== 'string' || sha(sources[p]) !== pin) throw Error('source pin: ' + p);\n    input[p] = sources[p];"
after="    // Read once: accessors/proxies may return a different value on every read.\n    // Validate and compose precisely this captured, immutable string.\n    const source = sources[p];\n    if (typeof source !== 'string' || sha(source) !== pin) throw Error('source pin: ' + p);\n    input[p] = source;"
assert old.count(before)==1 and old.replace(before,after)==new
assert (R/tool).read_bytes()==blob(C,tool)
paths=['tools/maelstrom-select-completion-hook.cjs','test/maelstrom-native-errno-latch.test.cjs','test/maelstrom-select-hook-model.cjs','docs/re-notes/maelstrom-native-errno-successor-latch-20261025/source-identity.json']
for p in paths:assert blob(B,p)==blob(C,p)==(R/p).read_bytes()
assert sha((O/'repair/pin-repro.cjs').read_bytes())=='83376305f77386948a2f9bcc22f2df6dbbb111db1ef7473e39a6c7f1e22c1ac5'
assert (O/'repair/pin-repro.cjs').read_bytes()==(O/'baseline/pin-repro.cjs').read_bytes()
assert load(O/'baseline/pin-repro-results.json')['defect'] and load(O/'baseline/pin-repro-results.json')['getterReads']==3
assert not load(O/'repair/pin-repro-results.json')['defect'] and load(O/'repair/pin-repro-results.json')['getterReads']==1
for n in ['snapshot','independent','repair-repro']:assert load(O/(n+'.json'))['passChecks']
for n in ['baseline-repro','reject-repeat-read']:
 j=load(O/(n+'.json'));assert j['returncode']==1 and j['reaped'] and not j['timedOut'] and not j['capped'];assert 'AssertionError' in (O/(n+'.log')).read_text()
retained={}
e='docs/re-notes/maelstrom-native-errno-source-snapshot-repair-20261025/'
for n in ['supplied','independent','reject-stale-token','reject-after-dispatch','reject-unsafe-span','reject-result-as-errno']:
 for ext in ['json','log']:
  p=e+n+'.'+ext;b=blob(C,p);assert b==(P/(n+'.'+ext)).read_bytes();retained[p]=sha(b)
 j=load(P/(n+'.json'));assert j['reaped'] and not j['timedOut'] and not j['capped']
 if n.startswith('reject-'):assert j['returncode']==1 and 'AssertionError' in (P/(n+'.log')).read_text()
 else:assert j['passChecks']
assert load(P/'repair/independent-results.json')['groups']==9
assert '"groups":13' in (P/'supplied.log').read_text()
p=e+'repair/independent.cjs';assert blob(C,p)==blob('07dec4e6ff92356a896d2868aaa7e9a5b4b0c98d','docs/re-notes/maelstrom-native-errno-independent-integrate-20261025/independent.cjs')
pins=load(R/'docs/re-notes/maelstrom-native-errno-successor-latch-20261025/source-identity.json')
for p,v in pins['sourceFiles'].items():
 b=(pathlib.Path(pins['sourceRoot'])/p).read_bytes();assert len(b)==v['bytes'] and sha(b)==v['sha256']
ind=json.loads((O/'independent.log').read_text().splitlines()[-1])
for p,v in pins['generatedFragments'].items():assert ind['outputHashes']['src/'+p]==v['sha256']
j=dict(verdict='ACCEPT_SCOPED_SOURCE_MODEL',candidate=C,candidateTree=subprocess.check_output(['git','rev-parse',C+'^{tree}'],cwd=R,text=True).strip(),repairOnlyExactReplacement=True,sourcePins=12,sourceReadsPerPath=1,newIndependentGroups=8,snapshotGroups=6,reusedSuppliedGroups=13,reusedIndependentGroups=9,reusedActuallyRejectingOutputControls=4,newRepeatedReadControlActuallyRejected=True,retainedEvidence=retained,unchangedSemantics=paths,outputHashes=ind['outputHashes'],nativeErrno='UNKNOWN',nativeCaller='UNKNOWN',gameplay='UNKNOWN')
(O/'acceptance.json').write_text(json.dumps(j,indent=2)+'\n');print(json.dumps({k:v for k,v in j.items() if k not in ['retainedEvidence','outputHashes','unchangedSemantics']}))

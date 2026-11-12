import pathlib, subprocess, json, hashlib, datetime, os, resource
P=pathlib.Path(__file__).parent
R=P/'repo'
C='3509517e9d3eb999dc2190ccc0168f96a8bffe2e'
B='979042c93eec78095d0e4ee078d4efb25a55a5ff'
O='ce17debea05b1e40c2359a25cf1d3d2c41266649'
S='b41a7c5f4b752d1f0bdab1141a11d4fed4dc6f9a'
E='docs/re-notes/madbomber-sdl-consumer-independent-qualification-20261024'
PE='docs/re-notes/madbomber-authentic-sdl-error-consumer-20261024'
sha=lambda b:hashlib.sha256(b).hexdigest()
def git(*args):
 r=subprocess.run(['git','-C',str(R),*args],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 f=P/'git-alternate.stderr'
 with f.open('ab') as out:out.write(r.stderr[:max(0,262144-f.stat().st_size)])
 assert r.returncode==0,(args,r.returncode)
 return r.stdout
def blob(rev,p):return git('show',rev+':'+os.path.normpath(p))
def evidence(n):return blob(C,E+'/'+n)
def doc(n):return json.loads(evidence(n))
paths=json.loads((P/'candidate-paths.json').read_text())
actual=git('diff','--name-only',B,C).decode().splitlines()
assert actual==paths
identities=[]
for p in paths:
 b=blob(C,p)
 local=pathlib.Path('/tmp/madbomber-sdl-consumer-independent-qualification-oct24/repo')/p
 assert b==local.read_bytes(),p
 identities.append({'path':p,'gitBlob':git('rev-parse',C+':'+p).decode().strip(),'bytes':len(b),'sha256':sha(b)})
counts={}
for revision,directory,seal in [(O,PE,'seals.json'),(C,E,'seals.json'),(C,E,'closeout-seals.json')]:
 rows=json.loads(blob(revision,directory+'/'+seal))['files']
 for row in rows:
  b=blob(revision,directory+'/'+row['path'])
  assert len(b)==row['bytes'] and sha(b)==row['sha256'],(seal,row['path'])
 counts[revision+':'+seal]=len(rows)
binding=evidence('source-binding.json'); assert sha(binding)=='c8c7f3e6a80aaa41255c6a4e952dc442b795d5f6b8caac109791d0f603b910a0'
binding=json.loads(binding);assert binding['source']==S
for row in binding['closure']:
 b=blob(S,row['path']);assert len(b)==row['bytes'] and sha(b)==row['sha256'],row['path']
api=blob(S,'src/api_table.json');assert sha(api)==doc('api-pin.json')['sha256']
assert json.loads(api)[4590]['name']=='waveOutGetErrorTextA'
for excerpt,source in [('GetProcAddress.wat.txt','src/09a0-handlers-base.wat'),('call-func.wat.txt','src/13-exports.wat')]:
 assert evidence(excerpt) in blob(S,source),excerpt
fixture=blob(C,'test/test-madbomber-sdl-error-consumer-candidate.js')
original=blob(O,'test/test-madbomber-sdl-error-consumer-candidate.js')
old=b"  assert.equal(dv.getUint32(wa(base + 0x2324c), true), wave, 'authentic resolved consumer IAT');"
start=fixture.index(b'  // Packed SDL and this lookup receive distinct records for the same API.')
end=fixture.index(b'  const getError =',start)
assert original.count(old)==1
assert fixture==original.replace(old+b'\n',fixture[start:end]).replace(b"waveIATRVA: '2324c', calls, results",b"waveIATRVA: '2324c', thunkIdentity, calls, results")
check=doc('closeout-check.json')
assert sha(fixture)==check['fixtureSHA256']
assert sha(blob(C,'test/system-thunk-identity.js'))==check['helperSHA256']
assert sha(evidence('supervise.py'))==check['supervisorSHA256']
assert evidence('supervise.py')==blob(O,PE+'/supervise.py')
assert sha(evidence('consumer-repaired.json'))==check['baselineReceiptSHA256']
assert sha(evidence('consumer-repaired.stdout'))==check['baselineOutputSHA256']
baseline=doc('consumer-repaired.json');negative=doc('closeout-reject-output.json')
assert baseline['exit']==0 and negative['exit']==1
assert negative['argv']==baseline['argv']+['--reject-output']
for r in [baseline,negative]:
 assert r['reason'] is None and r['reaped'] and not r['remainingGroup']
 assert r['MemAvailable']>=r['memoryFloor'] and r['combinedOutputBytes']<=r['combinedOutputLimit']
 assert r['wallSeconds']<=60 and r['childCPUSeconds']<=90
stderr=evidence('closeout-reject-output.stderr').decode()
assert stderr.startswith('AssertionError [ERR_ASSERTION]: original SDL consumer output oracle\n')
assert "actual: 'waveOutOpen(): The audio format is not supported.'" in stderr
assert "expected: 'waveOutOpen(): The audio format is not SUPPORTED.'" in stderr
assert not evidence('closeout-reject-output.stdout') and not evidence('consumer-repaired.stderr')
out=doc('consumer-repaired.stdout')
assert out['source']==S and out['module']==binding['moduleSHA256']
assert out['terminalEIP']==0 and out['yield']==0
assert [r['winmmCapacity'] for r in out['results']]==[241,232]
for r in out['results']:assert r['output']==r['label']+': The audio format is not supported.'
assert len(out['thunkIdentity'])==2
for r in out['thunkIdentity']:assert r['apiId']==4590 and r['name']=='waveOutGetErrorTextA'
for n in ['closeout-resource-precontrol.json','closeout-resource-prepublication.json']:
 r=doc(n);assert r['verdict']=='PASS' and r['projectedPeak']<=67108864 and r['hostAfterIncrement']>=2982150144
 assert r['allowance']['reserve']==8388608
externalInputs=[]
for path,size,digest in [(binding['module'],1879746,'8fac39936b6df2418ad86cab118cef19a65a727f649fbc14c412b37818904686'),('/home/user/wine-assembly/scratch/runs/20261018-madbomber-source/original/madbomber-0.2.5/SDL.dll',86016,'55eced17cf8a9b7acc671cc307503de847a3c36fdafafe14cee7917433cfe410')]:
 b=pathlib.Path(path).read_bytes();assert len(b)==size and sha(b)==digest
 externalInputs.append({'path':path,'bytes':size,'sha256':digest,'readonly':True})
for n in ['producer-identify-denial.json','capacity-reject-output.json','historical-ops-result.json','consumer.stderr','recover-qualification.py']:
 assert evidence(n)
cleanup=json.loads(pathlib.Path('/tmp/madbomber-sdl-consumer-independent-qualification-oct24/closeout-cleanup.json').read_text())
assert cleanup['watcherStopped'] and cleanup['childrenStopped']
assert all(r['groupAbsent'] and r['reaped'] for r in cleanup['groups'])
result={'verdict':'ACCEPT scoped fixture and retained historical internal-consumer evidence','candidate':C,'base':B,'originalProducer':O,'historicalSource':S,'sealsVerified':counts,'publishedBlobs':identities,'closureFiles':len(binding['closure']),'closureBytes':sum(r['bytes'] for r in binding['closure']),'externalReadonlyInputs':externalInputs,'fixtureSHA256':sha(fixture),'baselineReplayed':False,'negativeReplayed':False,'sourceBindingSHA256':sha(evidence('source-binding.json')),'baselineExit':0,'negativeExit':1,'nativeAssertions':'original output, full consumer bytes, local text/NUL/trailing canaries, caller MMRESULT, return sentinel, ESP/EIP/yield unchanged','historicalCleanup':cleanup,'mount':{'argv':[],'intendedFiles':doc('producer-input-map.json')['files'],'parser':'inapplicable: no guest or mount execution'},'limitations':['historical source/module only; no current-main runtime semantics','internal RVA cff0; no public SDL_OpenAudio or real waveOutOpen failure','no build, native replay, gameplay, listening, guest, browser or box'], 'time':datetime.datetime.now(datetime.timezone.utc).isoformat()}
(P/'review.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['verdict','sealsVerified','closureFiles','closureBytes','baselineExit','negativeExit']}))

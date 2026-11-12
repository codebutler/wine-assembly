import control as c,pathlib,json,hashlib,tarfile,datetime,re
O=c.O;P=pathlib.Path('/tmp/tuxracer-vertex-color-isolated-capture-runtime-oct30');G=pathlib.Path('/tmp/tuxracer-vertex-color-gameplay-owner-policy-oct30')
def seal(p):return dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
for x in json.loads((P/'capture-manifest.json').read_text()):assert seal(P/'capture'/x['path'])==dict(bytes=x['bytes'],sha256=x['sha256'])
manifest=json.loads((P/'source-manifest.json').read_text());rows=manifest['inputs'];assert len(rows)==141
data={}
for p in [c.OLD/'candidate.tar.gz',G/'candidate-delta.tar.gz']:
 with tarfile.open(p) as t:
  for m in t.getmembers():
   if m.name in rows:data[m.name]=t.extractfile(m).read()
for n,x in rows.items():assert len(data[n])==x['bytes'] and hashlib.sha256(data[n]).hexdigest()==x['sha256'],n
seen=set()
def walk(n):
 if n in seen:return
 seen.add(n)
 for name in re.findall(r'\(include\s+"([^"]+)"\)',data[n].decode()):walk(str(pathlib.PurePosixPath(n).parent/name))
walk('src/main.watx');assert len(seen)==128
for p in ['compile','runtime','startup']:
 x=json.loads((P/'capture'/(p+'.json')).read_text());assert x['exit']==0 and x['denial'] is None
 for name,expected in x['logs'].items():assert seal(P/'capture'/name)=={k:expected[k] for k in ['bytes','sha256']}
runtime=json.loads((P/'capture/runtime.json').read_text());s=(P/'capture/runtime.stdout').read_text()
assert 'batch=21787' in s and 'presents=3' in s and 'stopping after 45s at batch 31259' in s
assert json.loads((P/'snapshot-stop-proof.json').read_text())['verifiedStopped']
reused=json.loads((P/'reused-limit-controls.json').read_text());assert seal(pathlib.Path(reused['path']))['sha256']==reused['sha256']
accept=c.R/'reconciliation-coordinator-completion.json';r=json.loads(accept.read_text())
for n,x in r['evidence'].items():assert seal(c.R/'reconciliation-continuation-evidence'/n)==x
events=c.ROOT/'scratch/usage-watch/tuxracer-vertex-color-isolated-capture-runtime-oct30/events.jsonl'
provider=[]
for line in events.open():
 if any(w in line.lower() for w in ['atcapacity','at capacity','capacity','overloaded']):provider.append(line[:2000])
c.save('retained-evidence-verification.json',dict(PASS=True,sourceManifest=seal(P/'source-manifest.json'),inputs=141,canonicalInputs=128,captures={x.name:seal(x) for x in (P/'capture').iterdir()},sourceAcceptance=seal(accept),acceptanceEvidenceVerified=len(r['evidence']),mountReceipt=seal(P/'reused-mount-receipt.json'),providerEvents=seal(events),providerMessages=provider,originalDenialPreserved=True,operationDenial=seal(O/'first-operation-denial.json'),imagesInspected=True,imageOutcome='Title screen -> main menu (Enter an event, Practice, Credits, Quit)',limitations=['No race movement or gameplay acceptance','GL census aggregates packed draws and does not prove an individual glVertex2dv invocation','Runtime uses historical host898d2ec8 separately from module candidatea998bf36','No build/guest replay in this task']))
print('RETAINED CAPTURES, 141 INPUTS, 128 CANONICAL SOURCES, ACCEPTANCE AND LIFECYCLE HASHES PASS')

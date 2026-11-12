import pathlib,hashlib,json,tarfile,subprocess
E=pathlib.Path(__file__).resolve().parent;W=E.parents[2]
sha=lambda b:hashlib.sha256(b).hexdigest()
archive=E/'evidence.tar.gz'
assert sha(archive.read_bytes())=='7bcc5c85dc733fb4c085e5fb45bc311fd75d567a2f620b07851d63282659bdd1'
matched=0
with tarfile.open(archive) as t:
 members={m.name:m for m in t.getmembers() if m.isfile()}
 for p in (E/'raw').rglob('*'):
  if p.is_file():assert p.read_bytes()==t.extractfile(members[str(p.relative_to(E/'raw'))]).read();matched+=1
 for p in (E/'captures').glob('*.png'):
  rel=('first-run/' if p.name=='startup.png' else 'run/')+p.name
  assert p.read_bytes()==t.extractfile(members[rel]).read();matched+=1
 for name in ['software-gate-samples.json','software-measurement-samples.json']:
  assert (E/name).read_bytes()==t.extractfile(members['run/'+name]).read();matched+=1
identity=json.loads((E/'raw/run/identity.json').read_text())
assert identity['commit']=='c26252c4a95babe583ade1d1c6e2da0c050be45c'
assert identity['wasmSha256']=='f644bbb26edc077239dac17b8b2cfda482aafd9eb44af4c4776d4fe153d5a1a7'
assert identity['servedModuleHashes'] and set(identity['servedModuleHashes'])=={identity['wasmSha256']}
assert json.loads((E/'raw/run/errors.json').read_text())==[]
for name in ['software-gate','software-measurement']:
 owner=json.loads((E/f'raw/run/{name}-owner.json').read_text())
 assert owner['appCount']==owner['rendererShared']==1 and owner['hasInstance'] and not owner['guestWorker']
 assert owner['backend']=='software' and owner['gpuFlag']==False and owner['hwnd']==65537
 assert owner['canvas']==dict(width=800,height=600,type='OffscreenCanvas')
 assert set(owner['contextPrototypes'])=={'CanvasRenderingContext2D','OffscreenCanvasRenderingContext2D'}
 r=json.loads((E/(name+'-samples.json')).read_text());s=r['samples'];ev=r['events']
 assert not r['errors'] and len(ev)==r['frames']>0
 assert s[-1]['count']-s[0]['count']==len(ev)
 assert abs((s[-1]['t']-s[0]['t'])/1000-r['seconds'])<1e-9
 assert all(x['valid'] and x['sink']['id']=='screen-present' for x in s)
 assert all(x['sink']['id']=='screen-present' and x['kind']=='completed visible filter.present' and x['copiedAt']<=x['submittedAt'] for x in ev)
 assert all(ev[i]['seq']>ev[i-1]['seq'] and ev[i]['count']==i+1 for i in range(1,len(ev)))
 if name.endswith('measurement'):assert 20<=r['seconds']<=30 and r['frames']==691 and len(s)==27
 else: assert 4<=r['seconds']<=8 and r['frames']==120
 subprocess.run(['node','-e',"const r=require(process.argv[1]);const v=require(process.argv[2]).validateSoftwareSamples(r,Number(process.argv[3]),32);if(!v.ok)throw Error(JSON.stringify(v));",str(E/(name+'-samples.json')),str(W/'tools/arcanum-software-samples.js'),'4' if name.endswith('gate') else '20'],check=True)
handoff=json.loads((E/'raw/handoff.json').read_text());assert handoff['alive']==[] and handoff['pinsVerified']==226 and handoff['dependenciesVerified']==2253
seals=E/'seals.json'
if seals.exists():
 for x in json.loads(seals.read_text()):assert sha((E/x['path']).read_bytes())==x['sha256'],x['path']
print(json.dumps(dict(ok=True,archiveCopiesMatched=matched,rawMeasurementEvents=691,rawSamples=27,shortGateEvents=120,ownerChecks=True,pinsVerified=226,dependencyPinsVerified=2253,archiveSha256=sha(archive.read_bytes()))))

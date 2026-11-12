import pathlib,json,hashlib,subprocess,tarfile
C=pathlib.Path('/home/user/wine-assembly-arcanum-software-frame-measure-oct22')
E=C/'scratch/runs/20261022-arcanum-software-frame-measure'
O=pathlib.Path(__file__).resolve().parent
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda n:json.loads((E/n).read_text())
def git(*args):return subprocess.check_output(['git','-C',str(C),*args])
candidate='ab0f4ec5085382a9ec1721156f127390b8706ea6'
# Verify every on-disk candidate artifact used by the review against its commit.
paths=git('diff-tree','--no-commit-id','--name-only','-r',candidate).decode().splitlines()
for p in paths:assert (C/p).read_bytes()==git('show',candidate+':'+p),p
seals=read('seals.json')
for row in seals:
 b=(E/row['path']).read_bytes();assert sha(b)==row['sha256'],row['path']
replay=subprocess.check_output(['python3',str(E/'verify.py')]).decode()
inv=read('module-inventory.json')
for rev,tree in inv['trees'].items():
 for path,obj in tree.items():assert git('rev-parse',rev+':'+path).decode().strip()==obj
assert len(set(tuple(v.items()) for v in inv['trees'].values()))==1
source=read('source-manifest.json')
for row in source:
 if row['path']=='build/wine-assembly.wasm':continue
 b=git('show',inv['source']+':'+row['path']);assert len(b)==row['size'] and sha(b)==row['sha256'],row['path']
archive=pathlib.Path(inv['archive']);assert sha(archive.read_bytes())==inv['archiveSha256']
with tarfile.open(archive) as t:
 ms=[m for m in t.getmembers() if m.isfile() and m.name.endswith('wine-assembly.wasm')]
 assert ms
 assert any(sha(t.extractfile(m).read())==inv['moduleSha256'] for m in ms)
assets=read('assets.json')['files'];root=pathlib.Path('/home/user/wine-assembly')
for row in assets:
 b=(root/row['path']).read_bytes();assert len(b)==row['size'] and sha(b)==row['sha256'],row['path']
installed=root/'test/binaries/candidates/arcanum-demo/installed'
assert {str(p.relative_to(root)) for p in installed.rglob('*') if p.is_file()}=={r['path'] for r in assets if '/installed/' in r['path']}
manifest=json.loads((root/assets[0]['path']).read_text())
assert {x['url'] for x in manifest['files']} | {'installed/arcanum.exe'} == {str(pathlib.PurePosixPath(x['path']).relative_to('test/binaries/candidates/arcanum-demo')) for x in assets[1:]}
assert len(manifest['files'])==35
gate=read('software-gate-samples.json');r=read('software-measurement-samples.json')
seconds=(r['samples'][-1]['t']-r['samples'][0]['t'])/1000
count=r['samples'][-1]['count']-r['samples'][0]['count']
assert count==len(r['events'])==691 and abs(seconds-25.40109)<1e-9
assert gate['samples'][-1]['t']<r['samples'][0]['t']
commands=read('raw/run/commands.json');measure=[c for c in commands if c['action']=='measure']
assert [c['phase'] for c in measure]==['gate','full']
for q in [gate,r]:
 for x in q['events']:
  assert x['sink']['documentVisibility']=='visible' and x['sink']['visibility']=='visible' and float(x['sink']['opacity'])>0
  assert x['copiedAt']<=x['submittedAt']
first=read('raw/first-run/startup.json')['state'];assert not first['app'] and 'failed to load 5 of 5' in first['log']
tests=[]
for args in [['node','tools/arcanum-presentation-counter.test.js'],['node','tools/arcanum-software-samples.test.js'],['node','--check','tools/arcanum-gameplay-browser.js']]:
 p=subprocess.run(args,cwd=O.parents[2],text=True,capture_output=True);tests.append(dict(command=args,exitCode=p.returncode,stdout=p.stdout,stderr=p.stderr));assert p.returncode==0
result=dict(candidate=candidate,committedArtifacts=len(paths),seals=len(seals),candidateReplay=json.loads(replay),sourcePins=len(source),originalFiles=len(assets)-1,originalBytes=sum(r['size'] for r in assets),gateSeconds=gate['seconds'],gateEvents=len(gate['events']),gatePrecedesMeasurement=True,submissions=count,seconds=seconds,submissionsPerSecond=count/seconds,firstFontFailurePreserved=True,tests=tests)
(O/'checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result,indent=2))

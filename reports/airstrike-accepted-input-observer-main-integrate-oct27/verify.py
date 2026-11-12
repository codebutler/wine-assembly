import pathlib,json,hashlib,sys
O=pathlib.Path(__file__).parent; R=O.parent/'repo'; d=json.loads((O/'readiness.json').read_text())
if sys.argv[1]=='before':
 remote=dict((line.split()[1],line.split()[0]) for line in (O/'remote-initial.stdout').read_text().splitlines())
 assert remote['refs/heads/main']==d['main'],remote
 assert remote['refs/heads/task/airstrike-input-observer-independent-accept-oct27']=='a5db83b10d153b2822ccde106a43107e9432ec33'
 assert (O/'main-dependencies.stdout').read_bytes()==(O/'base-dependencies.stdout').read_bytes()
 changes=[x.split('\t')[1] for x in (O/'accepted-paths.stdout').read_text().splitlines()]
 reports=[p for p in changes if p.startswith('reports/airstrike-input-consumption-observer-implementation-oct27/')]
 assert sorted(p for p in changes if p not in reports)==sorted(d['changedPaths'])
 assert not any((R/p).exists() for p in reports), 'donor reports must remain absent'
 print('PASS exact remote main, accepted ref, four candidate changes and unchanged base/main dependency blobs')
else:
 pins={}
 for p,v in d['sourcePins'].items():
  raw=(R/p).read_bytes(); h=hashlib.sha256(raw).hexdigest()
  assert len(raw)==v['bytes'] and h==v['sha256'],p
  pins[p]=dict(sha256=h,bytes=len(raw),origin=d['candidate'] if p in d['changedPaths'] else d['main'])
 assert sum(v['bytes'] for v in pins.values())+(R/'package.json').stat().st_size<1048576
 pins['package.json']={'sha256':hashlib.sha256((R/'package.json').read_bytes()).hexdigest(),'bytes':(R/'package.json').stat().st_size,'identity':'base/main identical Git blob in dependency receipts'}
 (O/'merged-pins.json').write_text(json.dumps(pins,indent=2)+'\n')
 print('PASS exact four accepted hashes and every dependency; sparse source bytes below 1MiB')

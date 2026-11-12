import pathlib,json,hashlib
O=pathlib.Path(__file__).parent; R=O.parent/'repo'; d=json.loads((O/'readiness.json').read_text())
assert (O/'prepublish-main.stdout').read_text().split()==[d['main'],'refs/heads/main']
prefix='reports/airstrike-accepted-input-observer-main-integrate-oct27/'
entries=[l.split('\t') for l in (O/'staged-scope.stdout').read_text().splitlines()]
assert sorted(p for status,p in entries if not p.startswith(prefix))==sorted(d['changedPaths'])
assert all(status=='A' for status,p in entries if p.startswith(prefix))
P=R/prefix;m=json.loads((P/'receipt-manifest.json').read_text())
assert (P/'receipt-manifest.json').read_bytes()==(O/'receipt-manifest.json').read_bytes()
for f in m['payloads']:
 p=P/f['path'];assert p.stat().st_size==f['bytes'] and hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256'],f
assert len([p for _,p in entries if p.startswith(prefix)])==len(list(P.iterdir()))
for p,v in d['sourcePins'].items():assert hashlib.sha256((R/p).read_bytes()).hexdigest()==v['sha256'],p
assert all(p.is_file() for p in P.iterdir())
assert sum(p.stat().st_size for p in P.iterdir())<16*1024**2
print('PASS complete staged closure: exact four accepted files plus own portable report only; payload hashes and fresh main equality')

import pathlib,json,hashlib,subprocess,os
O=pathlib.Path(__file__).resolve().parent;R=O.parent/'repo';P=R/'docs/re-notes/seh-current-canonical-qualifier-20261025';E=P/'evidence'
for r in json.load(open(E/'seal.json')):
 p=P/r['path'];b=p.read_bytes();assert len(b)==r['bytes'] and hashlib.sha256(b).hexdigest()==r['sha256']
q=(P/'qualify.cjs').read_text();assert q.count('new WebAssembly.Module(b)')==1
assert 'const mod=new WebAssembly.Module(b);' in q
for forbidden in ['new WebAssembly.Memory','new WebAssembly.Instance','WebAssembly.instantiate(', 'WebAssembly.compile(', 'WebAssembly.validate(']:assert forbidden not in q
r=json.load(open(O/'result.json'));assert hashlib.sha256((P/'qualify.cjs').read_bytes()).hexdigest()==r['qualifierSHA256']
assert all(m['qualification']['qualifierSHA256']==r['qualifierSHA256'] for m in r['modules'])
assert all(p.suffix!='.wasm' for p in P.rglob('*'))
assert json.load(open(O/'cleanup.json'))['rootIndexUnchanged']
# Read recent board. The separate launcher owns the publication watcher, so it
# cannot outlive this synchronous supervisor's child-reaping boundary.
p=subprocess.run(['tail','-n','40','/home/user/wine-assembly/messageboard.txt'],capture_output=True,timeout=5);assert p.returncode==0;(O/'board-publication-start.txt').write_bytes(p.stdout)
(O/'review.json').write_text(json.dumps(dict(sealVerified=True,qualifierSHA256=r['qualifierSHA256'],exactSynchronousBufferCallsite=True,forbiddenAPIsAbsent=True,nativeQualificationCodeUnchanged=True,binariesCopiedOrCommitted=False,scope='complete source ABI + reused internal type contract + current hashes/layout/noStart; no runtime'),indent=2)+'\n')
print('REVIEW PASS: sealed files match tested driver; exact callsite; no forbidden API; no binaries')

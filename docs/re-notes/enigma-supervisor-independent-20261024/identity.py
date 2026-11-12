import pathlib as P, subprocess as S, json, hashlib, gzip, shutil
repo=P.Path('/tmp/enigma-supervisor-independent-integrate-oct24/repo');ops=repo.parent/'ops'
ev=repo/'docs/re-notes/enigma-supervisor-independent-20261024';sha=lambda b:hashlib.sha256(b).hexdigest()
def blob(d,r,p):return S.check_output(['git','-C',d,'show',r+':'+p])
checks=[]
for m in json.loads((ops/'admission.json').read_text())['manifest']:
 b=(repo/m['path']).read_bytes();assert len(b)==m['bytes'] and sha(b)==m['sha256'];checks.append(m)
review='/tmp/enigma-runner-repairs-independent-integrate-oct24/repo';oldrev='53990b0c159b2c6a46824ca038ab2a1fefa70c75'
old=repo/'docs/re-notes/enigma-runner-repairs-independent-20261024'
seals=json.loads((old/'seals.json').read_text())
for path,m in seals.items():
 b=(repo/path).read_bytes();assert b==blob(review,oldrev,path) and len(b)==m['bytes'] and sha(b)==m['sha256']
for path in ['test/test-enigma-supervisor-denial-independent.py','docs/re-notes/enigma-runner-repairs-independent-20261024.md']:
 assert (repo/path).read_bytes()==blob(review,oldrev,path)
historical=[];main='/tmp/enigma-findfirst-independent-integrate-oct24/repo';rev='d8cd8c54c8d63c107696f1e4ef7a1e229dcadc1e'
fe=repo/'docs/re-notes/enigma-historical-findfirst-compat-20261024-evidence';te=repo/'docs/re-notes/enigma-terminal-capture-guard-20261024'
for name,path in [('historical-run.js','test/run.js'),('historical-filesystem.js','lib/filesystem.js'),('mem-utils.js','lib/mem-utils.js'),('region-map.generated.js','lib/region-map.generated.js'),('byte-provider.js','lib/byte-provider.js')]:
 b=gzip.decompress((fe/(name+'.gz')).read_bytes());assert b==blob(main,rev,path)
 historical.append(dict(revision=rev,path=path,bytes=len(b),sha256=sha(b)))
assert gzip.decompress((te/'runner.js.gz').read_bytes())==gzip.decompress((fe/'historical-run.js.gz').read_bytes())
assert gzip.decompress((te/'filesystem.js.gz').read_bytes())==gzip.decompress((fe/'historical-filesystem.js.gz').read_bytes())
assert (te/'supervise.py.gz').read_bytes()==(old/'original-supervise.py.gz').read_bytes()
for path in ['tools/enigma-findfirst-compat.cjs','test/test-enigma-findfirst-compat.js']:
 assert (repo/path).read_bytes()==blob('/tmp/enigma-historical-findfirst-local-source-oct24/repo','455f3ba3e30a3eedef9a3ce984c1fb0321f9541a',path)
png=json.loads((te/'png-standing.json').read_text())['standingReadonlyPNG']
for m in png:
 b=P.Path(m['path']).read_bytes();assert len(b)==m['bytes'] and sha(b)==m['sha256']
tools=[]
for name in ['node','python3','git','bash','ssh']:
 p=P.Path(shutil.which(name)).resolve();b=p.read_bytes();tools.append(dict(path=str(p),bytes=len(b),sha256=sha(b),standingReadonly=True))
compiler=dict(boundary='actual Node Module.prototype._compile',runnerHistorical=historical[0],excerptRecipe='test/enigma-supervisor-exit-composition.cjs: exact action png through png-raw and catch through gameplayBench, assert unique source positions; full runner compiler capture equals T(Q(original)); actual VFS compiler output equals accepted main',fixtureSHA256=sha((repo/'test/enigma-supervisor-exit-composition.cjs').read_bytes()),fixtureEqualsOriginal=gzip.decompress((old/'composition-review.js.gz').read_bytes())==(repo/'test/enigma-supervisor-exit-composition.cjs').read_bytes())
assert compiler['fixtureEqualsOriginal']
receipt=dict(passed=True,focused=checks,sealsVerified=seals,unchangedOracleAndFailureReceipts=True,historical=historical,compiler=compiler,standingPNG=png,standingTools=tools,readOnlyDonors=True)
(ev/'identity.json').write_text(json.dumps(receipt,indent=2))
print(json.dumps(dict(passed=True,focused=len(checks),seals=len(seals),historical=len(historical),png=len(png),compilerFixtureOriginal=True)))

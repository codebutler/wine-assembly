import pathlib,json,hashlib,subprocess
B=pathlib.Path(__file__).parent
R=pathlib.Path('/tmp/legacy-texture-operation-caps-oct23/repo')
E=R/'docs/re-notes/legacy-texture-argument-state-repair-20261023'
sha=lambda x:hashlib.sha256(x).hexdigest()
git=lambda *a:subprocess.check_output(['git','-C',str(R),*a])
seal=json.loads((E/'seal.json').read_text());assert len(seal)==17
for n,v in seal.items():
 raw=(E/n).read_bytes();assert len(raw)==v['bytes'] and sha(raw)==v['sha256'],n
new=json.loads((B/'independent-manifest.json').read_text());old=json.loads((E/'implementation-manifest.json').read_text())
for k in ['compiler','excerpts','assembledBytes','assembledSHA256','coreSHA256','directxSHA256']:
 assert new[k]==old[k],k
for c in new['compiler']:
 raw=(R/c['file']).read_bytes();assert sha(raw)==c['sha256'] and raw==git('show','77ec71eb:'+c['file'])
assert sha((B/'argument-reproducer.js').read_bytes())=='0ec40eb4098b37a01656406c0e76059a5677ad4583c374e99404b0b893a2352a'
assert (B/'argument-reproducer.js').read_bytes()==(E/'argument-reproducer.js').read_bytes()
baseline='5406777ecbcef9cf9b03b40d592d722bb0086de0'
reject=json.loads((E/'implementation-baseline-rejections.json').read_text())
assert reject['baseline']==baseline and reject['status']=='PASS'
assert sha(git('show',baseline+':src/09ab-handlers-d3dim-core.wat'))==reject['baselineCoreSHA256']
assert git('show',baseline+':src/09ab-handlers-d3dim-core.wat')==(B/'baseline-core.wat').read_bytes()
assert sha(git('show',baseline+':lib/d3dim-gpu.js'))==reject['baselineGpuSHA256']
assert (B/'implementation-baseline.py').read_bytes()==(E/'implementation-baseline.py').read_bytes()
# Preserve the producer preflight after saving the fresh HEAD binding separately.
(B/'independent-candidate-preflight.json').write_bytes((B/'implementation-preflight.json').read_bytes())
(B/'implementation-preflight.json').write_bytes((E/'implementation-preflight.json').read_bytes())
result={'candidate':'77ec71ebf96aaf7c3ce37d7114821ae74d4da902','sealEntries':17,'status':'PASS',
 'unchangedReproducerSHA256':sha((B/'argument-reproducer.js').read_bytes()),
 'baselineRejection':'reused exact sealed rejection after independent script/core/GPU/reproducer binding review',
 'baseline':baseline,'assembledBytes':new['assembledBytes'],'assembledSHA256':new['assembledSHA256'],
 'compilerAndExcerptIdentity':'exact saved manifest equality, full compiler bytes equal Git candidate; individual ranges verified by preflight'}
(B/'independent-identity.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result))

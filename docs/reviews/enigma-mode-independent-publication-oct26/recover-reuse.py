from common import *
save('incident-prior-manifest-path.json',dict(error='Rejected review is not an ancestor of repair; its direct path is absent',resolution='use inherited byte-exact prior-evidence-manifest.json',astAndDependencyChecksCompleted=True,noTestOrSemanticFailure=True))
base='f1aac7b9ba83e2bbc763cb58d38646653d626468'
unchanged=['font','validate','source','consume','inventory','main']
recipe='docs/re-notes/enigma-staging-footprint-repair-20261026/verify-and-stage.py'
repair=R/'docs/reviews/enigma-staging-mode-preservation-repair-oct26'
closure=json.loads((repair/'closure.json').read_text())
unchangedpaths=[p for p in closure if p not in ['tools/enigma-bounded-staging.py',recipe]]
reuse=json.loads((repair/'reuse.json').read_text())
assert sha(repair/'prior-evidence-manifest.json')==sha(A/'docs/reviews/enigma-staging-footprint-independent-accept-oct26/evidence-manifest.json')
code=(H/'reuse-merge.py').read_text()
exec(compile(code[code.index("save('reuse.json'"):],str(H/'reuse-merge.py'),'exec'))

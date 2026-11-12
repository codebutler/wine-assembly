import importlib.util
import json
import pathlib
import subprocess

E = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('verify', E / 'verify-integration.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
R = v.ROOT
main, candidate, base = map(v.tree, [v.MAIN, v.CANDIDATE, v.BASE])
owned = sorted(p for p in base.keys() | candidate.keys() if base.get(p) != candidate.get(p))
production = ['lib/d3d-shader-ir.js', 'lib/d3d9-backend.js', 'lib/d3d9-host.js',
              'lib/d3d9-shader.js', 'lib/d3d9-software-backend.js',
              'src/09ah-d3d-software.wat', 'src/09aj-d3d-fixed.wat']
tests = [p for p in owned if p.startswith('test/') or p == 'tools/test-tiers.js']
assert len(production) == 7 and len(tests) == 8
assert all(p in production or p in tests or p.startswith('docs/re-notes/render-')
           or p.startswith('scratch/runs/20261023-render-positiont-') for p in owned)
v.git('read-tree', v.MAIN)
data = ''.join((candidate[p][0] + ' ' + candidate[p][1] + '\t' + p + '\n')
               if p in candidate else '0 ' + '0'*40 + '\t' + p + '\n' for p in owned).encode()
v.git('update-index', '--index-info', data=data)
paths = v.git('ls-files', '-z')
v.git('update-index', '--skip-worktree', '-z', '--stdin', data=paths)
tree = v.git('write-tree', '--missing-ok').decode().strip()
proof = v.verify(tree)
(E / 'proposed-tree-proof.json').write_text(json.dumps(proof, indent=2) + '\n')
unchanged = [{'path': p, 'mode': main[p][0], 'blob': main[p][1]}
             for p in sorted(main) if base.get(p) != main[p]]
(E / 'preserved-current-main-delta.json').write_text(json.dumps(unchanged, indent=2) + '\n')
coverage = {
    'reviewVerdict': 'ACCEPT exact scoped proposed main delta',
    'reviewedProduction': production, 'reviewedTestSupportTier': tests,
    'sourceSoftware': {'candidate': '5427a9e2e7d20984249cadcf67f1cb33cc9d85c0',
                       'independentAcceptance': '6ac29d0c4bd8def2f5cf06d4cac1795a08f1e754',
                       'coverage': 'Complete shared route, depth restriction, numerical admission, both consumers and existing source tests; software pixels and recording GPU only'},
    'fixture': {'candidate': '7aef3ff22f0dbe4fbfe739196bf92ad7a9435fb6',
                'independentAcceptance': 'aea185d3dfc1b772cea00ca1a4aed14b9553dfed',
                'coverage': 'Qualification fixture, render-helper prebuilt path, support loader/builder/pins/guards and e2e tier'},
    'tinyRhw': {'candidate': '301b568d2c9359a5fe8c8336002412c2c5d9f5e3',
                'independentAcceptanceAndSinglePin': '345ea682b7ff6f70d942315051c01f935e1bbcd2',
                'blob': '538290c4241f9112ff5e16f5cd71735ab38edea9'},
    'allocatorFixture': {'candidate': 'c9a59870ff46416653d0782ebfc296df1bb0ae59',
                         'independentAcceptanceAndFullCOM': v.CANDIDATE,
                         'coverage': 'Only callback checkpoint before backend coalescing and largest-first reuse targets; all bounds and oracles preserved'},
    'reuse': 'All 52 gates, decoder, arithmetic, causal runs and retained-module native qualification reused without replay',
    'limits': 'No real WebGL/browser/GPU/gameplay/performance qualification; no-op-free runner mismatch remains NOT runnerPASS',
    'integration': '219 exact accepted entries over fresh remote main; no cherry-pick or source modification',
}
for rev, parent in [('6ac29d0c4bd8def2f5cf06d4cac1795a08f1e754', coverage['sourceSoftware']['candidate']),
                    ('aea185d3dfc1b772cea00ca1a4aed14b9553dfed', coverage['fixture']['candidate'])]:
    assert v.git('rev-parse', rev+'^').decode().strip() == parent
    changed = v.git('diff', '--name-only', parent, rev).decode().splitlines()
    assert all(p.startswith('docs/re-notes/') or p.startswith('scratch/runs/') for p in changed)
(E / 'acceptance-coverage.json').write_text(json.dumps(coverage, indent=2) + '\n')
# Check only source/test/support/tier deltas. Historical raw logs are verbatim evidence.
v.git('diff', '--check', v.MAIN, tree, '--', *production, *tests)
(E / 'static-checks.json').write_text(json.dumps({'verdict': 'PASS', 'gitDiffCheck': production + tests,
    'proposedTree': tree, 'allUnrelatedEntriesCompared': True, 'pinsAndModes': 286,
    'closureModes': 290, 'projectCodeImported': False, 'buildOrNativeRun': False}, indent=2) + '\n')
print(json.dumps({'verdict': 'PASS', 'tree': tree, 'acceptedPaths': len(owned),
                  'production': len(production), 'testSupportTier': len(tests),
                  'preservedCurrentMainDelta': len(unchanged), 'pins': 286, 'closure': 290}))

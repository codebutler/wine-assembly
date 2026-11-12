import ast,hashlib,json,os,time
from pathlib import Path
H=Path(__file__).parent;R=H.parent/'repo'
D=Path('/tmp/enigma-staging-footprint-repair-oct26/repo')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def functions(p):
 return {n.name:ast.dump(n,include_attributes=False) for n in ast.parse(p.read_text()).body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))}
old=functions(D/'tools/enigma-bounded-staging.py');new=functions(R/'tools/enigma-bounded-staging.py')
unchanged=['font','validate','source','consume','inventory','main']
assert all(old[n]==new[n] for n in unchanged)
recipe='docs/re-notes/enigma-staging-footprint-repair-20261026/verify-and-stage.py'
assert functions(D/recipe)==functions(R/recipe)
assert (R/'test/test-enigma-bounded-staging.py').read_bytes()==(D/'test/test-enigma-bounded-staging.py').read_bytes()
assert sha(H/'accept.py')=='5fc9ef217c961ac0303801fa7f479e1b86ed3fba1a8e87caee4cde91f1cd40a8'
assert sha(H/'check-644.py')=='0073e4d18eda15efe65c2c54c7551bdc260883b198be45230aac0f03348110ec'
for p in (D/'docs/re-notes/enigma-staging-footprint-repair-20261026').iterdir():
 if p.name!='verify-and-stage.py':assert (R/p.relative_to(D)).read_bytes()==p.read_bytes()
groups=['baseline-modes','baseline-644','repaired-modes','repaired-644','repaired-recipe','repaired-identity-contract','focused-final']
results=[json.loads((H/('checkpoint-'+g+'.json')).read_text()) for g in groups]
assert all(r['matchedExpected'] for r in results)
assert 'Ran 5 tests' in (H/'focused-final.stderr').read_text() and (H/'focused-final.stderr').read_text().rstrip().endswith('OK')
assert 'PermissionError' in (H/'repaired-identity-contract.stderr').read_text()
j=dict(time=time.time(),base='f1aac7b9ba83e2bbc763cb58d38646653d626468',
 acceptance='00bdb5504bc28e1ef17e15c15dbbc81773dbb5f8',
 sources={p:sha(R/p) for p in ['tools/enigma-bounded-staging.py',recipe,'test/test-enigma-staging-modes.py','test/test-enigma-bounded-staging.py']},
 results=results,unchangedFunctions=unchanged,recipeExecutableASTUnchanged=True,
 reuse=dict(suppliedSevenTests='unchanged font/content/path/source/accounting logic; original receipts preserved, not rerun',
 sourceRehash2659='unchanged manifest/pins/bytes; prior receipt preserved, not rerun',
 independentCleanup='font-source/error/namespace branches unchanged; new chmod failure cleanup checked',
 independentIdentityAndTwoMutants='unchanged font/consume/inventory and alias logic; affected nonfont permission/identity/accounting behavior covered by focused regression',
 identityScopeNote='Prior identity fixture writes a nonfont copied from 0444 donor; preserving 0444 intentionally makes that write unavailable. Original fixture/evidence remains unchanged; no claim the old writable-copy assumption passes this contract.',
 recipe='tiny exact recipe executed again; executable AST unchanged, documentation contract updated'),
 remaining=[],runtimeGates=['coordinator review/integration','fresh transport/real filesystem admission preserving modes and immutable aliases','guest frame/PNG/gameplay qualification'],
 box=dict(id=None,state='N/A - none assigned; user reports previous boxes STOPPED',expiry=None,shutdownOwner='coordinator'),
 blockers=[],status='REPAIR_TESTS_PASS')
tmp=H/'checkpoint.new';tmp.write_text(json.dumps(j,indent=2)+'\n');os.replace(tmp,H/'checkpoint.json')
print(json.dumps(dict(status=j['status'],helperSHA256=j['sources']['tools/enigma-bounded-staging.py'],remaining=j['remaining'])))

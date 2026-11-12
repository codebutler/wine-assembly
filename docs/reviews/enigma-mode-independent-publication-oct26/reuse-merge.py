from common import *
import ast,copy
admission('prereuse-merge')
base='f1aac7b9ba83e2bbc763cb58d38646653d626468'
# Bounded helper blob; source code comfortably below the output gate.
old=git('show',base+':tools/enigma-bounded-staging.py')[1].decode()
new=(R/'tools/enigma-bounded-staging.py').read_text()
def parsed(code):
 tree=ast.parse(code)
 if isinstance(tree.body[0],ast.Expr) and isinstance(tree.body[0].value,ast.Constant):tree.body.pop(0)
 return tree
ot,nt=parsed(old),parsed(new)
oldfuncs={n.name:n for n in ot.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))}
newfuncs={n.name:n for n in nt.body if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef))}
unchanged=['font','validate','source','consume','inventory','main']
for name in unchanged:assert ast.dump(oldfuncs[name])==ast.dump(newfuncs[name]),name
# Exhaustively account for stage's executable changes rather than accepting a
# vaguely similar function: delete exactly the two reviewed mode operations.
stage=copy.deepcopy(newfuncs['stage'])
loop=next(n for n in ast.walk(stage) if isinstance(n,ast.For) and isinstance(n.target,ast.Name) and n.target.id=='row')
mode=loop.body.pop(0)
assert ast.unparse(mode)=="mode = None if font(row['target']) else regular_mode(row)"
conditional=next(n for n in loop.body if isinstance(n,ast.If) and ast.unparse(n.test)=='shared is not None')
fontbranch=conditional.orelse[0]
assert ast.unparse(fontbranch.orelse[0])=='target.chmod(mode)' and len(fontbranch.orelse)==1
fontbranch.orelse=[]
assert ast.dump(stage)==ast.dump(oldfuncs['stage'])
recipe='docs/re-notes/enigma-staging-footprint-repair-20261026/verify-and-stage.py'
assert ast.dump(parsed(git('show',base+':'+recipe)[1].decode()))==ast.dump(parsed((R/recipe).read_text()))
repair=R/'docs/reviews/enigma-staging-mode-preservation-repair-oct26'
closure=json.loads((repair/'closure.json').read_text())
unchangedpaths=[p for p in closure if p not in ['tools/enigma-bounded-staging.py',recipe]]
for p in unchangedpaths:
 assert git('rev-parse',base+':'+p)[1]==git('rev-parse',V+':'+p)[1]
reuse=json.loads((repair/'reuse.json').read_text())
assert reuse['suppliedTests']['status']==0 and reuse['sourceVerification']['allSourcesRehashed'] and reuse['sourceVerification']['files']==2659
assert reuse['suppliedTests']['testSHA256']==sha(R/'test/test-enigma-bounded-staging.py')
assert sha(repair/'accept.py')==sha(H/'accept.py')
save('reuse.json',dict(candidate=V,originalCandidate=base,unchangedFunctions=unchanged,stageChangesExhaustivelyReviewed=True,recipeExecutableASTUnchanged=True,unchangedDependencies=unchangedpaths,originalSevenReceipt=reuse['suppliedTests'],source2659Receipt=reuse['sourceVerification'],priorRepairManifestSHA256=sha(repair/'evidence-manifest.json'),priorIndependentManifestSHA256=sha(repair/'prior-evidence-manifest.json'),retainedReceipts=[str(p.relative_to(R)) for p in repair.glob('checkpoint-*.json')],scope='Reuse seven tests/2659-source hashes/cleanup and alias-accounting mutant controls on unchanged dependencies. New modes and chmod paths independently tested here. Old identity full-group is not a repaired PASS; unchanged original now fails on readonly write.',noFullMediaStaging=True))
cp=json.loads((H/'checkpoint.json').read_text());cp['completed'].append('reuse-reviewed');cp['remaining']=['merge','affected-merged-validation','publication'];save('checkpoint.json',cp)
remote=git('ls-remote','origin','refs/heads/main','refs/heads/task/enigma-staging-mode-preservation-repair-oct26')[1].decode()
refs={line.split()[1]:line.split()[0] for line in remote.splitlines()}
assert refs['refs/heads/main']==MAIN and refs['refs/heads/task/enigma-staging-mode-preservation-repair-oct26']==V
mb=git('merge-base',MAIN,V)[1].decode().strip()
delta=git('diff','--name-only',mb,V)[1].decode().splitlines()
allowedprefix=['docs/re-notes/enigma-staging-footprint-repair-20261026/','docs/reviews/enigma-staging-footprint-independent-accept-oct26/','docs/reviews/enigma-staging-mode-preservation-repair-oct26/','docs/re-notes/enigma-api-single-frame-startup-20261026/']
assert all(p in ['tools/enigma-bounded-staging.py','test/test-enigma-bounded-staging.py','test/test-enigma-staging-modes.py','docs/re-notes/enigma-api-single-frame-startup-20261026.md'] or any(p.startswith(x) for x in allowedprefix) for p in delta),delta
git('checkout','-B',BRANCH,MAIN)
rc,out,err=git('merge','--no-ff','--no-commit',V,check=False)
save('merge-attempt.json',dict(main=MAIN,candidate=V,mergeBase=mb,candidateChangedPaths=delta,rc=rc,stdout=out.decode(),stderr=err.decode(),remote=refs))
assert rc==0,'semantic merge conflict; stop publication'
assert not git('ls-files','-u')[1]
tree=git('write-tree')[1].decode().strip()
changed=git('diff','--name-only',MAIN,tree)[1].decode().splitlines()
assert set(changed).issubset(set(delta))
# Whole-tree recursive diff includes Git modes and blob identities. No browser,
# app-files, VFS, renderer or ownership code may differ from current main.
for path in changed:assert git('ls-tree',tree,'--',path)[1]==git('ls-tree',V,'--',path)[1],path
for path,h in json.loads((H/'inputs.json').read_text())['pins'].items():assert sha(R/path)==h
raw=git('diff','--raw','--no-abbrev',MAIN,tree)[1].decode()
save('merge.json',dict(main=MAIN,candidate=V,mergeBase=mb,testedTree=tree,changed=changed,rawModeBlobDelta=raw,allOtherMainBytesAndModesPreserved=True,allChangedPathsExactCandidate=True,conflicts=False,protectedAreas=['browser','appfiles','VFS','renderer','ownership']))
cp=json.loads((H/'checkpoint.json').read_text());cp['completed'].append(dict(name='merge',tree=tree));cp['remaining']=['affected-merged-validation','publication'];save('checkpoint.json',cp)
print(json.dumps(dict(status='MERGED_CONFLICT_FREE',tree=tree,changed=len(changed),main=MAIN,priorSevenAnd2659Reused=True,resources=admission('postmerge')['peak'])))

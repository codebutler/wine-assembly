from common import *
P=R/'docs/reviews'/H.name
main=json.load(open(O/'main-reconciliation-inventory.json'))['main']
gate('integration')
rows=g('ls-tree','-r',REV).decode().splitlines()
sourcePaths=['tools/enigma-presented-menu-controller.cjs','test/test-enigma-presented-menu-controller.cjs','test/test-enigma-tracked-runner-wiring.cjs','test/fixtures/enigma-presented-menu-contract.json']
png='docs/re-notes/enigma-start-game-menu-click-api-oct26/predecessor-menu.png'
reviewDirs=['enigma-atomic-click-independent-accept-oct26','enigma-atomic-presented-click-repair-oct26','enigma-final-dispatch-uncertainty-repair-oct26','enigma-presented-frame-controller-repair-oct26','enigma-tracked-runner-pin-repair-oct26','enigma-uncertainty-independent-publication-oct26']
selected=[];entries=[]
for line in rows:
 head,p=line.split('\t');mode,kind,oid=head.split()
 if p in sourcePaths+[png] or any(p.startswith('docs/reviews/'+d+'/') for d in reviewDirs):
  assert kind=='blob';selected.append(p);entries.append(f'{mode} {oid}\t{p}\n')
assert len(selected)==180,len(selected)
# None of the selected paths existed in exact fresh main. This is explicit
# conflict detection, not arbitrary replacement of changed current files.
mainPaths={line.split('\t')[1] for line in g('ls-tree','-r',main).decode().splitlines()}
assert not set(selected)&mainPaths
# Ensure all accepted source/fixture bytes materialized and hash-bound; only
# historical evidence may remain standing immutable remote Git objects.
for p in sourcePaths+[png]:assert sha((R/p).read_bytes())==sha(g('show',REV+':'+p))
# Preserve every unrelated main entry via index-level assembly. Do not change
# root checkout or overwrite any candidate/source fixture bytes.
g('read-tree',main)
g('update-index','--index-info',input=''.join(entries).encode())
tree=g('write-tree','--missing-ok').decode().strip()
delta=g('diff-tree','--no-commit-id','--name-status','-r',main,tree).decode().splitlines()
assert all(x.startswith('A\t') for x in delta);assert sorted(x.split('\t')[1] for x in delta)==sorted(selected)
assert g('rev-parse',tree+':test/run.js').decode().strip()=='4b8461338f4bcddde6b5d5504991523b28d3ac35'
# Explicit source/test diff: all four are exact accepted additions to main.
patch=g('diff',main,tree,'--',*sourcePaths);(O/'accepted-source-test.diff').write_bytes(patch)
# No candidate source/fixture dependency changed in the merged tree.
identities={}
for p in sourcePaths+[png,'test/run.js','docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-runner-slices.json','docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-run.js']:
 actual=g('rev-parse',tree+':'+p).decode().strip();expected=g('rev-parse',REV+':'+p).decode().strip();assert actual==expected;identities[p]=actual
# Materialize only the exact main runner (687226 bytes), counted in allocation.
(R/'test/run.js').write_bytes(g('show',tree+':test/run.js'))
save('checkpoint-merged-tree.json',dict(candidate=REV,main=main,mergedSourceTree=tree,sourcePaths=sourcePaths,selected=selected,changes=delta,sourceTestDiffSHA256=sha(patch),identicalCandidateDependencyBlobs=identities,reused=dict(independent=[13,9,7],supplier=[12,11,3],prior=[25,45,24,9,10,20]),remaining=['affected merged transformation and syntax/whitespace','task/main publication'],blockers=[]))
print(json.dumps(dict(main=main,mergedSourceTree=tree,selected=len(selected),sourceTestDiffBytes=len(patch))))

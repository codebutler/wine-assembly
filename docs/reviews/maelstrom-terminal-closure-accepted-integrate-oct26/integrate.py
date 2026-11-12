from control import *
limits()
CANDIDATE='bbcc8685a900c1714e11b2eda4b7ac99f3d6f105'; ACCEPT='9c92dd2039b902960f3c0f6c71080bd1eb2dfc24'
A=json.loads(read(DONOR.parent/'ops/result.json'))
production=['tools/maelstrom-original-errno-adapter.cjs','tools/maelstrom-native-errno-latch.cjs']
tests=['test/maelstrom-adapter-scalar-anchor.test.cjs','test/maelstrom-status-event-validation.test.cjs','test/maelstrom-terminal-callback-closure.test.cjs','test/maelstrom-original-errno-adapter.cjs','test/maelstrom-native-latch-rejection.test.cjs']
merge=git('reconciliation-base','merge-base',BASE,CANDIDATE)
# A main-side change to these files requires acceptance, not an invented merge.
git('no-main-side-source-conflict','diff','--exit-code',merge,BASE,'--',*production,*tests)
gate('exact-before-source-integration')
git('restore-accepted-chain','restore','--source='+CANDIDATE,'--staged','--worktree','--',*production,*tests,'docs/reviews/maelstrom-state-acceptance-retained-closeout-oct26','docs/reviews/maelstrom-terminal-callback-closure-repair-oct26')
git('restore-independent-acceptance','restore','--source='+ACCEPT,'--staged','--worktree','--','docs/reviews/maelstrom-terminal-closure-independent-accept-oct26')
for p,h in A['pins'].items():assert sha(R/p)==h,(p,'accepted pin mismatch')
unaffected=json.loads(read(DONOR.parent/'ops/retained-unaffected.json'))
for p,h in unaffected['inputPins'].items():
 q=pathlib.Path(p) if p.startswith('/') else R/p
 assert sha(q)==h,(p,'unaffected input mismatch')
assert sha('/tmp/maelstrom-native-latch-rejection-reason-oct26/ops/source-inputs.json')==unaffected['standingSourceManifest']
for p in ['status-event-independent.cjs','independent.cjs','challenge.cjs']:
 gate('retain-'+p);shutil.copyfile(DONOR.parent/'ops'/p,O/p);assert sha(O/p)==sha(DONOR.parent/'ops'/p)
for p in ['retained-unaffected.json','source-acceptance.json','incidents.json','evidence-manifest.json']:
 shutil.copyfile(DONOR.parent/'ops'/p,O/('accepted-'+p))
tree=git('merged-tested-tree','write-tree')
dump(O/'merged-inputs.json',dict(base=BASE,mergeBase=merge,candidate=CANDIDATE,acceptance=ACCEPT,testedTree=tree,pins=A['pins'],production=production,tests=tests,necessaryPredecessors=['ea399ffd78 relocated verifier anchor','312cdf84f7 rejection diagnostics and adapter','a70b639021 diagnostic validation','ecd805602e scalar and return anchor','7508a8c20f finite status/event validation','581ff191ef corrected enum fixture and unchanged failing26 reproducer','bbcc8685a9 terminal callback closure'],excluded='Unrelated history, canonical build/native capture tools and native execution tests were not imported. Main-side unrelated renderer/source history preserved.',fixtureReconciliation=A['fixtureReconciliation'],unaffected=unaffected))
git('staged-review','diff','--cached','--stat');git('staged-whitespace','diff','--cached','--check')
print('SCOPED INTEGRATION READY',tree,dict(pinsVerified=len(A['pins']),unaffectedInputsVerified=len(unaffected['inputPins'])),json.dumps(gate('merged-ready')))

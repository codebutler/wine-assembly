import sys,json
sys.dont_write_bytecode=True
import manage as a
p=json.loads((a.O/'configuration.json').read_text())['pins'];t=json.loads((a.O/'tested-tree.json').read_text());tree=t['testedCodeTree'];base=t['base']
src=a.git('ls-tree','-r',a.SOURCE,'--',*p).decode().splitlines();report=a.git('ls-tree','-r',a.REPORT,'--',*p).decode().splitlines();merged=a.git('ls-tree','-r',tree,'--',*p).decode().splitlines()
assert src==report==merged and len(src)==9
idx=a.git('ls-files','--stage','--',*p).decode().splitlines();assert len(idx)==9
assert {(x.split()[0],x.split()[2],x.split('\t')[1]) for x in src}=={(x.split()[0],x.split()[1],x.split('\t')[1]) for x in idx}
delta=a.git('diff-tree','--no-commit-id','--name-status','-r',base,tree).decode().splitlines();assert len(delta)==7 and all(row.split('\t')[0]=='A' and row.split('\t')[1] in p for row in delta)
assert a.git('diff','--cached','--check')==b''
assert a.git('write-tree','--missing-ok').decode()==tree
v=json.loads((a.O/'verification.json').read_text());v.update(gitSourceBlobRows=src,gitIndexBlobRows=idx,wholeTreeDelta=delta,wholeTreePreservesUnrelatedEntries=True,affectedLegacy=dict(status='PASS',methods=4,receiptSHA256=a.sha(a.O/'affected-result.json')),remaining=['task/main conditional publication'])
a.save('verification.json',v)
a.checkpoint('merged-tree-validation-complete',base=base,testedCodeTree=tree,verificationSHA256=a.sha(a.O/'verification.json'),remaining=['report packaging','task branch push/exact verification','normal fast-forward main push/exact verification'])
print(json.dumps(dict(status='PASS',codeTree=tree,nineExactBlobs=True,actualAdditions=7,unchangedPinnedMainFiles=2,affectedLegacyTests=4,unrelatedPreserved=True)))

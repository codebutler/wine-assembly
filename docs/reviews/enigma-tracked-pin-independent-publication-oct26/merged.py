from common import *
P=R/'docs/reviews'/H.name
m=json.load(open(O/'checkpoint-merged-tree.json'));gate('merged-validation')
# Include the new independent test in the tested merged tree. Its transform
# section was unchanged by the mock-drain brace/button bookkeeping correction.
s=(P/'independent.cjs').read_text();old=s.replace('${parts.clickBody}}\\n}}`','${parts.clickBody}}\\n}`').replace("['down',1,2,1],['up',1,2,1],['down',344,212,1],['up',344,212,1]","['down',1,2,0],['up',1,2,0],['down',344,212,0],['up',344,212,0]")
first=json.load(open(O/'checkpoint-transform.json'));assert sha(old.encode())==first['result']['fixtureSHA256']
assert s[:s.index('// All executable snippets')]==old[:old.index('// All executable snippets')]
save('fixture-correction.json',dict(firstFixtureSHA256=sha(old.encode()),finalFixtureSHA256=sha(s.encode()),transformSectionSHA256=sha(s[:s.index('// All executable snippets')].encode()),unchangedTransformSection=True,firstFailure='mock drain missing closing brace before assertions; corrected exact source mouse button expected value 1',replayedGroups=['protocol remaining','ambiguity remaining'],notReplayed=['transform PASS retained']))
p='docs/reviews/'+H.name+'/independent.cjs';oid=g('hash-object','-w','--stdin',input=s.encode()).decode().strip();g('update-index','--add','--cacheinfo','100644,'+oid+','+p)
tree=g('write-tree','--missing-ok').decode().strip()
for p in m['sourcePaths']+['test/run.js','docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-run.js','docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-runner-slices.json']:
 assert g('rev-parse',tree+':'+p)==g('rev-parse',m['mergedSourceTree']+':'+p)
syntax=[]
for p in m['sourcePaths'][:3]+['test/run.js','docs/reviews/'+H.name+'/independent.cjs']:
 run([NODE,'--max-old-space-size=192','--check',str(R/p)],cwd=R);syntax.append(p)
code="""const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');const {wireRunner}=require('./tools/enigma-presented-menu-controller.cjs');const b=fs.readFileSync('./test/run.js');const sha=b=>crypto.createHash('sha256').update(b).digest('hex');assert.equal(sha(b),'87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7');const w=wireRunner(b.toString('utf8'));assert.equal(sha(w),'a9625e1d102883c27b1bd2de0bab560a44ab3bc7eb589b18e7a736100eb2a0da');new vm.Script(w);console.log(JSON.stringify({runnerSHA256:sha(b),derivativeSHA256:sha(w),parseOnly:true,guestExecutions:0}))"""
result=json.loads(run([NODE,'--max-old-space-size=192','-e',code],cwd=R))
g('diff','--check',m['main'],tree,'--',*m['sourcePaths'],'docs/reviews/'+H.name)
save('checkpoint-merged-validation.json',dict(candidate=REV,main=m['main'],testedMergedTree=tree,mergedTreeBeforeOwnedTest=m['mergedSourceTree'],syntax=syntax,transformation=result,whitespace='four production/source/test additions plus own evidence pass; historical evidence retained byte-identical',sourceFixtureDependencyBlobs=m['identicalCandidateDependencyBlobs'],reusedGroups=dict(independent=[13,9,7],supplier=[12,11,3],prior=[25,45,24,9,10,20]),remaining=['freeze focused evidence/manifest','task branch push and exact verification','fresh main compare then fast-forward publication and exact verification'],blockers=[]))
print(json.dumps(dict(testedMergedTree=tree,syntaxFiles=len(syntax),actualMainRunnerTransformation='PASS',derivativeParse='PASS',whitespace='PASS')))

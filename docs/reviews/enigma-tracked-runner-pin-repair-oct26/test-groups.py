from common import *
P=R/'docs/reviews'/H.name;P.mkdir(parents=True,exist_ok=True)
OLD=R/'docs/reviews/enigma-uncertainty-independent-publication-oct26'
source=OLD/'tracked-run.js'
assert sha(source.read_bytes())=='87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7'
# Retained coordinates are JavaScript UTF-16 offsets despite their historical names.
# Verify exact full slice hashes independently and record corrected UTF-8 coordinates.
recipe=json.loads((OLD/'runner-extraction.json').read_text());parts=json.loads((OLD/'tracked-runner-slices.json').read_text());b=source.read_bytes()
corrected={}
for name,row in recipe['recipes'].items():
 chunk=parts[name].encode();assert sha(chunk)==row['sha256'];assert len(chunk)==row['bytes'];assert b.count(chunk)==1
 at=b.index(chunk);corrected[name]=dict(startByte=at,endByteExclusive=at+len(chunk),sha256=sha(chunk))
save('corrected-extraction.json',dict(incident='prior startByte/endByteExclusive names contain JS string offsets, not UTF-8 byte offsets; original assertion stopped before wiring tests',resolution='exact unique byte search/full SHA and length match unchanged retained slices',recipes=corrected))
save('input-pins.json',dict(base=REV,controllerBase='bec911b41208d3fbc39e0f62852ab7535eff204046dc6f7a096b047be610ba36',runner=recipe,priorManifestSHA256=sha((OLD/'evidence-manifest.json').read_bytes()),readOnlyDonor=str(D),standingDonorAllocated=alloc(D),installedNode=dict(path=NODE,sha256=sha(pathlib.Path(NODE).read_bytes()),allocated=alloc(pathlib.Path(NODE)))))
assert sha((OLD/'evidence-manifest.json').read_bytes())=='24fe4109c87b6249d26ca9ee5beb7c71bd84d986f4b769150597ecd5227bbd4d'
gate('wiring')
result=json.loads(run([NODE,'--max-old-space-size=192',str(R/'test/test-enigma-tracked-runner-wiring.cjs'),str(source)]));save('wiring-results.json',result)
hashes={str(p.relative_to(R)):sha(p.read_bytes()) for p in [R/'tools/enigma-presented-menu-controller.cjs',R/'test/test-enigma-tracked-runner-wiring.cjs',source,OLD/'runner-extraction.json',OLD/'tracked-runner-slices.json']}
save('checkpoint-wiring.json',dict(base=REV,candidateSourceSHA256=hashes,results=result,remaining=['production-wired protocol guards','publication'],reused={'priorIndependentPasses':25,'earlierGroups':[45,24,9,10,20]}))
# Reuse unchanged fixture structure; only replace the manual handler insertion
# with bytes extracted after the real production wireRunner transformation.
s=(OLD/'fixture.cjs').read_text().replace("const parts=require('./tracked-runner-slices.json');","const parts=JSON.parse(JSON.stringify(require('../enigma-uncertainty-independent-publication-oct26/tracked-runner-slices.json')));")
s=s.replace("${parts.handleControlCommand.replace(\"    if (cmd.action === 'eval') return controlEval(cmd.code || '');\",ATOMIC_BRANCH+\"    if (cmd.action === 'eval') return controlEval(cmd.code || '');\")}","${parts.handleControlCommand}")
insert="""
const source=fs.readFileSync(path.join(__dirname,'../enigma-uncertainty-independent-publication-oct26/tracked-run.js'),'utf8');
const wired=wireRunner(source), start=wired.indexOf('  const handleControlCommand = (cmdIn) => {'),end=wired.indexOf('  const control = (CONTROL || CONTROL_STDIN)',start);
assert(start>=0&&end>start);
parts.handleControlCommand=wired.slice(start,end);
assert.equal(parts.handleControlCommand,require('../enigma-uncertainty-independent-publication-oct26/tracked-runner-slices.json').handleControlCommand.replace("    if (cmd.action === 'eval') return controlEval(cmd.code || '');",ATOMIC_BRANCH+"    if (cmd.action === 'eval') return controlEval(cmd.code || '');"));
"""
s=s.replace('function fixture(fault) {',insert+'\nfunction fixture(fault) {')
(P/'fixture.cjs').write_text(s)
s=(OLD/'runner-guards.cjs').read_text().replace("require('./stock-fixture.cjs')","require('../enigma-uncertainty-independent-publication-oct26/stock-fixture.cjs')")
(P/'runner-guards.cjs').write_text(s)
print('WIRING PASS; protocol fixtures ready')

from common import *
E=R/'docs/reviews'/H.name
gate('focused-tests')
old=(E/'unchanged-before-oracle.cjs').read_bytes();assert sha(old)=='a04f1938afab1743fdb02a2872567542f7530ef0ff5c6720649adcfd44d6706b'
save('checkpoint-inputs.json',dict(candidate=REV,pinsSHA256=sha((O/'pins.json').read_bytes()),beforeOracleSHA256=sha(old),result='34 manifest payloads, four source pins, seven exact full slices and candidate remote PASS',remaining='independent focused protocol challenges; publication'))
out=run([NODE,'--max-old-space-size=192',str(E/'challenges.cjs'),'/tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js'],cwd=R)
(E/'results.json').write_bytes(out)
j=json.loads(out)
save('checkpoint-focused.json',dict(candidate=REV,sourceHashes=json.load(open(O/'pins.json'))['sourceHashes'],fixtureHashes={p.name:sha(p.read_bytes()) for p in E.glob('*.cjs')},evidenceSHA256=sha(out),results=j,remaining='focused review and evidence publication only; runtime/integration blocked by rejection'))
print(json.dumps(dict(verdict=j['verdict'],cases=len(j['results']),falseNoClick=[x['name'] for x in j['results'] if x.get('truthfulness')=='FAIL_FALSE_NO_CLICK'])))

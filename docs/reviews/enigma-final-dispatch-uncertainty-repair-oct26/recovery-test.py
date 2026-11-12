from common import *
E=R/'docs/reviews'/H.name
gate('focused-tests')
for name,args in [
 ('focused-unit-results.txt',['test/test-enigma-presented-menu-controller.cjs','--final-dispatch-only']),
 ('unchanged-independent-results.json',['docs/reviews/enigma-atomic-click-independent-accept-oct26/challenges.cjs','/tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js'])]:
 out=run([NODE,'--max-old-space-size=192',*args],cwd=R)
 (E/name).write_bytes(out)
 save('checkpoint-'+name+'.json',dict(base=REV,sourceHashes={str(p.relative_to(R)):sha(p.read_bytes()) for p in [R/'tools/enigma-presented-menu-controller.cjs',R/'test/test-enigma-presented-menu-controller.cjs']},evidenceSHA256=sha(out),remaining='review/publication; independent acceptance and tracked-runner/runtime gates'))

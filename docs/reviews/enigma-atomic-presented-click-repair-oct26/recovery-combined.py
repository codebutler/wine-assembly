from common import *
P=R/'docs/reviews'/H.name
p=R/'test/test-enigma-presented-menu-controller.cjs'
gate('combined')
b=run([NODE,'--max-old-space-size=192',str(p)]);(P/'combined-results.txt').write_bytes(b)
save('combined-checkpoint.json',dict(candidate=REV,controllerSHA256=sha((R/'tools/enigma-presented-menu-controller.cjs').read_bytes()),fixtureSHA256=sha(p.read_bytes()),contractSHA256=sha((R/'test/fixtures/enigma-presented-menu-contract.json').read_bytes()),resultSHA256=sha(b),results=json.loads(b.splitlines()[-1]),remaining='wiring and replay tests; publication; fresh independent acceptance/runtime'))
print(b.decode()[:8192])

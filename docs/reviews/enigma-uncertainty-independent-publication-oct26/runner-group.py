from common import *
V=R/'docs/reviews'/H.name
# Separate stock fixture: byte-exact handler, no atomic branch transformation.
s=(V/'fixture.cjs').read_text().replace('${parts.handleControlCommand.replace("    if (cmd.action === \'eval\') return controlEval(cmd.code || \'\');",ATOMIC_BRANCH+"    if (cmd.action === \'eval\') return controlEval(cmd.code || \'\');")}','${parts.handleControlCommand}')
assert s!=(V/'fixture.cjs').read_text();(V/'stock-fixture.cjs').write_text(s)
gate('tracked-runner-guards')
b=run([NODE,'--max-old-space-size=192',str(V/'runner-guards.cjs')],cwd=R);(V/'runner-guards-results.json').write_bytes(b)
save('checkpoint-runner.json',dict(candidate=REV,sourceSHA256=sha((R/'tools/enigma-presented-menu-controller.cjs').read_bytes()),trackedRunner=json.load(open(O/'runner-recovery.json')),extraction=json.load(open(O/'runner-extraction.json')),fixtures={p.name:sha(p.read_bytes()) for p in V.glob('*.cjs')},results=json.loads(b),remaining='Publication blocked by exact production wireRunner full-file identity mismatch; no main merge, no runtime readiness',limits='controlled fixture branch insertion is diagnostic only and is not production wireRunner acceptance'))
print(b.decode())
main=g('ls-remote','origin','refs/heads/main').decode().strip();assert main.split()[0]=='7681b752d7c3fe565a49e92832c3d9825bec7ed9'
mainTree=g('ls-tree','7681b752d7c3fe565a49e92832c3d9825bec7ed9','test/run.js',cwd=ROOT).decode().strip()
candidateTree=g('ls-tree',REV,'test/run.js').decode().strip()
assert mainTree==candidateTree
save('main-reconciliation.json',dict(remoteMain=main,mainRunner=mainTree,candidateRunner=candidateTree,runnerSame=True,mainPublished=False,reason='wireRunner full-file pin rejects actual candidate AND current main runner'))

from common import *
gate('verification')
receipt=json.load(open(D.parent/'ops/final-receipt.json'))
assert receipt['commit']==REV
manifest=pathlib.Path(receipt['manifest']); assert sha(manifest.read_bytes())==receipt['manifestSHA256']=='3156de65523ae22ce6ad4f25aeb85f0a01966d8d8d2a34f9d8f3da9c61120642'
m=json.loads(manifest.read_bytes());assert len(m['files'])==34
for p,v in m['files'].items():
 b=(D/p).read_bytes();assert len(b)==v['bytes'] and sha(b)==v['sha256'],p
for p,h in receipt['sourceHashes'].items():assert sha((R/p).read_bytes())==h,p
base=D/'docs/reviews/enigma-atomic-presented-click-repair-oct26'
parts=json.load(open(base/'runner-slices.json'));cp=json.load(open(base/'source-checkpoint.json'))
runner=pathlib.Path('/tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js').read_bytes()
assert sha(runner)==cp['runnerSHA256']
for k,v in cp['slices'].items():
 b=parts[k].encode();start=sum(len(l) for l in runner.splitlines(keepends=True)[:v['startLine']-1])
 assert len(b)==v['bytes'] and sha(b)==v['sha256'] and runner[start:start+len(b)]==b,k
remote=g('ls-remote','origin','refs/heads/'+receipt['branch']).decode().strip();assert remote.split()[0]==REV
save('pins.json',dict(candidate=REV,candidateTree=g('rev-parse','HEAD^{tree}').decode().strip(),sourceHashes=receipt['sourceHashes'],manifestSHA256=sha(manifest.read_bytes()),manifestFiles=34,runnerSHA256=sha(runner),slices=cp['slices'],remote=remote,retainedGroups={'protocol':45,'regression':24,'wiring':9},transcriptionCorrection='Canonical fixture uses ...056f5814..., authoritative receipt and actual file agree; supplied prompt ...056e5814... corrected. Historical source-checkpoint controller hash describes predecessor, not repaired candidate.'))
E=R/'docs/reviews'/H.name;E.mkdir(parents=True,exist_ok=True)
old=pathlib.Path('/tmp/enigma-presented-controller-independent-accept-oct26/repo/docs/reviews/enigma-presented-controller-independent-accept-oct26/independent.cjs').read_bytes()
assert sha(old)=='a04f1938afab1743fdb02a2872567542f7530ef0ff5c6720649adcfd44d6706b'
(E/'unchanged-before-oracle.cjs').write_bytes(old)
save('checkpoint-inputs.json',dict(candidate=REV,pinsSHA256=sha((O/'pins.json').read_bytes()),beforeOracleSHA256=sha(old),result='34 manifest payloads, four source pins, seven exact full slices and candidate remote PASS',remaining='independent focused protocol challenges; publication'))
print('INPUT PINS PASS')

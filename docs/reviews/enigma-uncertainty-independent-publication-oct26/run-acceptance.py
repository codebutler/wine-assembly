from common import *
V=R/'docs/reviews'/H.name
gate('independent-tests')
b=run([NODE,'--max-old-space-size=192',str(V/'acceptance.cjs'),str(O/'tracked-run.js'),'--remaining'],cwd=R)
(V/'independent-results.json').write_bytes(b)
j=json.loads(b);assert j['protocol']=='ACCEPT'
save('checkpoint-independent.json',dict(candidate=REV,sources=json.load(open(O/'checkout.json'))['hashes'],fixtures={str(p.relative_to(R)):sha(p.read_bytes()) for p in V.glob('*.cjs')},slicesSHA256=sha((V/'tracked-runner-slices.json').read_bytes()),resultsSHA256=sha(b),prefixPasses=11,results=len(j['results']),protocol='ACCEPT',remaining='main publication blocked: production wireRunner rejects exact tracked runner; no behavior repair authorized',guestExecutions=0))
print('independent',len(j['results']),'PASS with wiring publication blocker')

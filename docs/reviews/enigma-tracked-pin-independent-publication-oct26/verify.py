from common import *
P=R/'docs/reviews'/H.name;P.mkdir(parents=True)
M=R/'docs/reviews/enigma-tracked-runner-pin-repair-oct26/evidence-manifest.json'
assert sha(M.read_bytes())=='24289f58d43a8e81e58a6715db1fd32356c15d0b1f22694c81b829b663919bbe'
m=json.loads(M.read_text())
for p,row in m['payloads'].items():
 b=(R/p).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256']
for p,h in m['sourceHashes'].items():assert sha((R/p).read_bytes())==h
old=pathlib.Path('/tmp/enigma-uncertainty-independent-publication-oct26/repo/tools/enigma-presented-menu-controller.cjs').read_bytes();new=(R/'tools/enigma-presented-menu-controller.cjs').read_bytes()
a=old.index(b'function wireRunner(');b=old.index(b'function readback(',a);c=new.index(b'function wireRunner(');d=new.index(b'function readback(',c)
assert old[:a]==new[:c] and old[b:]==new[d:]
S=R/'docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-run.js';source=S.read_bytes()
assert g('rev-parse',REV+':test/run.js').decode().strip()=='4b8461338f4bcddde6b5d5504991523b28d3ac35'
assert hashlib.sha1(b'blob '+str(len(source)).encode()+b'\0'+source).hexdigest()=='4b8461338f4bcddde6b5d5504991523b28d3ac35'
parts=json.loads((R/'docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-runner-slices.json').read_text())
recipes=json.loads((R/'docs/reviews/enigma-tracked-runner-pin-repair-oct26/corrected-extraction.json').read_text())['recipes']
for name,row in recipes.items():
 sl=source[row['startByte']:row['endByteExclusive']];assert sl==parts[name].encode() and sha(sl)==row['sha256'];assert source.count(sl)==1
remote=g('ls-remote','origin','refs/heads/task/enigma-tracked-runner-pin-repair-oct26','refs/heads/main').decode().strip();assert REV+'\trefs/heads/task/enigma-tracked-runner-pin-repair-oct26' in remote
save('checkpoint-identities.json',dict(candidate=REV,sourceHashes=m['sourceHashes'],manifestSHA256=sha(M.read_bytes()),payloadsVerified=len(m['payloads']),sourceAndFixtureHashes={str(p.relative_to(R)):sha(p.read_bytes()) for p in [S,R/'docs/reviews/enigma-uncertainty-independent-publication-oct26/tracked-runner-slices.json',R/'docs/re-notes/enigma-start-game-menu-click-api-oct26/predecessor-menu.png']},slices=recipes,safetyBytesUnchanged=True,remote=remote,reusedSupplierGroups=[12,11,3],reusedPriorGroups=[25,45,24,9,10,20],remaining=['independent transformation','independent protocol','fresh main reconciliation','affected merged checks','publication']))
print('IDENTITIES PASS 28 payloads; 9 full slices; safety bytes unchanged')

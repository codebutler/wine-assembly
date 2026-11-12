from common import *
P=R/'docs/reviews'/H.name
src='tools/enigma-presented-menu-controller.cjs';test='test/test-enigma-tracked-runner-wiring.cjs'
old=(D/src).read_bytes();new=(R/src).read_bytes()
# Only wireRunner changed: atomic branch and controller/error handling exact.
a=old.index(b'function wireRunner(');b=old.index(b'function readback(',a)
c=new.index(b'function wireRunner(');d=new.index(b'function readback(',c)
assert old[:a]==new[:c] and old[b:]==new[d:]
for path in ['test/test-enigma-presented-menu-controller.cjs','test/fixtures/enigma-presented-menu-contract.json']:
 assert (R/path).read_bytes()==(D/path).read_bytes()
assert g('ls-remote','origin','refs/heads/task/enigma-uncertainty-independent-publication-oct26').decode().split()[0]==REV
gate('prepublication')
g('add','--',src,test);g('diff','--cached','--check')
tested=g('write-tree','--missing-ok').decode().strip()
changes=g('diff-tree','--no-commit-id','--name-only','-r',REV,tested).decode().splitlines();assert sorted(changes)==sorted([src,test])
save('source-tree.json',dict(base=REV,testedSourceTree=tested,changedPaths=changes,controllerSHA256=sha(new),testSHA256=sha((R/test).read_bytes()),unchanged='all bytes before wireRunner and from readback through controller end; existing focused test/contract unchanged'))
(P/'README.md').write_text('''# Exact tracked Enigma runner pin repair — candidate only

Base `b5b4b2b8da9da56b189ab4417896e9b7b76b35a8`. Production `wireRunner` now requires the actual tracked candidate/current-main runner SHA-256 `87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7`, Git blob `4b8461338f4bcddde6b5d5504991523b28d3ac35`, 687226 bytes. It no longer requires the historical donor pin. No arbitrary hashes are accepted. The exact single marker guard and byte-preserving insertion are unchanged. `test/run.js` is not rewritten. The unchanged call `wireRunner(fs.readFileSync(actualTrackedRunner,'utf8'))` now produces derivative SHA-256 `a9625e1d102883c27b1bd2de0bab560a44ab3bc7eb589b18e7a736100eb2a0da`, 688600 bytes, inserting 1374 bytes at UTF-8 offset394820.

All bytes before wireRunner and from readback through controller end are identical to the accepted base. Atomic validation and canonical parsed enqueue remain one synchronous branch; existing queues are preserved. Presentation identity/drift guards and consumed/no-replay behavior remain. Successful acknowledgement proves enqueue only; ambiguous postdispatch acknowledgement is unknown; known predispatch refusal is not-dispatched. Existing focused test and contract are unchanged.

New affected checks: 12 exact-source transformation checks; 11 boundary/stock controls; 3 production-wired protocol groups. Changed, malformed, missing/duplicate marker, missing parser/presentation hook, already-wired and absent source reject. Full-file identity rejects these before unsafe transformation. The source-backed fixture extracts the handler from the actual production wireRunner output and compares it byte-for-byte to the previously independently tested manual insertion, then runs the actual retained parser and drain/click blocks with mock renderer sinks. Checks cover normal enqueue/drain preserving due and future events, lost-envelope unknown/consumed/no replay, known predispatch refusal, batch/frozen/credits/recording/count/identity/missing/wrapper/prepared/extra-paint guards, and unsupported stock failclosed. No guest execution, full runner initialization, actual delivery or gameplay is established.

Reuse exact prior25 independent passes and45/24/9/10/20 groups, without replay. Only affected wiring/protocol checks ran. Prior retained manifest `24fe4109c87b6249d26ca9ee5beb7c71bd84d986f4b769150597ecd5227bbd4d` binds the unchanged supplier evidence. The malicious getter diagnostic remains outside the trusted ordinary-object contract and remains disclosed in the prior review; no stronger getter safety is claimed.

Incident: the first extraction assertion stopped before tests because historical startByte/endByteExclusive fields are JS string coordinates, not UTF-8 byte coordinates. Unique exact-byte search confirmed every full retained slice length/hash; corrected UTF-8 coordinates are in corrected-extraction.json. This changed no production oracle or input. Publication staging first refused the new owned test because its explicit sparse pattern was missing; added that one path before staging again, unchanged sources/tests and no test replay. Earlier broad tool-output reads were truncated by capture; policy and dependencies were subsequently read in focused complete captures. No access/resource denial occurred.

Each affected test group has a durable hash-bound checkpoint. Node24 --max-old-space-size=192 startup uses the same executable/environment/CPU90s/wall120s/file24MiB supervisor; actual inherited limits retained. The heap flag is not a total process cap. Git DATA536870912 applies only to Git children. Fresh physical admission includes existing live RSS in MemAvailable without subtracting it again, 2415919104-byte light allowance gate; minimum40MiB conservative disk projection includes all task copies/Git/temp/evidence/launcher/session/positive WAL once/future plus8MiB reserve inside64MiB, host-after floor2982150144. Standing installed Node and readonly donor are separately measured. No link accounting evasion. Trusted dedicated SSH and canonical empty mount argv receipt retained; root ref digest reused without capturing full refs.

This is a repaired candidate, not independent acceptance or MAIN/runtime success. No MAIN authorization or changes, box assignment, runtime/guest/native/build/browser/Boat/boxSSH/acquisition/public deployment/service/restart/Telegram/workers. No box contacted, expiryNONE, lifecycle coordinator. Remaining: fresh independent acceptance, separately authorized integration/merged validation and publication, clean real runtime queue, actual runtime delivery and gameplay.
''')
for p in list(O.iterdir()):
 if p.is_file() and p.suffix in ['.json','.jsonl','.py'] and p.name not in ['db-baseline.json','watcher.json','final-receipt.json']:
  shutil.copyfile(p,P/p.name)
payloads={str(p.relative_to(R)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(P.iterdir()) if p.is_file() and p.name!='evidence-manifest.json'}
manifest=dict(base=REV,testedSourceTree=tested,sourceHashes={src:sha(new),test:sha((R/test).read_bytes())},verdict='REPAIRED_CANDIDATE_REQUIRES_INDEPENDENT_ACCEPTANCE',payloads=payloads)
(P/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
g('add','--','docs/reviews/'+H.name);g('diff','--cached','--check')
tree=g('write-tree','--missing-ok').decode().strip()
paths=g('diff-tree','--no-commit-id','--name-only','-r',REV,tree).decode().splitlines();assert all(p in [src,test] or p.startswith('docs/reviews/'+H.name+'/') for p in paths)
delta=g('diff-tree','--no-commit-id','--name-only','-r',tested,tree).decode().splitlines();assert all(p.startswith('docs/reviews/'+H.name+'/') for p in delta)
commit=g('commit-tree',tree,'-p',REV,input=b'fix(enigma): pin atomic wiring to exact tracked runner\n').decode().strip();g('update-ref','refs/heads/'+BR,commit,REV)
g('push','origin','HEAD:refs/heads/'+BR)
remote=g('ls-remote','origin','refs/heads/'+BR).decode().strip();assert remote.split()[0]==commit
for p,h in manifest['sourceHashes'].items():assert sha(g('show',commit+':'+p))==h
for p,row in payloads.items():assert sha(g('show',commit+':'+p))==row['sha256']
assert sha(g('show',commit+':docs/reviews/'+H.name+'/evidence-manifest.json'))==sha((P/'evidence-manifest.json').read_bytes())
gate('published')
save('final-receipt.json',dict(verdict=manifest['verdict'],commit=commit,branch=BR,remote=remote,verified=True,base=REV,sourceHashes=manifest['sourceHashes'],runnerSHA256='87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7',derivativeSHA256='a9625e1d102883c27b1bd2de0bab560a44ab3bc7eb589b18e7a736100eb2a0da',manifest=str(P/'evidence-manifest.json'),manifestSHA256=sha((P/'evidence-manifest.json').read_bytes()),payloads=len(payloads),testedSourceTree=tested,publishedTree=tree,treeRelation='only own evidence added after source test tree; exact two source/test paths differ from base',changedPaths=paths,newTests=dict(wiring=12,boundaryAndStock=11,protocolGroups=3),reused=[25,45,24,9,10,20],resources=json.load(open(O/'admission-published.json')),incidents=['historical JS offsets mislabeled bytes; unique exact slices verified and corrected; first assertion before tests retained in corrected-extraction.json','new focused test initially omitted from sparse patterns; added exact owned path before staging; first Git stderr retained','early read-output truncation resolved by focused complete captures'],remaining=['fresh independent acceptance','authorized integration/merged validation/MAIN publication','clean runtime queue','authentic runtime/delivery/gameplay'],box=dict(id=None,state='unassigned/not contacted',expiry=None,lifecycleOwner='coordinator'),ownership='released files STOP'))
print(json.dumps(dict(commit=commit,remote=remote,manifestSHA256=sha((P/'evidence-manifest.json').read_bytes()),payloads=len(payloads))))

from common import *
P=R/'docs/reviews'/H.name
m=json.load(open(O/'checkpoint-merged-validation.json'));i=json.load(open(O/'checkpoint-merged-tree.json'));main=m['main'];tested=m['testedMergedTree']
assert g('write-tree','--missing-ok').decode().strip()==tested
assert g('ls-remote','origin','refs/heads/main').decode().split()[0]==main
gate('freeze-evidence')
(P/'README.md').write_text('''# Enigma tracked runner: independent acceptance and selective main integration

Accepted exact candidate `36ce9d8382ebd013f1b8cc3b22e5162f27c9fde7` offline. Independently verified the supplied manifest SHA-256 `24289f58d43a8e81e58a6715db1fd32356c15d0b1f22694c81b829b663919bbe`, all 28 payloads, both source pins, nine complete source slices and exact tracked runner Git blob `4b8461338f4bcddde6b5d5504991523b28d3ac35`. All bytes outside wireRunner are identical to the previously accepted uncertainty controller. Existing test/contract and atomic presentation validation, canonical parsing and single enqueue semantics are unchanged.

New independent groups: 13 transformation assertions, 9 protocol scenarios and 7 acknowledgment scenarios PASS. These challenge whole-file UTF-8 byte preservation, a single 1374-byte insertion at byte394820, equal-length/wrong-Unicode source substitutions, malformed/missing/duplicate hooks, missing and invalid source types, canonical actual parser/production-wired handler/drain, preservation of due/future queue entries, final batch/credits/frozen/recording/prepared/repaint/witness/count guards, truthful ambiguity after six lost/malformed acknowledgments, consumed controller/direct replay rejection, and known predispatch refusal. The exact main runner SHA-256 `87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7` yields derivative SHA-256 `a9625e1d102883c27b1bd2de0bab560a44ab3bc7eb589b18e7a736100eb2a0da`, 688600 bytes. No full runner startup or guest execution occurred. Acknowledgment proves enqueue; the actual source drain is run only against mock mouse sinks. No actual delivery or gameplay is established. The prior malicious-getter diagnostic remains explicitly outside the trusted ordinary-object contract; no stronger getter safety is claimed.

Reused without replay: supplier12 wiring/11guards/3protocol groups, prior25 independent and45/24/9/10/20 groups. Checkpoint files retain exact tested input and fixture hashes after every completed group. A mock harness brace error stopped the protocol group before assertions; corrected the harness closure and expected canonical mouse button1, without changing the source oracle. Its first stderr is retained. The transformation group was not repeated; fixture-correction.json verifies its tested section was byte-identical across the unrelated harness correction.

Fresh remote main was `7681b752d7c3fe565a49e92832c3d9825bec7ed9`. Its actual test/run.js is exactly the accepted pin. Candidate history diverged in unrelated areas: integration builds from the exact main tree, adding only the four accepted controller/test/contract files, the predecessor-menu PNG and six focused Enigma review directories from the accepted chain (180 additions). It preserves all unrelated main entries. The four accepted source/test additions have an exact retained diff. Earlier Enigma runtime directories are not imported; only the immutable PNG test fixture is included. Own independent tests/evidence are the only additional changes. No main conflict is silently resolved, no arbitrary runner hash accepted and no unrelated source repair is included.

The merged dependency blobs are identical to the accepted candidate. Affected merged validation PASS: five syntax checks, production transformation against actual current-main test/run.js, parse-only compilation of its derivative, and whitespace checks of the four source/test additions plus owned evidence. Earlier behavioral passes remain applicable by exact dependency identity rather than being replayed for packaging. Final published tree differs from testedMergedTree only in this owned review directory; all 180 selected accepted paths and all unrelated main bytes are preserved. Publication receipts outside this frozen manifest record exact task/main refs and final tree after push.

Incidents: first main object lookup was absent locally; retained the diagnostic and used trusted, shallow blob-filtered Git fetch into this isolated repository, leaving the root and donors unchanged. The initial selection count included older existing Enigma reviews; assertion stopped before index mutation, then selection was narrowed to the exact six newly accepted review directories. A broad reconciliation diagnostic exceeded the preferred excerpt size in the tool display; full bounded inventory remains in main-reconciliation-inventory.json. A tool-call JavaScript syntax error executed no command; the board append was then issued once successfully. No access/resource denial occurred, and no completed acceptance group was duplicated.

All new task/Git/temp/evidence/launcher/session/positive WAL growth once, future allowance and8MiB reserve fit the conservative40MiB projection inside64MiB. Host-after floor2982150144B and physical admission2415919104B were checked at each execution stage; existing live RSS is already reflected in MemAvailable, not subtracted again. Installed Node and readonly donors are standing inputs, measured separately. No link accounting evasion. Node24 exact executable/heap192/environment/CPU90s/wall120s/file24MiB startup and inherited limits are retained; DATA536870912 applies only to Git children. The heap flag is not a total process cap. Exact trusted dedicated Git SSH and canonical empty mount argv were verified in this task, reusing the coordinator root ref digest without capturing full refs.

No root dirty WIP/source/ref changes, workers, Claude work, runtime/guest/native/build/browser/Boat/boxSSH/acquisition/public deployment/service/restart/Telegram actions. No assigned/contacted box, expiryNONE, lifecycle coordinator. Remaining gates are separately authorized clean-runtime-queue, runtime delivery and gameplay qualification. This acceptance/publication does not certify those outcomes.
''')
# Keep durable immutable snapshots, excluding private lifecycle/accounting scratch
# and the later final receipt, which would otherwise be self-referential.
for p in O.iterdir():
 if p.is_file() and (p.suffix in ['.json','.jsonl','.py','.diff']) and p.name not in ['db-baseline.json','watcher.json','final-receipt.json']:
  shutil.copyfile(p,P/p.name)
sourcePaths=i['sourcePaths'];sources={p:sha((R/p).read_bytes()) for p in sourcePaths}
payloads={str(p.relative_to(R)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(P.iterdir()) if p.is_file() and p.name!='evidence-manifest.json'}
manifest=dict(verdict='ACCEPTED_OFFLINE_MERGED_VALIDATED',candidate=REV,mainBefore=main,testedMergedTree=tested,sourceHashes=sources,runnerSHA256='87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7',derivativeSHA256='a9625e1d102883c27b1bd2de0bab560a44ab3bc7eb589b18e7a736100eb2a0da',payloads=payloads,newIndependentGroups=[13,9,7],reused=dict(supplier=[12,11,3],prior=[25,45,24,9,10,20]),remaining=['verify task branch publication','fresh exact main fast-forward publication','separately authorized runtime/actual delivery/gameplay'])
(P/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
g('add','--sparse','--','docs/reviews/'+H.name)
tree=g('write-tree','--missing-ok').decode().strip()
# Only own evidence additions occurred after the tested tree; tested test remains
# identical and no unrelated file is changed relative to exact remote main.
delta=g('diff-tree','--no-commit-id','--name-only','-r',tested,tree).decode().splitlines();assert all(p.startswith('docs/reviews/'+H.name+'/') for p in delta)
changed=g('diff-tree','--no-commit-id','--name-status','-r',main,tree).decode().splitlines()
assert all(x.startswith('A\t') and (x.split('\t')[1] in i['selected'] or x.split('\t')[1].startswith('docs/reviews/'+H.name+'/')) for x in changed)
for p in i['selected']:assert g('rev-parse',tree+':'+p)==g('rev-parse',REV+':'+p)
g('diff','--check',main,tree,'--',*sourcePaths,'docs/reviews/'+H.name)
# A reviewed selective merge: exact current main is first parent; accepted
# candidate is second parent so remote already-owned immutable evidence retains
# ancestry without importing its unrelated tree changes.
commit=g('commit-tree',tree,'-p',main,'-p',REV,input=b'Merge accepted Enigma tracked-runner controller and focused evidence\n\nPreserve current main; pin atomic wiring to exact tracked runner.\n').decode().strip()
g('update-ref','refs/heads/'+BR,commit,REV)
save('checkpoint-local-commit.json',dict(commit=commit,branch=BR,parents=[main,REV],testedMergedTree=tested,publishedTree=tree,postTestChangesOnlyOwnEvidence=delta,sourceHashes=sources,manifestSHA256=sha((P/'evidence-manifest.json').read_bytes()),remaining=['push task branch','fresh main compare','push main','verify both remote refs']))
gate('task-push')
g('push','origin','HEAD:refs/heads/'+BR)
remote=g('ls-remote','origin','refs/heads/'+BR,'refs/heads/main').decode().strip()
assert commit+'\trefs/heads/'+BR in remote
save('checkpoint-task-published.json',dict(commit=commit,branch=BR,remote=remote,remaining=['fresh main compare','push main','verify both refs']))
assert main+'\trefs/heads/main' in remote,'Main moved after review; STOP without main push'
# Ordinary fast-forward push rejects any concurrent incompatible main movement.
g('push','origin','HEAD:refs/heads/main')
remote=g('ls-remote','origin','refs/heads/'+BR,'refs/heads/main').decode().strip()
assert commit+'\trefs/heads/'+BR in remote and commit+'\trefs/heads/main' in remote
for p,h in sources.items():assert sha(g('show',commit+':'+p))==h
for p,row in payloads.items():assert sha(g('show',commit+':'+p))==row['sha256']
assert sha(g('show',commit+':docs/reviews/'+H.name+'/evidence-manifest.json'))==sha((P/'evidence-manifest.json').read_bytes())
gate('published')
save('checkpoint-main-published.json',dict(commit=commit,branch=BR,main=commit,remote=remote,testedMergedTree=tested,publishedTree=tree,manifestSHA256=sha((P/'evidence-manifest.json').read_bytes()),remaining=['separately authorized clean runtime queue/runtime/delivery/gameplay'],blockers=[]))
save('final-receipt.json',dict(verdict='ACCEPTED_OFFLINE_MERGED_VALIDATED_PUBLISHED_MAIN',candidate=REV,commit=commit,branch=BR,main=commit,remote=remote,remoteVerified=True,parents=[main,REV],sourceHashes=sources,runnerSHA256=manifest['runnerSHA256'],runnerBlob='4b8461338f4bcddde6b5d5504991523b28d3ac35',derivativeSHA256=manifest['derivativeSHA256'],manifest=str(P/'evidence-manifest.json'),manifestSHA256=sha((P/'evidence-manifest.json').read_bytes()),payloadsVerified=len(payloads),testedMergedTree=tested,publishedTree=tree,treeRelation='only owned review evidence added after merged tested tree; all180 accepted candidate additions identical; all unrelated main entries preserved',newIndependentGroups=[13,9,7],mergedChecks=dict(syntaxFiles=5,actualMainTransform=True,derivativeParseOnly=True,whitespace=True),reused=manifest['reused'],resources=json.load(open(O/'admission-published.json')),incidents=['protocol harness brace syntax stopped before assertions, corrected fixture only; original transform section unchanged and no replay','remote main object absent locally resolved own shallow filtered trusted fetch','overbroad selection count rejected before mutation then six exact review directories selected','bounded reconciliation display exceeded preferred excerpt size','tool-call JS syntax error executed no command before successful append'],remaining=['separately authorized clean runtime queue/runtime/delivery/gameplay'],box=dict(id=None,state='unassigned/not contacted',expiry=None,lifecycleOwner='coordinator'),ownership='release MAIN and owned files; STOP'))
print(json.dumps(dict(commit=commit,branch=BR,remote=remote,manifestSHA256=sha((P/'evidence-manifest.json').read_bytes()),payloads=len(payloads),publishedTree=tree)))

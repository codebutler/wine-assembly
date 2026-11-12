from common import *
V=R/'docs/reviews'/H.name
gate('prepublication')
# Confirm all source pins and exact original fixture before evidence-only publication.
receipt=json.load(open(D.parent/'ops/final-receipt.json'))
assert receipt['commit']==REV
assert sha(pathlib.Path(receipt['manifest']).read_bytes())==receipt['manifestSHA256']
for p,h in receipt['sourceHashes'].items():assert sha((R/p).read_bytes())==h
save('pins.json',dict(candidate=REV,candidateTree=g('rev-parse',REV+'^{tree}').decode().strip(),sourceHashes=receipt['sourceHashes'],repairManifestSHA256=receipt['manifestSHA256'],reusedRootVerification=str(ROOT/'scratch/usage-watch/enigma-uncertainty-root-closeout-oct26.json'),reusedGroups={'originalAtomicProtocol':45,'originalCombined':24,'originalWiring':9,'repairFocused':10,'repairUnchangedProtocol':20},historicalRunner='423b40d4c00f01e3dbfa9ba1bcfdcfa249d07e2e (historical receipts only, NOT actual-runner compatibility)',originalInputs={p:sha((R/p).read_bytes()) for p in ['docs/reviews/enigma-atomic-click-independent-accept-oct26/fixture.cjs','docs/reviews/enigma-atomic-click-independent-accept-oct26/challenges.cjs','docs/reviews/enigma-atomic-click-independent-accept-oct26/unchanged-before-oracle.cjs','docs/reviews/enigma-atomic-presented-click-repair-oct26/runner-slices.json']}))
s=(O/'tracked-run.js').read_text();parser=s[s.index('const getArg ='):s.index('// Was `--name=...`')]
conf=json.load(open(O/'configuration.json'));assert sha(parser.encode())==conf['parserSHA256'];conf['actualTrackedRunnerParserIdentical']=True;conf['actualTrackedRunnerSHA256']=sha(s.encode());save('configuration.json',conf)
save('incidents.json',[
 {'kind':'internal sparse historical input selection','firstFailure':'cat-file c0864414cc80d1c27cdc0936f64aa2e86c09a0ca bad file','resolution':'selected only required original immutable review paths; no production changes; first setup/failures preserved'},
 {'kind':'tracked runner absent from root immutable object store','firstFailure':json.load(open(O/'runner-root-object-probe.json')),'resolution':'bounded immutable GitHub exact candidate source recovery, verified Git blob and full SHA; not substituted historical donor'},
 {'kind':'independent fixture phase expectation','firstFailure':'lateBatch expected ENIGMA_NOT_DISPATCHED, actual ENIGMA_ENQUEUE_OUTCOME_UNKNOWN','resolution':'lateBatch mutation precedes cleanup but cleanup prepares, controller invokes atomic request; this is after dispatch, so conservative unknown is correct. First11 sequential successful cases retained through first failure and exact fixture SHA, remaining4 only executed after expectation correction; no earlier group replay/oracle weakening'},
 {'kind':'main immutable local commit absent','firstFailure':'git ls-tree exact main failed not a tree object','resolution':'same exact main source resolved via immutable URL; blob+SHA independently matched candidate, no unchanged retry'},
 {'kind':'semantic publication gate','firstFailure':'wireRunner actual tracked source identity mismatch','resolution':'UNRESOLVED. No production fix authorized. Main publication STOPPED; no merged-tree/runtime acceptance claimed'}])
# Retain recipes, successful checkpoints, exact first failures and extracted source.
for p in O.iterdir():
 if p.is_file() and (p.suffix in ['.json','.jsonl','.py'] or p.name=='tracked-run.js') and p.name not in ['db-baseline.json','watcher.json']:
  shutil.copyfile(p,V/p.name)
(V/'README.md').write_text('''# Enigma final-dispatch uncertainty independent acceptance

Candidate `5093c90b5ea7e501a8f77c78cec937f6bcf486f3` is ACCEPTED for the narrow offline uncertainty behavior. Main publication is BLOCKED by actual tracked-runner identity. No production source changed in this review.

The exact candidate/main `test/run.js` is blob `4b8461338f4bcddde6b5d5504991523b28d3ac35`, 687226 bytes, SHA-256 `87ab63d768eb59a09a8b69df2ccb3843270dd867a67405abd82f02c25c1628e7`. The production `wireRunner()` requires historical SHA `4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809` and rejects the actual tracked source. The unchanged callable reproducer is `wireRunner(fs.readFileSync(actualTrackedRunner, 'utf8'))`; `acceptance.cjs` records the exact assertion. The canonical stock handler rejects the unsupported atomic action without enqueue. Changing the pin or widening trusted sources belongs to a new production repair and independent qualification.

New evidence: 25 passing bounded checks plus one expected failing production-wiring gate, in 26 distinct cases. The first invocation completed eleven sequential strict awaited cases before a review-fixture phase expectation failed on lateBatch. It had already called the atomic action, so unknown is the correct classification. The exact first fixture, its SHA and stderr are preserved; the remaining four cases alone ran after that correction. The separate eleven-case actual-runner group passed. `checkpoint-independent-prefix.json`, `checkpoint-independent.json` and `checkpoint-runner.json` preserve each group; do not mistake the failed initial process for a full passing invocation.

The original lost-reply fixture is imported unchanged from the prior independent acceptance directory. It queues once, now reports ENIGMA_ENQUEUE_OUTCOME_UNKNOWN / unknown, and rejects both controller reuse and atomic replay. Eight additional ambiguous replies against actual tracked handler/parser excerpts are unknown and consumed. Cleanup rejection and lost witness reject before dispatch with ENIGMA_NOT_DISPATCHED / not-dispatched. An acknowledged response establishes enqueue only. Boundary drift controls cover batch, frozen state, credits, recording, count, identity, missing state, replaced wrapper, prepared state and extra paint. Preexisting due and future inputs remain ordered; no queue is cleared.

`tracked-runner-slices.json` and `runner-extraction.json` retain complete actual functions/blocks, byte offsets, line ranges, exact hashes and ordered extraction recipe. Fixture branch insertion is explicitly diagnostic and is not successful production wiring. The actual drain prefix and exact click body run with mocked renderer mouse sinks and schedule trace; the intervening unrelated action chain, full runner startup, control server, guest execution and real renderer delivery are not qualified. The trusted-object/no-malicious-accessor contract is unchanged. The prior adversarial getter diagnostic remains disclosed and excluded; synchronous dispatch alone is not proof of safety with malicious accessors.

Prior exact-revision 45 protocol +24 combined +9 wiring groups and repair 10 focused +20 unchanged protocol receipts are retained without replay. Historical wiring receipts refer only to the historical runner. Reuse bindings are in pins.json and the supplied root closeout; no runner compatibility is inferred from them.

Main was freshly reconciled as `7681b752d7c3fe565a49e92832c3d9825bec7ed9`; its exact immutable runner bytes match the candidate. No merge or affected merged-tree checks ran because the prerequisite production runner gate failed. This task branch adds evidence only to the pinned candidate tree. Main remains untouched.

Resources: LIGHT physical-memory admission 2415919104 bytes, Git-only DATA 536870912, CPU90s/wall120s/file24MiB/output2MiB, Node24 in place --max-old-space-size=192. Actual inherited Node limits and exact argv/environment are in node-startup.json; the heap flag is not a total-process cap. Accounting includes checkout/Git/evidence/launcher/session/positive WAL once/future+8MiB reserve, projected minimum40MiB under64MiB and host-after floor2982150144. No runtime/build/browser/box/services/acquisition of games/deployment/Telegram/credentials/trust changes/workers. No box assigned/contacted, expiry NONE, lifecycle coordinator.

Remaining gates: production runner repair/qualification and then affected merged-tree acceptance/publication; clean preexisting runtime queue; separately authorized authentic runtime; actual delivery; gameplay. A scheduled input and mocked mouse calls prove neither delivery nor gameplay. MAIN/files ownership released after evidence-only push verification; STOP.
''')
# Strip copied transient __pycache__ never included. Hash payloads before manifest to avoid self-reference.
payloads={str(p.relative_to(R)):dict(bytes=p.stat().st_size,sha256=sha(p.read_bytes())) for p in sorted(V.iterdir()) if p.is_file() and p.name!='evidence-manifest.json'}
(V/'evidence-manifest.json').write_text(json.dumps(dict(candidate=REV,verdict='ACCEPT_UNCERTAINTY_BLOCK_PUBLICATION_TRACKED_RUNNER',payloads=payloads),indent=2)+'\n')
g('diff','--check');status=g('status','--porcelain','--untracked-files=all').decode();assert all(line[3:].startswith('docs/reviews/'+H.name+'/') for line in status.splitlines()),status
save('precommit.json',dict(changedPaths=status.splitlines(),sourceHashes=receipt['sourceHashes'],manifestSHA256=sha((V/'evidence-manifest.json').read_bytes())))
print('EVIDENCE READY',len(payloads),'payloads')

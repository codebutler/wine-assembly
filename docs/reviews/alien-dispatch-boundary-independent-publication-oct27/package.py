from control import *
gate('before-publication-package')
assert (O/'preintegration-main-output.log').read_text().strip()==MAIN+'\trefs/heads/main'
assert not (O/'candidate-source-identity-output.log').read_bytes()
cp=json.load(open(O/'checkpoint.json'));assert cp['verdict']=='ACCEPT_BOUNDED_OBSERVATION_REPAIR'
D=R/'docs/reviews'/NAME;D.mkdir(parents=True,exist_ok=True)
selected=['review.json','pins.json','configuration.json','checkpoint.json','incidents.json','retained-groups-reviewed.json','dispatch-boundary-receipt.json','independent-latch-positive.json','independent-latch-mutant.json','control.py','prepare.py','first.py','accept.py','package.py','db-baseline.json']
selected += [n+s for n in ['node-startup','empty-mount-parser','first-production','independent-focused','acceptance-decision','prepare','prepare-streaming','candidate-identity','remote-pins','candidate-source-identity','preintegration-main'] for s in ['-execution.json','-output.log']]
selected += ['admission-initial.json','admission-before-selective-materialization.json','admission-first-production.json','admission-independent-focused.json','admission-before-publication-package.json']
manifest={}
for n in selected:
 p=O/n;data=p.read_bytes();(D/n).write_bytes(data);manifest[n]=dict(bytes=len(data),sha256=c.sha(data))
save('publication-package.json',dict(files=manifest,sourceClosure=json.load(open(O/'pins.json'))['sourcePins'],newIndependentTestSHA256=c.sha((R/'test/test-alien-dispatch-independent-oct27.py').read_bytes())))
(D/'evidence-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(D/'README.md').write_text('''# Alien dispatch boundary independent acceptance and integration

Verdict: ACCEPT the bounded observation repair at candidate
`18d369e8677330b241b5a69603e6e204d0446e33`, tree
`aee56dccfac30ac970d4504133c1edb2fe993695`. Production helper SHA256:
`db75a7f3316be2c919b55423c0275c5e4fe544f5c4b50eed60372d3a98167d39`.

First acceptance ran the actual tracked CLI main with the unchanged independent
reproducer SHA256 `c009312a10ca4e05df15c9375e77cdf92f789d25923542ab4d2d685b3a0abc2a`
and real lib/control-server.js HTTP fixture. Original assertions passed: snapshot
only, next1, pending PNG after durable intent and terminal publication, no restart
send. Its historical rejection-mode driver returns1 on success; first.py checks
the original receipt and assertions without changing the reproducer.

Three new independent tests cover disabled-by-default CLI and offline collection
without constructing control; atomic external-terminal rename plus failed terminal
latch storage, with zero HTTP bytes, pending uncertain intent and restart refusal
even after terminal removal; and rejection of the same oracle when the final HTTP
guard is removed from an in-memory helper copy. Candidate disk source is unchanged.
The mutant sends the snapshot and actual HTTP bytes, so the oracle discriminates.

Reviewed and reused retained exact helper receipts: all30 HTTP positions (ten
commands at durable intent, request prepared, connected before bytes), ten custom
transport positions, partial headers, four process exits, lock/malformed controls,
default-off, eight unit and three production regressions, historical ACK4650 vs
terminal4754 partial104/unACK256 never replayed, and both source omission controls.
No repeated full groups. Fixture before partial extension SHA23ba75c2 is distinct
from final fixture SHA7728be1d; retained-groups-reviewed.json binds both and logs.
Root verified174 original payloads; this review additionally hashes inspected group
logs against the original manifest. Durable original evidence remains published at
task/alien-terminal-dispatch-boundary-repair-oct26, docs/reviews/
alien-terminal-dispatch-boundary-repair-oct26; it is not broadly copied here.

Integration starts from freshly verified main ddaff339bd7e1b10b2579a7ab7aed71d86d8edcd.
Main did not yet contain the seven Alien controller/CLI/fixture/test closure files;
they are added byte-for-byte from the accepted candidate, together with the new
independent tests and this evidence. lib/control-server.js is already identical.
No src, runtime runner, production server, historical fixture bytes or unrelated
tree entry is changed. A merged-tree source/index comparison binds the tested
eight-file closure and new test to the committed tree; unchanged receipts suffice
without rerunning groups solely for another receipt. Final tree/ref verification
is retained in external ops/publication.json and the append-only messageboard.

The ledger flock does not serialize an independent terminal writer. Publication
can race between final observation and socket write. Partial headers may already
be sent; body refusal and no command callback are not zero-wire dispatch. No atomic
writer/send, exhaustive concurrent-writer, filesystem powerloss, guest-lifecycle
or gameplay guarantee is claimed. Input ACK means queued, never guest acceptance.
Production CLI stays explicitly enabled, disabled by default.

Every local command uses the shared pool and installed physical supervisor:128MiB
test/controller tree, Git256MiB with both permits then Git flock, DATA512MiB on Git
subprocess only; CPU90/wall120/file24MiB/output2MiB/excerpt8192. Exact Node24.18.1
heap64 startup has unlimited inherited DATA/AS. RSS sampling includes supervisors
and descendants and is not an exhaustive instantaneous peak proof. Original donor
134811648>134217728 incident remains; its fix used exec, not a cap increase. This
task also retains prepare135004160>134217728: hashing the large installed Node
binary with read_bytes hit the same cap; streaming file_digest passed unchanged
limits. The first behavioral acceptance group passed and was not rerun.

Complete48MiB allocation includes16MiB minimal Git/source/tests/evidence,
16MiB session/events/positive WAL growth once,8MiB publication,8MiB reserve.
Standing read-only donor objects/tools execute in place; no hidden copies.
Each operation retains fresh host/peer disk and RAM admission. Dirty root, GL and
Enigma ownership, Claude idle, HeroesII laptop and actual CivII/Maelstrom platform
denials are preserved. No workers, runtime, guest, browser, native compilation,
Boat operations, services, deployments or trust changes. No box assigned or
queried; coordinator owns existing boxes and lifecycle. Gameplay remains unknown.
''')
print('Packaged only focused task evidence and exact accepted source closure.')

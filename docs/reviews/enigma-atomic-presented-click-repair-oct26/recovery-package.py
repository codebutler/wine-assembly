from common import *
import shutil
P=R/'docs/reviews'/H.name
# Independently verify every retained full source slice against exact source bytes.
b=pathlib.Path('/tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js').read_bytes();lines=b.splitlines(keepends=True)
slices=json.load(open(P/'runner-slices.json'));cp=json.load(open(P/'source-checkpoint.json'))
for n,v in cp['slices'].items():
 raw=b''.join(lines[v['startLine']-1:])[:v['bytes']]
 assert sha(raw)==v['sha256'] and raw==slices[n].encode(),n
save('slice-verification.json',dict(runnerSHA256=sha(b),allSevenFullSlices=True,sourceCheckpointSHA256=sha((P/'source-checkpoint.json').read_bytes())))
incidents=[dict(operation='staged whitespace check',failure='test/test-enigma-presented-menu-controller.cjs:113 trailing whitespace; exit2',resolution='Whitespace removed; affected24-test group passed; first failure retained in ops/failures.jsonl'),dict(operation='wiring fixture first execution',failure="SyntaxError: Unexpected token '/' at wiring-controls.cjs:28; nested quote in unused stock-prefix construction",resolution='Removed unused string constructions; unchanged controls passed; no production fault or resource/access denial'),dict(operation='revalidation after observer lifetime correction',detail='Kept wrapper installed until atomic operation, added extra repaint boundary controls; reran affected groups. Test generator unnecessarily reran the unchanged baseline once; final before output byte-identical, no guest execution.')]
(P/'incidents.json').write_text(json.dumps(incidents,indent=2)+'\n')
for n in ['pins.json','configuration.json','node-startup.json','checkout.json','before-checkpoint.json','test-checkpoint.json','combined-checkpoint.json','wiring-checkpoint.json','slice-verification.json','admission-initial.json','admission-wiring.json']:
 shutil.copyfile(O/n,P/n)
# Byte-exact rejected before oracle retained. Its expected unsafe assertions are
# intentionally unchanged; repaired.cjs is the separate after acceptance oracle.
assert sha((P/'unchanged-independent.cjs').read_bytes())=='a04f1938afab1743fdb02a2872567542f7530ef0ff5c6720649adcfd44d6706b'
(P/'README.md').write_text('''# Atomic presented-menu click repair — candidate for independent acceptance

Parent: `90a65119543037f17f5db17a2ef00880fc659c30`. Independent rejection evidence:
`6e3e457bd99660947f688125aab504231c711c51`. No main integration or runtime execution.

Missing/replaced global ownership now rejects. A non-writable wrapper property
retains the original ownership record, permitting safe restoration when the global
witness is deleted or replaced. A foreign replacement repaint is never overwritten.
The observer remains installed through cleanup preparation until atomic validation,
so an extra repaint between preparation and enqueue increments the observed count.
The runner-owned synchronous branch validates batch, frozen, zero credits, no
recording, prepared ownership identity, current wrapper and exactly one repaint,
restores repaint, consumes the witness and splices one canonical parsed click into
the scheduled queue. Replay cannot enqueue again. All failure paths restore a
verifiably owned wrapper when an operation reaches the runner. A permanently lost
transport cannot promise remote restoration; it never authorizes sending input.

The canonical runner, emulator, game, PNG and historical single-frame allowance
are unchanged. A stock runner rejects the new action without queuing. Integration
requires the exact identity-checked one-insertion wiring recipe below; another
snapshot or an eval-only adaptation does not provide this atomicity.

## Evidence

- `unchanged-independent.cjs` is byte-exact independent before oracle SHA256
  a04f1938afab1743fdb02a2872567542f7530ef0ff5c6720649adcfd44d6706b.
  `before.jsonl` retains its two unsafe injected reproductions on the unchanged
  donor: lostWitness queues1/leaves wrapper; lateBatch queues1 then rejects ack.
  Run that unchanged oracle in the original independent donor; its unsafe expected
  results deliberately are not an after oracle. Before faults are injected, not
  observations of spontaneous guest behavior.
- `repaired.cjs`:45/45 full-protocol checks; both faults reject/no enqueue and
  safely restore. Batch/live/credits/recording drift at every post-snapshot request
  boundary, replaced/missing state, extra repaint/count and wrapper controls,
  transport errors, lazy/eager positives and consumed-controller replay.
- `test/test-enigma-presented-menu-controller.cjs`:24/24 combined regressions,
  including20 rejections, actual PNG decode/pixel change, dimensions, read errors,
  lazy/eager presentation and exactly one positive click each.
- `wiring-controls.cjs`:9 checks of exact full source wiring, unchanged other
  bytes, double/drifted wiring rejection, actual request replay after successful
  or lost-ack enqueue, cleanup reply loss and unmodified-runner fail-closed.
- Seven byte-exact complete pinned runner source slices independently verified
  against source line/length/hash. Parser, snapshot, full handler, canonical PNG
  path and hook functions execute as actual source. HTTP envelopes/filesystem,
  canvas codec and guest are mocked. The older pixel fixture additionally mocks
  its parser/queue; full-protocol acceptance covers the real parser/queue slices.

Inspected PNG remains SHA256
`8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5`,
640x480; decoded RGBA a44ee9b285f41ab7ac824d47703d06a81cf85b126b77cb6b93ae0b285207f587.
No hash weakening or extra frame allocation. Inputs are queued only. A reply lost
AFTER successful atomic enqueue is ambiguous to the caller: the queue contains
one click, with replay rejected. It is not evidence of input delivery or gameplay.

## Reusable wiring and later runtime recipe

Only after fresh independent acceptance and separate coordinator runtime assignment:
read the immutable full runner source with SHA256
4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809;
call `wireRunner(source)` exported by tools/enigma-presented-menu-controller.cjs;
write a separately named runner derivative in the same relative module layout,
never overwrite canonical test/run.js. Expected derivative SHA256
572bb3ef26cd5d7e2d118f25c9faa2991a1226b6e7beb7342cae3cb1d3f88646,
687334 bytes. Only ATOMIC_BRANCH is inserted before the existing eval case.
The exact source hash intentionally rejects other revisions: re-review wiring for
a different source; do not remove that check. No derivative was executed here.
Use a single exclusive trusted control client and frozen runner, zero credits,
no recorder, no pending guest work. No external client may modify queue, objects,
functions or builtins. JS synchronous run-to-completion binds final validation and
enqueue; arbitrary malicious synchronous callbacks/accessors are outside this
trusted-runner contract. Ordinary asynchronous inter-request invalidation is tested.
Allocate ONE fresh absolute PNG path under the existing <=2MiB frame allowance;
provide the normal `{ok,value}` ask transport to `createController(ask,path)`;
invoke once. Never retry ambiguous final enqueue with another controller. Inspect
queue/ownership with coordinator direction before any further input or step.
Input delivery, Start Game, level selection and gameplay need separate evidence.
No runtime command/box is authorized by this recipe. Coordinator owns lifecycle.

Offline reproduction (installed Node24, exact supervisor limits in receipts):
`node --max-old-space-size=192 test/test-enigma-presented-menu-controller.cjs`
`node --max-old-space-size=192 docs/reviews/enigma-atomic-presented-click-repair-oct26/repaired.cjs`
`node --max-old-space-size=192 docs/reviews/enigma-atomic-presented-click-repair-oct26/wiring-controls.cjs /path/to/verified/immutable/pinned-run.js`

## Resources and remaining gates

Flat sparse checkout owns only controller, focused test/fixture, original PNG and
focused evidence. Immutable donors and installed Node are read/executed in place;
no hidden tool copies or links. Git DATA512MiB is applied only to child Git, never
Node, its shell or supervisor. CPU90s/wall120s/file24MiB/output2MiB/excerpt8192B.
Node heap192MiB is not a total process cap; actual executable/argv/environment and
inherited limits startup receipt passed. Empty mount argv was parsed by canonical
parser; intended files/mounts are empty. No guest/browser/build/APIexec/box/SSH
runtime/acquisition/install/deployment/service/restart/Telegram/worker launch.
Root ref digest reused without full-ref capture; root dirty work and donors read
only except append-only coordination. Allocation includes checkout/Git/copies,
launcher/session growth, positive WAL growth once, future growth and8MiB reserve:
40MiB projected within64MiB; host remaining exceeds2,982,150,144B. Memory admission
reserves two256MiB new clients plus four320MiB lightweight allowances and768MiB
physical floor without subtracting already-counted client RSS again.
First ordinary fixture syntax failure and affected-group rerun are retained in
incidents.json; no resource/platform denial. Publication uses normal task-branch
push; unrelated missing sparse blobs remain remote-owned unchanged entries.

STOP for fresh independent acceptance, coordinator integration and separately
authorized runtime. BoxID/state/expiry:none/unassigned/not contacted/none.
''')
# Stage production/test first to retain exact tested source-tree identity.
g('add','--sparse','tools/enigma-presented-menu-controller.cjs','test/test-enigma-presented-menu-controller.cjs');g('diff','--cached','--check')
save('tested-tree.json',dict(parent=REV,sourceTree=g('write-tree','--missing-ok').decode().strip(),controllerSHA256=sha((R/'tools/enigma-presented-menu-controller.cjs').read_bytes()),testSHA256=sha((R/'test/test-enigma-presented-menu-controller.cjs').read_bytes()),remaining='Only focused evidence additions; publish; independent acceptance/runtime'))
shutil.copyfile(O/'tested-tree.json',P/'tested-tree.json')
gate('prepublication')
print('PACKAGE PASS')

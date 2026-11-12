# Independent Enigma atomic click acceptance: REJECT

Candidate `a42e321f7a0d604503ad6f5ae6d76174130e525b`, source tree
`115a929225acdcddd65c7a17a8a34ed2ea4ba98c`. Production is unchanged by this review.
The atomic enqueue repair closes the two original unsafe reproductions, but the
final transport failure path makes an untrue no-click claim. No integration or
runtime safety approval is given.

## Blocking unchanged reproduction

`results.json`, case `atomic-success-reply-lost-envelope`: the real transformed
runner handler executes its atomic action, inserts the canonical click at
`(344,212)` batch `100000`, restores its wrapper and consumes its witness. The
transport then returns `{ok:false,error:'transport lost AFTER enqueue'}`.
The unchanged candidate controller rejects with exactly:

```
control readback error; no click
```

The queue contains ONE click. The same controller is consumed; replay of the
exact same atomic request rejects and does not add a second click. This is an
unknown enqueue outcome from the caller's perspective, not evidence of no click.
The supplied repair's own `atomicLostReply` result agrees; its passing oracle
allowed this mismatch. This review explicitly tests error truthfulness without
changing the candidate or narrowing the safety contract.

Minimal repair: after final atomic dispatch begins, label transport/envelope,
missing-value and malformed acknowledgement errors as **enqueue outcome unknown**.
Preserve the one-shot latch and prohibition on automatic replay/new-controller
retry. A transport exception after dispatch cannot prove whether the operation
reached the runner. Reserve no-enqueue claims for verified pre-enqueue rejection
or the earlier stages that never dispatch the atomic operation. Re-run this exact
reproducer plus affected final-ack tests; retain the unchanged passing groups.

## Independent checks and boundaries

Twenty focused protocol scenarios plus one diagnostic use the original independent
fixture's exact missing-witness and late-batch injection bodies. Only the actual
handler interpolation is wired with the repaired exported atomic branch; the
unchanged original before oracle is retained byte-for-byte as
`unchanged-before-oracle.cjs`, SHA256
`a04f1938afab1743fdb02a2872567542f7530ef0ff5c6720649adcfd44d6706b`.
Its obsolete before-result expectations are not used as after expectations.

Lazy and eager positives enqueue one canonical click each. Missing witness and
late batch reject with zero enqueue and safe restoration. Final batch, frozen,
credits, recording, count, record identity, missing record, replaced wrapper,
prepared flag and extra repaint challenges reject with no enqueue. A foreign
wrapper remains untouched. Before-dispatch transport loss restores ownership and
adds no click. Post-enqueue thrown loss and malformed ack preserve one queued
click without a false no-click phrase. Duplicate atomic requests reject. Every
case checks consumed-controller retry, and every dispatched atomic request checks
exact replay without another enqueue.

Preexisting due input and future input remain ordered around the newly inserted
click. The case ends with TWO pending clicks, one preexisting and one new. This
preservation matches the ordinary runner queue semantics; it is not a claim that
one fresh operation guarantees only one pending input. The controller does not
inspect/reject preexisting queue contents. A separately authorized runtime must
establish an uncontaminated queue before relying on a one-click experiment.

The diagnostic getter on witness `original` changes the batch after validation
and still permits enqueue. The exact tested source and injected getter show that
synchronous run-to-completion alone does not prevent reentrancy. This requires
tampering with private witness descriptors and is outside the repair README's
explicit trusted-object/no-malicious-accessor contract, so it is recorded as a
scope limit, not the blocking production defect. Real HTTP commands are decoded
data; ordinary runner state and arrays must retain their trusted data properties.

## Source and evidence identity

`pins.json` binds all four source hashes, all 34 supplied manifest payloads, the
exact candidate remote, and seven complete runner slices by start line, byte
length and SHA256 against the immutable full runner. The canonical parser is
included in full: it appends temporary entries and returns them using
`scheduledInput.splice(first)`. The real atomic branch then inserts exactly once.
The actual runner drains due inputs with `shift` after its frozen control boundary.

Full runner SHA256:
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
Identity-checked single-insertion derivative:
`572bb3ef26cd5d7e2d118f25c9faa2991a1226b6e7beb7342cae3cb1d3f88646`,
687334 bytes. Removing exactly `ATOMIC_BRANCH` reproduces every original byte.
The full derivative was not launched. Canonical PNG remains
`8ffead1b04adbe5fac8d82c5a374375f5883898b29e87962d72c3c3e26da18d5`.
Canonical contract hash is the authoritative receipt's
`c038866f8cc3a779ae9c8c16b57531a310872ba056f58140118b4f27c11c8037`;
the prompt's one-character transcription was corrected against actual bytes.

The exact tested full runner is an external pinned donor, Git blob
`423b40d4c00f01e3dbfa9ba1bcfdcfa249d07e2e`. The candidate tree names DIFFERENT blob
`4b8461338f4bcddde6b5d5504991523b28d3ac35` for `test/run.js`. An attempted equality
assertion correctly failed before publication; a read-only root lookup could not
resolve that sparse blob (exit128, retained). Accordingly the source slices and
wiring evidence apply only to the explicitly pinned full runner. No claim of
candidate tracked-runner compatibility is made. This is an additional unresolved
qualification gate; the exact pinned-runner reproduction already rejects the
controller's final-outcome reporting, so no guest or acquisition attempt is needed.

The supplied 45 protocol, 24 regression and 9 wiring checks remain retained and
hash-verified, not indiscriminately rerun. Their evidence is in the candidate's
`docs/reviews/enigma-atomic-presented-click-repair-oct26/`. This independent suite
adds the truthful-outcome assertion and focused final-state challenges.

Mock limits: full real parser, snapshot, control eval/PNG and handler slices run
inside a VM. Filesystem and HTTP envelopes are mocked, canvas serialization
returns the unchanged inspected PNG, guest/emulator/audio/delivery are absent.
There is no new pixel-decoding, browser, input delivery or gameplay evidence.
Offline equivalence does not establish runtime safety or Start Game success.

Reproduce with installed Node24, heap flag and supervisor from the resource
receipts, after fresh admission:

```
node --max-old-space-size=192 docs/reviews/enigma-atomic-click-independent-accept-oct26/challenges.cjs /verified/immutable/pinned-run.js
```

`fixture.cjs` is the published generated fixture. `recovery-build-fixture.py`
documents its exact transformation; `supervisor.py` and startup receipts bind
the limits. No source edits are needed for reproduction.

## Incidents, resources and handback

Initial sparse checkout and exact Node startup passed. A later memory admission
measured 3292184576 bytes below the required 3422552064; acceptance execution
stopped. Static review continued. A subsequent actual capacity recovery to
4086988800 bytes permitted a fresh passing admission and the first focused run.
The original gate filename was replaced by the recovered checkpoint; the first
failure's exact measured diagnostic is retained in `first-resource-denial.json`.
Verification completed its pins before an ordinary mkdir-existing error; that
idempotency issue was corrected, and completed pin checks were reused.

Task accounting includes checkout/Git, copies, temporary/evidence files,
launcher/session growth, attributable positive WAL growth once, future allowance
and 8 MiB reserve inside 64 MiB. Projection is at least 40 MiB; host floor after
projection is 2982150144 bytes. Memory admission uses the assigned four-lane
3422552064-byte aggregate without subtracting live client RSS twice. Git DATA
512 MiB applies only to child Git. Node192 is a heap setting, not total RSS.
CPU90s/wall120s/file24MiB/output2MiB/excerpt8192B apply. Installed Node and immutable
donors remain standing inputs, separately identified with no concealed copies.
Canonical mount parser validated empty actual argv and intended file list; no
mounts or runtime were attempted. Root streaming ref receipt was reused without
capturing refs. Trusted dedicated Git SSH configuration is retained unchanged.

Only this review directory is published to its task branch. No MAIN ownership,
integration, guest/box/browser/build/acquisition/installation/deployment/service
or Telegram activity. Claude and other workers/monitors are untouched. No box
assigned/contacted; ID/expiry none, lifecycle coordinator. Remaining gates are
minimal outcome-report repair, affected independent acceptance, coordinator-owned
integration and separately authorized queue/wiring/runtime/delivery/gameplay
qualification. Ownership is released on verified task-branch publication; stop.

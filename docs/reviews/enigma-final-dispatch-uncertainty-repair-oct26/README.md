# Enigma final dispatch uncertainty repair

Starting review commit: `3e40a69903cad91e1b2f089f6dc5e9dbb912fafa`.
This repairs its `REJECT_FALSE_NO_CLICK_AFTER_ATOMIC_ENQUEUE` finding.

After invoking the atomic command, the controller cannot infer whether enqueue
happened from a thrown transport error, failure envelope, missing response/value,
or invalid acknowledgement. These paths now throw an Error with
`code: ENIGMA_ENQUEUE_OUTCOME_UNKNOWN`, `enqueueOutcome: unknown`, and the human
message `enqueue outcome unknown; controller consumed; do not retry`. The original
error is retained as `cause`. In particular an error envelope's text is not proof
of pre-enqueue rejection, even when the actual fixture rejected before enqueue.

Errors before invoking atomic dispatch carry `code: ENIGMA_NOT_DISPATCHED` and
`enqueueOutcome: not-dispatched`. An acknowledged success returns
`enqueueOutcome: acknowledged`, preserving the existing safety/click result.
Acknowledgement establishes enqueue only; it establishes neither input delivery
nor gameplay. The controller stays consumed on every path. Cleanup can restore
owned presentation state but never retries the atomic command or clears input.

All source before `createController` is byte-identical, including atomic final
checks, canonical parsing, single splice, transaction consumption, restoration,
runner insertion and PNG identity checks. No accessor trust contract is expanded.
See `source-relation.json` for exact source identities and unchanged prefix hash.

## Affected checks

The focused unit group passes 10 cases: eight post-enqueue thrown/envelope/missing/
malformed-response variants, known cleanup rejection before dispatch, and normal
acknowledgement. Each checks consumption/no second atomic request, exact enqueue
count and restoration. Run with the installed Node24 and the retained supervisor:

```
node --max-old-space-size=192 test/test-enigma-presented-menu-controller.cjs --final-dispatch-only
```

The original independent `challenges.cjs`, `fixture.cjs` and
`unchanged-before-oracle.cjs` remain byte-for-byte unchanged in the preceding
review directory. Its 20 affected protocol scenarios pass against this controller;
the additional diagnostic still demonstrates the explicitly excluded malicious
witness getter. The exact lost-reply-envelope reproduction now records ONE
queued click and `PASS_NO_FALSE_NO_CLICK`. Original lost-witness/late-batch faults
still reject with zero enqueue and restored wrappers. Consumed-controller retries
and direct atomic replays add no input. Preexisting input is preserved.

```
node --max-old-space-size=192 docs/reviews/enigma-atomic-click-independent-accept-oct26/challenges.cjs /tmp/enigma-presented-frame-controller-repair-oct26/ops/pinned-run.js
```

The unchanged challenge output's `candidate` field labels its original input
revision; `source-relation.json` and checkpoints identify the actual repaired
source used here. Its `REVIEW` verdict is its passing protocol result, not a new
independent approval of this repair. The prior 45/24/9 receipts are retained and
hash-verified; those unchanged groups were not repeated. The 21-case independent
receipt is preserved separately from this affected rerun. No guest was executed.

## Boundaries and recovery

The tested full runner is still the pinned donor blob
`423b40d4c00f01e3dbfa9ba1bcfdcfa249d07e2e`, SHA256
`4d7b9587676db38fcf3314807acb2b2a42b5f09d2c98fcf3dccb8a6cde9e1809`.
Tracked `test/run.js` remains DIFFERENT blob
`4b8461338f4bcddde6b5d5504991523b28d3ac35`; compatibility is UNPROVEN.
The existing missing-object rejection is retained in the parent review. This task
does not need that blob or claim tracked-runner qualification.

The VM fixture uses real pinned handler/parser slices with mocked HTTP/filesystem
and PNG serialization; the unit fixture also mocks queue parsing. Guest, browser,
runtime delivery and gameplay remain absent. Fresh independent repair acceptance,
coordinator-owned integration, tracked-runner compatibility and separately
authorized clean-queue/runtime/delivery/gameplay qualification remain gates.

Receipts bind actual Node executable/heap argv/environment/inherited limits,
trusted dedicated Git SSH configuration, empty actual mount argv parsed with the
canonical parser, and the launcher's streaming root-ref digest without capturing
the ref listing. No mount/files were intended. Git DATA512MiB is applied only to
child Git; Node192 is a heap flag, not a process-memory cap. CPU90s/wall120s,
file24MiB/output2MiB/excerpt8192B and fresh aggregate physical admission apply.
Task accounting includes owned checkout/Git/evidence/temp, launcher/session
growth, positive WAL growth once, future growth and 8MiB reserve within64MiB.
Projection is at least40MiB; host remaining floor is2982150144B. Four light job
allowances plus one new client and physical floor require2415919104B, without
subtracting already-live client RSS twice. Standing donor/Node inputs are listed
separately; no hidden links or full-ref/object capture.

One internal sparse-pattern omission caused the first prior-manifest read to fail.
The exact immutable objects were already present; adding that review directory's
sparse pattern resolved it within this task, before tests. The incident and first
diagnostic are retained. No resource/access denial occurred in this task.

Only the controller, its focused regression file and this review directory are
published to the task branch. Root/donors are read-only except append-only board
coordination. No MAIN/integration/runtime/guest/build/browser/acquisition/service/
deployment/Telegram/worker operations. No box assigned or contacted; ID/expiry
none, lifecycle ownership remains with the coordinator. Ownership releases after
verified task-branch publication; this worker then stops.

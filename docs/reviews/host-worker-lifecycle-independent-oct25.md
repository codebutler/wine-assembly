# Independent host worker fixture review — 2026-10-25

**ACCEPT** candidate `706282e99b2b5a2cf4af4514e373d1a216863e9c` against
base `20a4ea17a09564911d054e848c12f2f4ee237805`. The four real-constructor
initializers restore the complete lifecycle test without weakening its oracle.
No production defect was found and no production file was changed. This review
adds a complementary executable test; the candidate lifecycle test is unchanged.

The complete ordinary command `node test/test-host-worker-lifecycle.js` passes.
Reversing only the four initializer replacements and two setup comments recovers
the baseline byte for byte. The retained Acorn structural recipe also verifies
12 case blocks and all 37 assertion call texts, preserving complete case bodies,
deadlines and rejection patterns. Candidate test SHA-256 remains
`62552f162c3efe72ff5813bc83147e8049293478b855aabd4545e3e1ef798419`.
Running the original Git test blob in memory against unchanged production fails
at `_processObject.exited`; changing just the host initializer reaches the second
stale fixture failure, `_retiringListeners is not iterable`. Neither reproducer
modifies the passing checkout or its entry point.

## Constructor and ownership findings

`WineAssembly` initializes its process object, alias table, PID and inert defaults.
It increments the page-wide PID and process-seen state; a second process marks
the thread snapshot incomplete. These are intentional synchronous effects, now
checked explicitly. In the suite's empty location query it does not reset the
compiled-module cache (the debug-query branch would). It starts no clock, worker,
guest memory allocation, fetch or guest execution. Each instance has its own
process object and alias map. The original synthetic guest references are assigned
after construction, so their identity remains the one asserted by the suite.

`WorkerLink` assigns a fresh module-local endpoint identity, listener set, pending
map and inert retirement defaults. Only `start()` creates a worker and readiness
timer. `GuestThreadHost` constructs distinct frame/send-wait ownership and maps;
it does not call `start()`, construct a WorkerLink or arm its default 4ms clock.
The existing assignments preserve the intended fake transport and starting-link
cases. The actual Node never-ready case still calls real `start()` and `stop()`.

The additional `node test/test-host-worker-lifecycle-independent.js` executes
actual constructors and retirement methods with synthetic transport/timer
boundaries. It checks constructor inactivity, per-instance process/send-wait and
listener identities, listener unsubscribe/one-shot/late-registration behavior,
single-flight retirement and sibling isolation. A wrong scoped-loader receipt
must reject without terminating its owner; an explicit retry uses the same
endpoint identity. A late termination cannot clear a replacement owner. A
transport failure rejects readiness visibly and clears its timer. The exact
20,000ms readiness deadline rejects with its existing diagnostic and is cleared
on cleanup. Every synthetic transport is terminated once on the passing run.
The complete original suite separately verifies real Node worker exit before
retirement resolves and completes promptly without a lingering 20s timer.

## Rejecting controls and receipt reuse

Seven independent in-memory production controls are rejected with ERR_ASSERTION:

| Mutation | Rejecting observation |
| --- | --- |
| Start a constructor interval | Constructor timer count must remain zero |
| Share listener sets between endpoints | Listener sets must have distinct identities |
| Accept the wrong retirement identity | Expected retirement rejection is missing |
| Clear a replacement owner after old termination | Replacement reference must survive |
| Resolve readiness on transport failure | Expected readiness rejection is missing |
| Omit readiness-rejection timer cleanup | Timer inventory must be empty |
| Share process objects between hosts | Process objects must have distinct identities |

The four supplied controls were reviewed against the actual production methods
and existing assertions: early memory release, successful readiness settlement
instead of stop rejection, hidden retirement failure and hidden timeout diagnosis.
Their sealed receipts demonstrate rejection at the intended behavioral assertions.
They do not establish listener isolation or receipt ownership, hence the additional
controls above. Their results and the adjacent launch-options/cancellation checks
are reused without broad reruns. All 52 prior evidence files match their exact
size/SHA manifest; the 29 other materialized tracked source/dependency files match
base, candidate and final bytes. The adjacent tests and their dependency closure
therefore retain their prior exact-input evidence.

Two review-harness failures remain recorded: a synthetic Error initially crossed
VM realms and was normalized by production (the VM now receives the ordinary
Node Error constructor), and the timer-control source anchor occurs twice (the
helper now validates that count before mutating only the first occurrence).
These were harness corrections; neither changed production or the candidate test.

## Evidence and scope

Recipes, command/exit receipts, all failed and passing logs, source hashes,
resource admissions, publication verification and cleanup are retained under
`/tmp/host-worker-lifecycle-independent-integrate-oct25/ops/`. `result.json`
records final commit/tree, remote refs and the SHA-256 evidence manifest.
`validation.json` binds the acceptance decision to the focused tests and controls.
Commands use a 256MiB Node heap, 90s wall bound and 128KiB output bound.

Integration is authorized only after this explicit independent acceptance, passing
tests on the exact final tree, clean owned checkout, fresh unchanged remote main,
ancestry verification and a passing current resource gate. Publication uses the
dedicated strict SSH identity and normal nonforce updates. The root worktree and
donor remain immutable apart from append-only root messageboard entries. The
checkout was sparsely specified before checkout and uses flattened read-only
alternates. Installed tools/read-only donors are standing inputs; task data,
current external session/launcher, WAL/SHM, future growth and an 8MiB reserve are
charged inside 64MiB.

No guest mount argv exists; the guest mount-parser checkpoint is inapplicable.
No worker agents, box, game, native, Wasm, fullVM, build, acquisition or deployment
operation was used. This accepts the fixture repair and bounded host-JS checks;
it makes no general SEH, native or gameplay qualification claim. No box was
assigned; lifecycle ownership remains with the coordinator.
